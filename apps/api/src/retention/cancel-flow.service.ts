import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import Stripe from 'stripe';
import { BillingService, BillingStatus } from '../billing/billing.service';
import { StripeClient } from '../billing/stripe-client';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { cancellationFeedback, users } from '../db/schema';
import { RetentionSettingsService } from './retention-settings.service';
import { CANCEL_REASONS, CancelReason, Offer, offerFor, OfferKind, RetentionSettings } from './retention.types';
import { ensureCoupon } from './stripe-coupons';

type User = typeof users.$inferSelect;
type Feedback = typeof cancellationFeedback.$inferSelect;

const LIVE_FOR_OFFER = 'active';

/**
 * The in-app cancel flow: ask why, offer the one thing that fits the answer (once per customer, ever), and only then
 * cancel. The cancel path is never blocked: `confirm` works whether or not an offer was shown or accepted.
 */
@Injectable()
export class CancelFlowService {
  private readonly logger = new Logger(CancelFlowService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly stripe: StripeClient,
    private readonly billing: BillingService,
    private readonly settings: RetentionSettingsService,
  ) {}

  private async loadUser(userId: string): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async liveSubscription(user: User): Promise<Stripe.Subscription> {
    if (!user.stripeSubscriptionId) throw new ConflictException('No active subscription.');
    return this.stripe.get().subscriptions.retrieve(user.stripeSubscriptionId);
  }

  /** An offer is only made to a healthy, full-price subscription that never took one before. */
  private async eligible(user: User, subscription: Stripe.Subscription): Promise<boolean> {
    if (subscription.status !== LIVE_FOR_OFFER || subscription.cancel_at_period_end || subscription.cancel_at != null) return false;
    if (subscription.discounts.length > 0) return false;
    const [taken] = await this.db
      .select({ id: cancellationFeedback.id })
      .from(cancellationFeedback)
      .where(and(eq(cancellationFeedback.userId, user.id), eq(cancellationFeedback.outcome, 'accepted')))
      .limit(1);
    return !taken;
  }

  /** Step 1: record the reason and say whether an offer applies. */
  async start(userId: string, input: { reason: string; comment?: string }): Promise<{ feedbackId: string; offer: Offer | null }> {
    if (!(CANCEL_REASONS as readonly string[]).includes(input.reason)) throw new BadRequestException('Motivo inválido.');
    const reason = input.reason as CancelReason;
    const user = await this.loadUser(userId);
    const subscription = await this.liveSubscription(user);
    const s = await this.settings.get();
    const offer = (await this.eligible(user, subscription)) ? offerFor(reason, s) : null;

    const [row] = await this.db
      .insert(cancellationFeedback)
      .values({
        userId,
        stripeSubscriptionId: subscription.id,
        reason,
        comment: (input.comment ?? '').trim().slice(0, 500) || null,
        offerKind: offer?.kind ?? null,
        planLabel: user.subscriptionPlan,
        amountCents: user.subscriptionAmountCents,
      })
      .returning({ id: cancellationFeedback.id });
    return { feedbackId: row.id, offer };
  }

  private async ownedPending(userId: string, feedbackId: string): Promise<Feedback> {
    const [row] = await this.db
      .select()
      .from(cancellationFeedback)
      .where(and(eq(cancellationFeedback.id, feedbackId), eq(cancellationFeedback.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException('Pedido não encontrado.');
    return row;
  }

  private async applyOffer(subscription: Stripe.Subscription, kind: OfferKind, s: RetentionSettings): Promise<void> {
    const stripe = this.stripe.get();
    const coupon =
      kind === 'free_month'
        ? await ensureCoupon(stripe, 'rw-save-free-1m', { name: 'Realwise: 1 mês grátis (retenção)', percentOff: 100, duration: 'once' })
        : await ensureCoupon(stripe, `rw-save-${s.discountPercent}-${s.discountMonths}m`, {
            name: `Realwise: ${s.discountPercent}% por ${s.discountMonths} meses (retenção)`,
            percentOff: s.discountPercent,
            duration: 'repeating',
            months: s.discountMonths,
          });
    await stripe.subscriptions.update(subscription.id, { discounts: [{ coupon }] });
  }

  /** Step 2a: the customer takes the offer and stays. */
  async accept(userId: string, feedbackId: string): Promise<BillingStatus> {
    const row = await this.ownedPending(userId, feedbackId);
    if (row.outcome !== 'pending' || !row.offerKind) throw new ConflictException('Esta oferta não está mais disponível.');
    const user = await this.loadUser(userId);
    const subscription = await this.liveSubscription(user);
    if (!(await this.eligible(user, subscription))) throw new ConflictException('Esta oferta não está mais disponível.');
    const s = await this.settings.get();

    // Claim first: two taps can never apply the coupon twice.
    const claimed = await this.db
      .update(cancellationFeedback)
      .set({ outcome: 'accepted', decidedAt: new Date() })
      .where(and(eq(cancellationFeedback.id, feedbackId), eq(cancellationFeedback.outcome, 'pending')))
      .returning({ id: cancellationFeedback.id });
    if (!claimed.length) throw new ConflictException('Esta oferta já foi usada.');
    try {
      await this.applyOffer(subscription, row.offerKind as OfferKind, s);
    } catch (e) {
      await this.db.update(cancellationFeedback).set({ outcome: 'pending', decidedAt: null }).where(eq(cancellationFeedback.id, feedbackId));
      this.logger.error(`could not apply save offer for ${userId}: ${(e as Error).message}`);
      throw e;
    }
    return this.billing.syncFromStripe(userId);
  }

  /** Step 2b: the customer cancels (with or without having seen an offer). The reason goes to Stripe as well. */
  async confirm(userId: string, feedbackId?: string): Promise<BillingStatus> {
    if (!feedbackId) return this.billing.cancelSubscription(userId);
    const row = await this.ownedPending(userId, feedbackId);
    const status = await this.billing.cancelSubscription(userId, { feedback: row.reason, comment: row.comment ?? undefined });
    if (row.outcome === 'pending') {
      await this.db
        .update(cancellationFeedback)
        .set({ outcome: row.offerKind ? 'declined' : 'cancelled', decidedAt: new Date() })
        .where(and(eq(cancellationFeedback.id, feedbackId), eq(cancellationFeedback.outcome, 'pending')));
    }
    return status;
  }
}
