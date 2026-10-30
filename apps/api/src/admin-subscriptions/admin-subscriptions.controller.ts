import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { and, desc, ilike, isNotNull, or, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BillingService, PlanOption } from '../billing/billing.service';
import { WebhookHealthService } from '../billing/webhook-health.service';
import { SubscriptionSyncService } from './subscription-sync.service';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';

const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);
const FILTERS = ['active', 'trialing', 'past_due', 'canceling', 'canceled'] as const;

const stripeUrl = (subscriptionId: string) =>
  `https://dashboard.stripe.com/${(process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test') ? 'test/' : ''}subscriptions/${subscriptionId}`;

/** Every Stripe subscription we know about, with the data support needs: status, plan, price, renewal or end date. */
@Controller('admin/subscriptions')
@UseGuards(AdminGuard)
export class AdminSubscriptionsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly billing: BillingService,
    private readonly actor: AdminActorService,
    private readonly webhookHealth: WebhookHealthService,
    private readonly syncAll: SubscriptionSyncService,
  ) {}

  @Get()
  async list(@Query('q') q = '', @Query('filter') filter = '') {
    const conds: SQL[] = [isNotNull(users.stripeSubscriptionId)];
    const term = q.trim().slice(0, 100);
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const match = or(ilike(users.email, like), ilike(users.name, like));
      if (match) conds.push(match);
    }
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        status: users.subscriptionStatus,
        plan: users.subscriptionPlan,
        periodEnd: users.subscriptionCurrentPeriodEnd,
        cancelAtPeriodEnd: users.subscriptionCancelAtPeriodEnd,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(...conds))
      .orderBy(desc(users.updatedAt))
      .limit(1000);

    let plans: PlanOption[] = [];
    try {
      plans = await this.billing.getPlans();
    } catch {
      /* prices are a convenience; the list must still load when Stripe is unreachable */
    }

    const all = rows.map((r) => {
      const live = r.status != null && LIVE.has(r.status);
      const canceling = live && r.cancelAtPeriodEnd;
      const price = plans.find((p) => p.plan === r.plan);
      return {
        userId: r.id,
        email: r.email,
        name: r.name,
        status: r.status,
        plan: r.plan,
        amountCents: price?.amount ?? null,
        currency: price?.currency ?? null,
        canceling,
        /** Next charge for a healthy subscription. */
        renewsAt: live && !canceling ? r.periodEnd : null,
        /** Last day of access for one that was cancelled. */
        endsAt: canceling || r.status === 'canceled' ? r.periodEnd : null,
        customerId: r.stripeCustomerId,
        subscriptionId: r.stripeSubscriptionId,
        stripeUrl: r.stripeSubscriptionId ? stripeUrl(r.stripeSubscriptionId) : null,
        since: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    const bucket = (r: (typeof all)[number]): (typeof FILTERS)[number] | 'other' =>
      r.canceling ? 'canceling' : r.status === 'active' ? 'active' : r.status === 'trialing' ? 'trialing' : r.status === 'past_due' || r.status === 'unpaid' ? 'past_due' : r.status === 'canceled' ? 'canceled' : 'other';
    const counts = Object.fromEntries(FILTERS.map((f) => [f, all.filter((r) => bucket(r) === f).length])) as Record<(typeof FILTERS)[number], number>;
    const rowsOut = (FILTERS as readonly string[]).includes(filter) ? all.filter((r) => bucket(r) === filter) : all;
    return { counts, total: all.length, rows: rowsOut };
  }

  /** Is Stripe really configured to call this API (right URL, enabled, the events we handle, secret set)? */
  @Get('webhook-health')
  health() {
    return this.webhookHealth.check();
  }

  @Get('sync-all')
  syncAllStatus() {
    return this.syncAll.status();
  }

  /** Catch-up for everyone: re-reads every Stripe customer's subscription in the background. */
  @Post('sync-all')
  async startSyncAll(@CurrentUser() admin: JwtPayload) {
    const status = await this.syncAll.start();
    await this.actor.record(admin, { action: 'subscription.sync_all', details: { total: status.total } });
    return status;
  }

  /** Re-reads one user's subscription from Stripe: the fix when a webhook was missed. */
  @Post(':userId/sync')
  async sync(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() admin: JwtPayload) {
    const status = await this.billing.syncFromStripe(userId);
    await this.actor.record(admin, { action: 'subscription.sync', targetUserId: userId, details: { state: status.state, subscriptionStatus: status.subscriptionStatus } });
    return status;
  }
}
