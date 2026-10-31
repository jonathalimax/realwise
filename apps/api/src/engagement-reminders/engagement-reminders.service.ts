import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { setTimeout as sleep } from 'node:timers/promises';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { chatMessages, reminderEmailsSent, transactions, users } from '../db/schema';
import { computeAccess } from '../billing/access';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { periodKeyFor, pickReminder, type ReminderKind } from './reminder-rules';
import { WinbackService, type WinbackCode } from '../retention/winback.service';
import { BillSuggestionsService, type SuggestionRow } from '../bill-suggestions/bill-suggestions.service';
import { suggestionToken, unsubscribeToken } from './unsubscribe-token';

/** The install e-mail goes to everyone eligible the first time it runs: spread that wave out so the mail provider's rate limit is respected. */
const INSTALL_APP_MAX_PER_RUN = 150;
const INSTALL_APP_GAP_MS = 500;

@Injectable()
export class EngagementRemindersService {
  private readonly logger = new Logger(EngagementRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
    private readonly settings: AppSettingsService,
    private readonly suggestions: BillSuggestionsService,
    private readonly winback: WinbackService,
  ) {}

  async runForAllUsers(now = new Date()): Promise<{ sent: number; skipped: number }> {
    const { engagement } = await this.settings.getEmails();
    const rows = await this.db.select().from(users).where(eq(users.reminderEmailsOptOut, false));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let sent = 0;
    let skipped = 0;
    let installSent = 0;

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

        const [chat] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(chatMessages)
          .where(and(eq(chatMessages.userId, user.id), eq(chatMessages.role, 'user'), gte(chatMessages.createdAt, new Date(now.getTime() - 24 * 3_600_000))));

        const [install] = await this.db
          .select({ id: reminderEmailsSent.id })
          .from(reminderEmailsSent)
          .where(and(eq(reminderEmailsSent.userId, user.id), eq(reminderEmailsSent.kind, 'install_app')))
          .limit(1);

        const baseKind = pickReminder({
          access,
          trialStartedAt: user.premiumAccessStartedAt ?? user.createdAt,
          trialEndsAt: user.premiumAccessEndsAt,
          transactionCount: counts?.total ?? 0,
          transactionsThisMonth: counts?.thisMonth ?? 0,
          chattedRecently: (chat?.n ?? 0) > 0,
          lostAt: user.subscriptionStatus ? user.subscriptionCurrentPeriodEnd : user.premiumAccessEndsAt,
          installAppSent: Boolean(install),
          now,
        });
        let kind: ReminderKind | null = baseKind;
        let suggestion: SuggestionRow | null = null;
        // Nothing urgent to say: maybe Elio noticed a monthly payment worth a reminder (detection runs weekly per user).
        if (!kind && access.allowed && engagement.kinds.bill_suggestion.enabled) {
          await this.suggestions.detectIfDue(user, now);
          suggestion = await this.suggestions.nextToEmail(user.id, 14, now);
          if (suggestion) kind = 'bill_suggestion';
        }
        if (!kind || !engagement.kinds[kind].enabled) continue;
        if (kind === 'install_app' && installSent >= INSTALL_APP_MAX_PER_RUN) continue; // the rest go out on the next eligible day

        // Never two reminders inside 20h, whatever the kind.
        const recent = await this.db
          .select({ id: reminderEmailsSent.id })
          .from(reminderEmailsSent)
          .where(
            and(eq(reminderEmailsSent.userId, user.id), gte(reminderEmailsSent.sentAt, new Date(now.getTime() - 20 * 3_600_000))),
          )
          .limit(1);
        if (recent.length) { skipped++; continue; }

        const periodKey = periodKeyFor(kind, now, user.premiumAccessEndsAt, suggestion?.id, access.currentPeriodEnd);

        // The 30- and 60-day win-back e-mails carry a personal code. It is created only when this e-mail is really
        // due (not already sent), so the hourly job never piles up unused codes in Stripe.
        let promo: WinbackCode | undefined;
        if (kind === 'winback_30' || kind === 'winback_60') {
          const [already] = await this.db
            .select({ id: reminderEmailsSent.id })
            .from(reminderEmailsSent)
            .where(and(eq(reminderEmailsSent.userId, user.id), eq(reminderEmailsSent.kind, kind), eq(reminderEmailsSent.periodKey, periodKey)))
            .limit(1);
          if (already) { skipped++; continue; }
          promo = (await this.winback.createCode(user)) ?? undefined;
          if (!promo) { skipped++; continue; } // Stripe unavailable: try again next hour, nothing was claimed
        }

        // Claim first (unique index), send second: a crash can drop one email but can never double-send.
        const claimed = await this.db
          .insert(reminderEmailsSent)
          .values({ userId: user.id, kind, periodKey })
          .onConflictDoNothing()
          .returning({ id: reminderEmailsSent.id });
        if (!claimed.length) { skipped++; continue; }

        await this.notifications.sendEngagementEmail(user.email, kind, {
          name: (user.name ?? '').split(' ')[0] || 'tudo bem',
          trialDaysRemaining: access.trialDaysRemaining,
          unsubscribeUserId: user.id,
          unsubscribeToken: unsubscribeToken(user.id),
          now,
          clientId: user.clientId,
          promo,
          suggestion: suggestion
            ? {
                id: suggestion.id,
                name: suggestion.name,
                amount: suggestion.amount,
                dayOfMonth: suggestion.dayOfMonth,
                dismissUrl: `${(process.env.API_BASE_URL ?? 'https://api.realwise.com.br').replace(/\/$/, '')}/reminders/suggestion/dismiss?u=${user.id}&s=${suggestion.id}&t=${suggestionToken(user.id, suggestion.id)}`,
              }
            : undefined,
        });
        if (suggestion) await this.suggestions.markEmailed(suggestion.id);
        sent++;
        if (kind === 'install_app') {
          installSent++;
          await sleep(INSTALL_APP_GAP_MS);
        }
      } catch (err) {
        this.logger.error(`reminder failed for user ${user.id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`[EngagementReminders] sent=${sent} skipped=${skipped} of ${rows.length}`);
    return { sent, skipped };
  }

  /**
   * The warm welcome, sent once when the person first opens the chat (the start of the interview). Never throws:
   * a failed e-mail must not break the chat. Honors the admin switches and the unsubscribe flag.
   */
  async sendWelcome(userId: string, now = new Date()): Promise<void> {
    try {
      const { engagement } = await this.settings.getEmails();
      if (!engagement.enabled || !engagement.kinds.welcome.enabled) return;
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));
      if (!user || user.reminderEmailsOptOut) return;
      const claimed = await this.db
        .insert(reminderEmailsSent)
        .values({ userId, kind: 'welcome', periodKey: 'once' })
        .onConflictDoNothing()
        .returning({ id: reminderEmailsSent.id });
      if (!claimed.length) return;
      const access = computeAccess(user, now);
      await this.notifications.sendEngagementEmail(user.email, 'welcome', {
        name: (user.name ?? '').split(' ')[0] || 'tudo bem',
        trialDaysRemaining: access.state === 'trial' ? access.trialDaysRemaining : 0,
        unsubscribeUserId: user.id,
        unsubscribeToken: unsubscribeToken(user.id),
        now,
        clientId: user.clientId,
      });
    } catch (err) {
      this.logger.error(`welcome e-mail failed for user ${userId}: ${(err as Error).message}`);
    }
  }

  async optOut(userId: string): Promise<void> {
    await this.db.update(users).set({ reminderEmailsOptOut: true }).where(eq(users.id, userId));
  }
}
