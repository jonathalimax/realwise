import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { reminderEmailsSent, transactions, users } from '../db/schema';
import { computeAccess } from '../billing/access';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { periodKeyFor, pickReminder } from './reminder-rules';
import { unsubscribeToken } from './unsubscribe-token';

@Injectable()
export class EngagementRemindersService {
  private readonly logger = new Logger(EngagementRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
    private readonly settings: AppSettingsService,
  ) {}

  async runForAllUsers(now = new Date()): Promise<{ sent: number; skipped: number }> {
    const { engagement } = await this.settings.getEmails();
    const rows = await this.db.select().from(users).where(eq(users.reminderEmailsOptOut, false));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let sent = 0;
    let skipped = 0;

    for (const user of rows) {
      try {
        const access = computeAccess(user, now);
        const [counts] = await this.db
          .select({
            total: sql<number>`count(*)::int`,
            thisMonth: sql<number>`count(*) filter (where ${transactions.createdAt} >= ${monthStart.toISOString()}::timestamptz)::int`,
          })
          .from(transactions)
          .where(and(eq(transactions.userId, user.id), isNull(transactions.deletedAt)));

        const kind = pickReminder({
          access,
          trialStartedAt: user.premiumAccessStartedAt ?? user.createdAt,
          trialEndsAt: user.premiumAccessEndsAt,
          transactionCount: counts?.total ?? 0,
          transactionsThisMonth: counts?.thisMonth ?? 0,
          now,
        });
        if (!kind || !engagement.kinds[kind].enabled) continue;

        // Never two reminders inside 20h, whatever the kind.
        const recent = await this.db
          .select({ id: reminderEmailsSent.id })
          .from(reminderEmailsSent)
          .where(
            and(eq(reminderEmailsSent.userId, user.id), gte(reminderEmailsSent.sentAt, new Date(now.getTime() - 20 * 3_600_000))),
          )
          .limit(1);
        if (recent.length) { skipped++; continue; }

        // Claim first (unique index), send second: a crash can drop one email but can never double-send.
        const claimed = await this.db
          .insert(reminderEmailsSent)
          .values({ userId: user.id, kind, periodKey: periodKeyFor(kind, now, user.premiumAccessEndsAt) })
          .onConflictDoNothing()
          .returning({ id: reminderEmailsSent.id });
        if (!claimed.length) { skipped++; continue; }

        await this.notifications.sendEngagementEmail(user.email, kind, {
          name: (user.name ?? '').split(' ')[0] || 'tudo bem',
          trialDaysRemaining: access.trialDaysRemaining,
          unsubscribeUserId: user.id,
          unsubscribeToken: unsubscribeToken(user.id),
          now,
        });
        sent++;
      } catch (err) {
        this.logger.error(`reminder failed for user ${user.id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`[EngagementReminders] sent=${sent} skipped=${skipped} of ${rows.length}`);
    return { sent, skipped };
  }

  async optOut(userId: string): Promise<void> {
    await this.db.update(users).set({ reminderEmailsOptOut: true }).where(eq(users.id, userId));
  }
}
