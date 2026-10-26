import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Stripe from 'stripe';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { purchases, users } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { planForPriceId } from './billing.service';
import { StripeClient } from './stripe-client';

type User = typeof users.$inferSelect;

const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);

function isLiveStatus(status: string | null | undefined): boolean {
  return status != null && LIVE_STATUSES.has(status);
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function isResourceMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'resource_missing';
}

/**
 * Applies Stripe events to our `users` / `purchases` tables.
 * Every handler re-reads the subscription from Stripe and writes absolute state (never increments),
 * so replays and out-of-order delivery converge to the same result.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly stripe: StripeClient,
    private readonly notifications: NotificationsService,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object);
        return;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncById(event.data.object.id, event.data.object);
        return;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const subscriptionId = idOf(event.data.object.parent?.subscription_details?.subscription);
        if (subscriptionId) await this.syncById(subscriptionId, null);
        return;
      }
      default:
        return;
    }
  }

  private async findUser(userId: string | null | undefined, customerId: string | null): Promise<User | null> {
    if (userId) {
      const byId = await this.db.select().from(users).where(eq(users.id, userId));
      if (byId[0]) return byId[0];
    }
    if (customerId) {
      const byCustomer = await this.db.select().from(users).where(eq(users.stripeCustomerId, customerId));
      if (byCustomer[0]) return byCustomer[0];
    }
    return null;
  }

  /** Fetches the live subscription from Stripe (the event payload may be stale) and syncs it. */
  private async syncById(subscriptionId: string, fallback: Stripe.Subscription | null, hintUserId?: string): Promise<User | null> {
    let subscription: Stripe.Subscription;
    try {
      subscription = await this.stripe.get().subscriptions.retrieve(subscriptionId);
    } catch (error) {
      // A deleted subscription may no longer be retrievable; its event payload is then the best truth.
      if (fallback && isResourceMissing(error)) subscription = fallback;
      else throw error;
    }
    return this.syncSubscription(subscription, hintUserId);
  }

  private async syncSubscription(subscription: Stripe.Subscription, hintUserId?: string): Promise<User | null> {
    const customerId = idOf(subscription.customer);
    const user = await this.findUser(hintUserId ?? subscription.metadata?.userId, customerId);
    if (!user) {
      this.logger.warn(`Stripe subscription ${subscription.id} does not match any user; ignoring.`);
      return null;
    }

    // An event for an older, ended subscription must not overwrite a live current one.
    const isOtherSubscription = user.stripeSubscriptionId != null && user.stripeSubscriptionId !== subscription.id;
    if (isOtherSubscription && !isLiveStatus(subscription.status)) return user;

    const periodEnds = subscription.items.data.map((item) => item.current_period_end);
    const periodEnd = periodEnds.length > 0 ? new Date(Math.max(...periodEnds) * 1000) : null;
    const price = subscription.items.data[0]?.price;
    const plan = planForPriceId(price?.id);
    if (!plan) this.logger.warn(`Subscription ${subscription.id} uses a price that is not configured as a plan.`);

    const next = {
      stripeCustomerId: user.stripeCustomerId ?? customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: plan,
      subscriptionCurrentPeriodEnd: periodEnd,
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at != null,
    };

    const unchanged =
      next.stripeCustomerId === user.stripeCustomerId
      && next.stripeSubscriptionId === user.stripeSubscriptionId
      && next.subscriptionStatus === user.subscriptionStatus
      && next.subscriptionPlan === user.subscriptionPlan
      && next.subscriptionCurrentPeriodEnd?.getTime() === user.subscriptionCurrentPeriodEnd?.getTime()
      && next.subscriptionCancelAtPeriodEnd === user.subscriptionCancelAtPeriodEnd;
    if (unchanged) return user;

    await this.db.update(users).set({ ...next, updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ...user, ...next };
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== 'subscription') {
      this.logger.warn(`Ignoring non-subscription checkout session ${session.id}.`);
      return;
    }
    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) {
      this.logger.warn(`Checkout session ${session.id} has no subscription.`);
      return;
    }

    const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
    const known = await this.findUser(userId, idOf(session.customer));
    if (!known) {
      this.logger.warn(`Checkout session ${session.id} does not match any user; ignoring.`);
      return;
    }

    const user = await this.syncById(subscriptionId, null, known.id);
    if (!user) return;

    const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    if (!paid) return;

    if (await this.recordPurchaseOnce(session, user)) {
      try {
        await this.notifications.sendAdminEmail(user.email, 'access_granted', {
          name: user.name ?? 'Cliente',
          loginUrl: `${(process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/$/, '')}/login`,
        });
      } catch (error) {
        // The purchase is already recorded; a failed e-mail must not make Stripe retry the whole event.
        this.logger.error(`Failed to send access e-mail for session ${session.id}: ${String(error)}`);
      }
    }
  }

  /** Inserts the purchases row for a checkout session at most once; returns true when it was created. */
  private async recordPurchaseOnce(session: Stripe.Checkout.Session, user: User): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // Serialises concurrent deliveries of the same session without needing a unique index.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stripe-session:${session.id}`}))`);

      const existing = await tx
        .select({ id: purchases.id })
        .from(purchases)
        .where(and(eq(purchases.paymentProvider, 'stripe'), eq(purchases.providerPaymentId, session.id)));
      if (existing.length > 0) return false;

      await tx.insert(purchases).values({
        clientId: user.clientId,
        email: user.email,
        plan: 'premium',
        amount: session.amount_total != null ? String(session.amount_total / 100) : null,
        status: 'approved',
        paymentProvider: 'stripe',
        providerPaymentId: session.id,
        metadata: {
          stripeCheckoutSessionId: session.id,
          stripeSubscriptionId: idOf(session.subscription),
          stripeCustomerId: idOf(session.customer),
        },
        updatedAt: new Date(),
      });
      return true;
    });
  }
}
