import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
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

  async getStatus(userId: string): Promise<AccessInfo> {
    return computeAccess(await this.loadUser(userId), new Date());
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
