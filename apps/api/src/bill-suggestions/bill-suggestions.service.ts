import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { billSuggestions, bills, transactions, users } from '../db/schema';
import { BillsService } from '../bills/bills.service';
import { merchantKey } from '../chat/pattern';

const LOOKBACK_DAYS = 200;
const DETECT_EVERY_DAYS = 7;
const MIN_MONTHS = 3;
const MAX_AMOUNT_SPREAD = 0.12; // every charge within ±12% of the median
const MAX_DAY_SPREAD = 5; // the charge lands within a 5-day window each month
const MAX_SUGGESTIONS_PER_RUN = 5;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const titleCase = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .trim();

/** The next date (YYYY-MM-DD) on `day` of the month that is today or later; clamps to the month's length. */
export function nextDueDate(day: number, from = new Date()): string {
  const build = (year: number, month: number) => {
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, last)));
  };
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const today = Date.UTC(y, m, from.getUTCDate());
  let candidate = build(y, m);
  if (candidate.getTime() < today) candidate = build(y, m + 1);
  return candidate.toISOString().slice(0, 10);
}

export interface SuggestionRow {
  id: string;
  clientId: string;
  userId: string;
  name: string;
  amount: string;
  dayOfMonth: number;
  monthsSeen: number;
}

@Injectable()
export class BillSuggestionsService {
  private readonly logger = new Logger(BillSuggestionsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly billsService: BillsService,
  ) {}

