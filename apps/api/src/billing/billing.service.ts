import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Stripe from 'stripe';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';
import { AccessInfo, BillingPlan, computeAccess, hasLiveSubscription } from './access';
import { StripeClient } from './stripe-client';

type User = typeof users.$inferSelect;

export interface PlanOption {
  plan: BillingPlan;
  priceId: string;
  amount: number;
  currency: string;
  interval: string;
  savingsPercent: number | null;
}

/** `GET /billing/status` (and the self-service actions): access info plus price details. */
export interface BillingStatus extends AccessInfo {
  /** Price of the current plan in minor units (centavos); null without a subscription. */
  amountCents: number | null;
  currency: string | null;
  /** Plans the subscriber can switch to (empty when there is nothing to switch to). */
  nextPlanOptions: PlanOption[];
}

const PLANS_CACHE_TTL_MS = 10 * 60 * 1000;

export function priceIdForPlan(plan: BillingPlan): string | null {
  const value = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL;
  return value?.trim() || null;
}

/** Maps a Stripe price id back to our plan; unknown prices yield `null`. */
export function planForPriceId(priceId: string | null | undefined): BillingPlan | null {
  if (!priceId) return null;
  if (priceId === priceIdForPlan('monthly')) return 'monthly';
  if (priceId === priceIdForPlan('annual')) return 'annual';
  return null;
}

function frontendBaseUrl(): string {
  return (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/$/, '');
}

