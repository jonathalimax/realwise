import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { Inject } from '@nestjs/common';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { cancellationFeedback, reminderEmailsSent, users } from '../db/schema';
import { RetentionSettingsService } from './retention-settings.service';
import { RetentionSettings } from './retention.types';

const EMAIL_KINDS = ['payment_failed', 'payment_failed_followup', 'winback_7', 'winback_30', 'winback_60'];

@Controller('admin/retention')
@UseGuards(AdminGuard)
export class AdminRetentionController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly settings: RetentionSettingsService,
    private readonly actor: AdminActorService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  async saveSettings(@CurrentUser() admin: JwtPayload, @Body() body: Partial<RetentionSettings>) {
    const saved = await this.settings.save(body ?? {}, await this.actor.email(admin));
    await this.actor.record(admin, { action: 'retention.settings', details: { ...saved } });
    return saved;
  }

  /** Why people leave, what we offered and how it went, plus how many recovery e-mails went out. */
  @Get('summary')
  async summary(@Query('days') daysRaw = '90') {
    const days = Math.min(365, Math.max(7, Number(daysRaw) || 90));
    const since = new Date(Date.now() - days * 86_400_000);
    const inRange = gte(cancellationFeedback.createdAt, since);

    const byReason = await this.db
      .select({
        reason: cancellationFeedback.reason,
        total: sql<number>`count(*)::int`,
        offered: sql<number>`count(*) filter (where ${cancellationFeedback.offerKind} is not null)::int`,
        accepted: sql<number>`count(*) filter (where ${cancellationFeedback.outcome} = 'accepted')::int`,
        cancelled: sql<number>`count(*) filter (where ${cancellationFeedback.outcome} in ('declined','cancelled'))::int`,
      })
      .from(cancellationFeedback)
      .where(inRange)
      .groupBy(cancellationFeedback.reason)
      .orderBy(desc(sql`count(*)`));

    const [totals] = await this.db
      .select({
        started: sql<number>`count(*)::int`,
        accepted: sql<number>`count(*) filter (where ${cancellationFeedback.outcome} = 'accepted')::int`,
        cancelled: sql<number>`count(*) filter (where ${cancellationFeedback.outcome} in ('declined','cancelled'))::int`,
        keptListCents: sql<number>`coalesce(sum(${cancellationFeedback.amountCents}) filter (where ${cancellationFeedback.outcome} = 'accepted'), 0)::int`,
      })
      .from(cancellationFeedback)
      .where(inRange);

    const recent = await this.db
      .select({
        id: cancellationFeedback.id,
        email: users.email,
        reason: cancellationFeedback.reason,
        comment: cancellationFeedback.comment,
        offerKind: cancellationFeedback.offerKind,
        outcome: cancellationFeedback.outcome,
        planLabel: cancellationFeedback.planLabel,
        amountCents: cancellationFeedback.amountCents,
        createdAt: cancellationFeedback.createdAt,
      })
      .from(cancellationFeedback)
      .leftJoin(users, eq(users.id, cancellationFeedback.userId))
      .where(and(inRange))
      .orderBy(desc(cancellationFeedback.createdAt))
      .limit(50);

    const emails = await this.db
      .select({ kind: reminderEmailsSent.kind, n: sql<number>`count(*)::int` })
      .from(reminderEmailsSent)
      .where(and(inArray(reminderEmailsSent.kind, EMAIL_KINDS), gte(reminderEmailsSent.sentAt, since)))
      .groupBy(reminderEmailsSent.kind);

    return {
      days,
      totals: totals ?? { started: 0, accepted: 0, cancelled: 0, keptListCents: 0 },
      byReason,
      recent,
      emails: Object.fromEntries(emails.map((e) => [e.kind, e.n])),
    };
  }
}