  /**
   * Looks for payments that repeat every month (same merchant, similar amount, similar day, 3+ different months)
   * that the user has no bill for yet. Runs at most weekly per user. Returns how many new suggestions it stored.
   */
  async detectIfDue(user: { id: string; clientId: string; billDetectionAt: Date | null }, now = new Date()): Promise<number> {
    if (user.billDetectionAt && now.getTime() - user.billDetectionAt.getTime() < DETECT_EVERY_DAYS * 86_400_000) return 0;
    // Stamp first so a failure below is retried next week instead of on every daily run.
    await this.db.update(users).set({ billDetectionAt: now }).where(eq(users.id, user.id));

    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.db
      .select({
        description: transactions.description,
        amount: transactions.amount,
        date: transactions.date,
        category: transactions.category,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, 'expense'),
          isNull(transactions.deletedAt),
          eq(transactions.ignored, false),
          eq(transactions.isTransfer, false),
          gte(transactions.date, since),
        ),
      );

    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = merchantKey(r.description ?? '').toLowerCase();
      if (key.length < 3) continue;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }

    const [existingBills, existingSuggestions] = await Promise.all([
      this.db
        .select({ name: bills.name })
        .from(bills)
        .where(and(eq(bills.userId, user.id), isNull(bills.deletedAt))),
      this.db.select({ key: billSuggestions.merchantKey }).from(billSuggestions).where(eq(billSuggestions.userId, user.id)),
    ]);
    const billKeys = existingBills.map((b) => merchantKey(b.name).toLowerCase()).filter((k) => k.length >= 3);
    const taken = new Set(existingSuggestions.map((s) => s.key));
    const today = now.getTime();

    const found: { key: string; row: typeof billSuggestions.$inferInsert; lastSeen: number }[] = [];
    for (const [key, list] of groups) {
      if (taken.has(key)) continue;
      if (billKeys.some((b) => b === key || b.includes(key) || key.includes(b))) continue;

      const months = new Set(list.map((r) => String(r.date).slice(0, 7)));
      if (months.size < MIN_MONTHS) continue;
      const amounts = list.map((r) => Number(r.amount));
      const med = median(amounts);
      if (!(med > 0) || amounts.some((a) => Math.abs(a - med) / med > MAX_AMOUNT_SPREAD)) continue;
      const days = list.map((r) => Number(String(r.date).slice(8, 10)));
      if (Math.max(...days) - Math.min(...days) > MAX_DAY_SPREAD) continue;
      const lastSeen = Math.max(...list.map((r) => new Date(String(r.date)).getTime()));
      if (today - lastSeen > 50 * 86_400_000) continue; // stopped paying it

      const newest = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      found.push({
        key,
        lastSeen,
        row: {
          clientId: user.clientId,
          userId: user.id,
          merchantKey: key,
          name: titleCase(merchantKey(newest.description ?? '')),
          amount: med.toFixed(2),
          dayOfMonth: Math.round(median(days)),
          monthsSeen: months.size,
          category: newest.category ?? null,
          categoryId: newest.categoryId ?? null,
        },
      });
    }

    const best = found.sort((a, b) => b.row.monthsSeen! - a.row.monthsSeen! || b.lastSeen - a.lastSeen).slice(0, MAX_SUGGESTIONS_PER_RUN);
    if (best.length === 0) return 0;
    const inserted = await this.db.insert(billSuggestions).values(best.map((b) => b.row)).onConflictDoNothing().returning({ id: billSuggestions.id });
    this.logger.log(`[BillSuggestions] ${inserted.length} new suggestion(s) for user ${user.id}`);
    return inserted.length;
  }

  /** The best pending suggestion for the user, unless one was already emailed in the last `gapDays` days. */
  async nextToEmail(userId: string, gapDays = 14, now = new Date()): Promise<SuggestionRow | null> {
    const since = new Date(now.getTime() - gapDays * 86_400_000);
    const [recent] = await this.db
      .select({ id: billSuggestions.id })
      .from(billSuggestions)
      .where(and(eq(billSuggestions.userId, userId), gte(billSuggestions.emailedAt, since)))
      .limit(1);
    if (recent) return null;
    const [row] = await this.db
      .select()
      .from(billSuggestions)
      .where(and(eq(billSuggestions.userId, userId), eq(billSuggestions.status, 'pending')))
      .orderBy(desc(billSuggestions.monthsSeen), desc(billSuggestions.createdAt))
      .limit(1);
    return row ?? null;
  }

  async markEmailed(id: string): Promise<void> {
    await this.db.update(billSuggestions).set({ status: 'emailed', emailedAt: new Date() }).where(eq(billSuggestions.id, id));
  }

  async dismiss(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .update(billSuggestions)
      .set({ status: 'dismissed', resolvedAt: new Date() })
      .where(and(eq(billSuggestions.id, id), eq(billSuggestions.userId, userId), ne(billSuggestions.status, 'accepted')))
      .returning({ id: billSuggestions.id });
    return rows.length > 0;
  }

  /**
   * The user said yes: create the monthly bill. Idempotent (an accepted suggestion returns the same bill info
   * with `alreadyCreated`), and refuses anything that does not belong to the user.
   */
  async accept(scope: { clientId: string; userId: string }, id: string) {
    const [s] = await this.db
      .select()
      .from(billSuggestions)
      .where(and(eq(billSuggestions.id, id), eq(billSuggestions.userId, scope.userId)));
    if (!s) throw new NotFoundException('Suggestion not found');
    const info = { name: s.name, amount: Number(s.amount), dayOfMonth: s.dayOfMonth, dueDate: nextDueDate(s.dayOfMonth) };
    if (s.status === 'accepted') return { ...info, alreadyCreated: true };

    await this.billsService.create(
      {
        name: s.name,
        amount: s.amount,
        dueDate: info.dueDate,
        recurrence: 'monthly',
        ...(s.categoryId ? { categoryId: s.categoryId } : {}),
        description: 'Criado pelo Elio a partir dos seus pagamentos recorrentes',
      },
      scope.clientId,
      scope.userId,
    );
    await this.db.update(billSuggestions).set({ status: 'accepted', resolvedAt: new Date() }).where(eq(billSuggestions.id, id));
    return { ...info, alreadyCreated: false };
  }

  async pendingCount(userId: string): Promise<number> {
    const [r] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(billSuggestions)
      .where(and(eq(billSuggestions.userId, userId), inArray(billSuggestions.status, ['pending', 'emailed'])));
    return r?.n ?? 0;
  }
}