@Injectable()
export class BillingService {
  private plansCache: { at: number; plans: PlanOption[] } | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly stripe: StripeClient,
  ) {}

  private async loadUser(userId: string): Promise<User> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId));
    if (!rows[0]) throw new UnauthorizedException();
    return rows[0];
  }

  async getStatus(userId: string): Promise<BillingStatus> {
    return this.buildStatus(await this.loadUser(userId));
  }

  /** Access info plus what the subscription page needs: current price and the plans one can switch to. */
  private async buildStatus(user: User): Promise<BillingStatus> {
    const access = computeAccess(user, new Date());
    const base: BillingStatus = { ...access, amountCents: null, currency: null, nextPlanOptions: [] };
    if (!user.stripeSubscriptionId || access.state === 'lifetime' || access.state === 'owner') return base;

    try {
      const plans = await this.getPlans();
      const current = plans.find((p) => p.plan === access.plan);
      return {
        ...base,
        amountCents: current?.amount ?? null,
        currency: current?.currency ?? null,
        nextPlanOptions: hasLiveSubscription(user) ? plans.filter((p) => p.plan !== access.plan) : [],
      };
    } catch {
      // Prices are a convenience here; the status must still load when Stripe is unreachable.
      return base;
    }
  }

  /** The user's live Stripe subscription, or 409 when self-service does not apply to them. */
  private async requireManageableSubscription(user: User): Promise<Stripe.Subscription> {
    const access = computeAccess(user, new Date());
    if (access.state === 'lifetime') throw new ConflictException('Your lifetime access has no subscription to manage.');
    if (access.state === 'owner') throw new ConflictException('This account has no subscription to manage.');
    if (!user.stripeSubscriptionId || !hasLiveSubscription(user)) {
      throw new ConflictException('You have no active subscription.');
    }

    let subscription: Stripe.Subscription;
    try {
      subscription = await this.stripe.get().subscriptions.retrieve(user.stripeSubscriptionId);
    } catch (error) {
      if ((error as { code?: string }).code === 'resource_missing') {
        throw new ConflictException('You have no active subscription.');
      }
      throw error;
    }
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) {
      throw new ConflictException('You have no active subscription.');
    }
    return subscription;
  }

  /** Writes the state Stripe just returned so the UI is right before the webhook arrives (which converges to the same values). */
  private async applySubscription(user: User, subscription: Stripe.Subscription): Promise<BillingStatus> {
    const periodEnds = subscription.items.data.map((item) => item.current_period_end);
    const next = {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: planForPriceId(subscription.items.data[0]?.price.id),
      subscriptionCurrentPeriodEnd: periodEnds.length > 0 ? new Date(Math.max(...periodEnds) * 1000) : null,
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at != null,
    };
    await this.db.update(users).set({ ...next, updatedAt: new Date() }).where(eq(users.id, user.id));
    return this.buildStatus({ ...user, ...next });
  }

  async changePlan(userId: string, plan: BillingPlan): Promise<BillingStatus> {
    const user = await this.loadUser(userId);
    const subscription = await this.requireManageableSubscription(user);
    if (subscription.status === 'past_due') {
      throw new ConflictException('Resolve the pending payment before changing plans.');
    }

    const priceId = priceIdForPlan(plan);
    if (!priceId) throw new ServiceUnavailableException('Billing prices are not configured');
    const item = subscription.items.data[0];
    if (!item) throw new ConflictException('You have no active subscription.');
    if (item.price.id === priceId) throw new ConflictException('You are already on this plan.');

    const updated = await this.stripe.get().subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'create_prorations',
    });
    return this.applySubscription(user, updated);
  }

  async cancelSubscription(userId: string): Promise<BillingStatus> {
    const user = await this.loadUser(userId);
    const subscription = await this.requireManageableSubscription(user);
    if (subscription.cancel_at_period_end || subscription.cancel_at != null) {
      return this.applySubscription(user, subscription);
    }

    const updated = await this.stripe.get().subscriptions.update(subscription.id, { cancel_at_period_end: true });
    return this.applySubscription(user, updated);
  }

  async resumeSubscription(userId: string): Promise<BillingStatus> {
    const user = await this.loadUser(userId);
    const subscription = await this.requireManageableSubscription(user);
    if (!subscription.cancel_at_period_end && subscription.cancel_at == null) {
      return this.applySubscription(user, subscription);
    }

    const updated = await this.stripe.get().subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
      ...(subscription.cancel_at != null ? { cancel_at: '' as const } : {}),
    });
    return this.applySubscription(user, updated);
  }

  async getPlans(): Promise<PlanOption[]> {
    if (this.plansCache && Date.now() - this.plansCache.at < PLANS_CACHE_TTL_MS) {
      return this.plansCache.plans;
    }

    const stripe = this.stripe.get();
    const plans: PlanOption[] = [];
    for (const plan of ['monthly', 'annual'] as const) {
      const priceId = priceIdForPlan(plan);
      if (!priceId) continue;
      const price = await stripe.prices.retrieve(priceId);
      plans.push({
        plan,
        priceId,
        amount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring?.interval ?? (plan === 'monthly' ? 'month' : 'year'),
        savingsPercent: null,
      });
    }
    if (plans.length === 0) throw new ServiceUnavailableException('Billing prices are not configured');

    const monthly = plans.find((p) => p.plan === 'monthly');
    const annual = plans.find((p) => p.plan === 'annual');
    if (monthly && annual && monthly.amount > 0 && monthly.currency === annual.currency) {
      const saved = Math.round((1 - annual.amount / (monthly.amount * 12)) * 100);
      annual.savingsPercent = saved > 0 ? saved : null;
    }

    this.plansCache = { at: Date.now(), plans };
    return plans;
  }

  private async ensureCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.get().customers.create(
      {
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id, clientId: user.clientId },
      },
      { idempotencyKey: `rw-customer-${user.id}` },
    );

    // Conditional write: if a concurrent request already stored a customer, keep that one.
    const updated = await this.db
      .update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), isNull(users.stripeCustomerId)))
      .returning({ stripeCustomerId: users.stripeCustomerId });
    if (updated[0]?.stripeCustomerId) return updated[0].stripeCustomerId;

    return (await this.loadUser(user.id)).stripeCustomerId ?? customer.id;
  }

  async createCheckout(userId: string, plan: BillingPlan): Promise<{ url: string }> {
    const user = await this.loadUser(userId);
    const access = computeAccess(user, new Date());
    if (access.state === 'lifetime' || hasLiveSubscription(user)) {
      throw new ConflictException('You already have an active plan. Use the billing portal to manage it.');
    }

    const priceId = priceIdForPlan(plan);
    if (!priceId) throw new ServiceUnavailableException('Billing prices are not configured');

    const customerId = await this.ensureCustomer(user);
    const base = frontendBaseUrl();
    const session = await this.stripe.get().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { userId: user.id, clientId: user.clientId } },
      allow_promotion_codes: true,
      locale: 'pt-BR',
      success_url: `${base}/${user.clientId}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/${user.clientId}/billing/cancelled`,
    });
    if (!session.url) throw new ServiceUnavailableException('Stripe did not return a checkout URL');
    return { url: session.url };
  }

  async createPortal(userId: string): Promise<{ url: string }> {
    const user = await this.loadUser(userId);
    if (!user.stripeCustomerId) {
      throw new ConflictException('No billing account found for this user.');
    }

    const session = await this.stripe.get().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${frontendBaseUrl()}/${user.clientId}`,
    });
    return { url: session.url };
  }
}
