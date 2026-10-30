import { randomBytes } from 'crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { accounts, bills, categories, financialSummaries, planner, transactions, users } from '../db/schema';
import { brtNow } from '../bill-suggestions/bill-suggestions.service';
import { computeAccess } from '../billing/access';
import { NotificationsService } from '../notifications/notifications.service';
import { unsubscribeToken } from '../engagement-reminders/unsubscribe-token';
import { buildSummaryEmail } from './summary-email';
import { addMonths, computeSummary } from './summary-metrics';
import type { BillRow, CardRow, PlannerMonth, SummaryKind, SummaryPayload, TxRow } from './summary.types';

type User = typeof users.$inferSelect;
type Deduction = { type?: string; amount?: number };
interface PlannerVersion {
  from?: string;
  salarioBruto?: number;
  salarioDeductions?: Deduction[];
  salarioBenefits?: Deduction[];
  allocation?: { necessidades?: number; desejos?: number; poupanca?: number };
}

const LINK_DAYS = 30;
const EMAIL_GAP_MS = 600; // stay under the mail provider's per-second limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const resolve = (gross: number, d: Deduction) => (d.type === 'pct' ? (gross * Number(d.amount ?? 0)) / 100 : Number(d.amount ?? 0));

/** Planned take-home income and the 50/30/20 split for a month, as the planner screen computes them. */
function plannerMonth(versions: PlannerVersion[], month: string): PlannerMonth | null {
  const v = versions.find((x) => x.from === month);
  const gross = Number(v?.salarioBruto ?? 0);
  if (!v || gross <= 0) return null;
  const net = gross - (v.salarioDeductions ?? []).reduce((s, d) => s + resolve(gross, d), 0) + (v.salarioBenefits ?? []).reduce((s, d) => s + resolve(gross, d), 0);
  const a = v.allocation ?? {};
  return { net, allocation: { necessidades: Number(a.necessidades ?? 70), desejos: Number(a.desejos ?? 10), poupanca: Number(a.poupanca ?? 20) } };
}

export interface GeneratedSummary {
  id: string;
  token: string;
  url: string;
  payload: SummaryPayload;
}

/**
 * Builds, stores and sends the financial summary. All figures come from `computeSummary` (pure, no model); this class
 * only loads the rows it needs, keeps the private link stable per period, and decides who receives what and when.
 */
@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  private pageUrl(token: string): string {
    return `${(process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/+$/, '')}/resumo/${token}`;
  }

  private async loadUser(userId: string): Promise<User> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async emailOf(userId: string): Promise<{ email: string }[]> {
    return this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  }

  /** Computes a summary for a user without storing it. */
  async compute(user: User, kind: SummaryKind, which: 'last' | 'this' = 'last', now = new Date()): Promise<{ payload: SummaryPayload; period: string }> {
    const today = brtNow(now).toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);
    const trial = kind === 'trial_end';
    const month = trial || which === 'this' ? currentMonth : addMonths(currentMonth, -1);
    const partial = !trial && month === currentMonth; // the month is still running

    const from = trial
      ? (user.premiumAccessStartedAt ?? user.createdAt).toISOString().slice(0, 10)
      : `${addMonths(month, -7)}-01`;
    const to = trial ? today : `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
    const scope = { clientId: user.clientId, userId: user.id };

    const [txRows, cardRows, billRows, plannerRows] = await Promise.all([
      this.db
        .select({
          date: transactions.date,
          type: transactions.type,
          amount: transactions.amount,
          name: sql<string | null>`coalesce(${categories.name}, ${transactions.category})`,
          bankId: transactions.bankId,
          paymentMethod: transactions.paymentMethod,
          investmentId: transactions.investmentId,
          goalId: transactions.goalId,
        })
        .from(transactions)
        .leftJoin(categories, eq(categories.id, transactions.categoryId))
        .where(and(eq(transactions.clientId, scope.clientId), eq(transactions.userId, scope.userId), isNull(transactions.deletedAt), eq(transactions.ignored, false), gte(transactions.date, from), lte(transactions.date, to)))
        .orderBy(asc(transactions.date)),
      this.db.select().from(accounts).where(and(eq(accounts.clientId, scope.clientId), eq(accounts.userId, scope.userId), isNull(accounts.deletedAt))),
      this.db.select().from(bills).where(and(eq(bills.clientId, scope.clientId), eq(bills.userId, scope.userId), isNull(bills.deletedAt))),
      this.db.select().from(planner).where(and(eq(planner.clientId, scope.clientId), eq(planner.userId, scope.userId))),
    ]);

    const txs: TxRow[] = txRows.map((r) => ({
      date: String(r.date).slice(0, 10),
      type: r.type === 'income' ? 'income' : 'expense',
      amount: Number(r.amount),
      category: r.name,
      bankId: r.bankId,
      paymentMethod: r.paymentMethod,
      investmentId: r.investmentId,
      goalId: r.goalId,
    }));
    const cards: CardRow[] = cardRows.map((a) => ({ id: a.id, bankId: a.bankId, hasCredit: Boolean(a.hasCredit), closingDay: a.closingDay, paymentDay: a.paymentDay }));
    const billList: BillRow[] = billRows.map((b) => ({ name: b.name, amount: Number(b.amount), dueDate: String(b.dueDate).slice(0, 10), status: b.status }));
    const versions = ((plannerRows[0]?.state as { plannerVersions?: PlannerVersion[] } | null)?.plannerVersions ?? []) as PlannerVersion[];

    const payload = computeSummary({
      kind,
      month,
      today,
      firstName: (user.name ?? '').trim().split(/\s+/)[0] || null,
      transactions: txs,
      cards,
      bills: billList,
      planner: plannerMonth(versions, month),
      plannerPrev: plannerMonth(versions, addMonths(month, -1)),
      partial,
      trialWindow: trial ? { from, to } : undefined,
    });
    return { payload, period: trial ? 'trial' : month };
  }

  /** Computes and stores (or refreshes) the summary; the private link stays the same for a given user and period. */
  async generate(userId: string, kind: SummaryKind, which: 'last' | 'this' = 'last'): Promise<GeneratedSummary> {
    const user = await this.loadUser(userId);
    const { payload, period } = await this.compute(user, kind, which);
    const expiresAt = new Date(Date.now() + LINK_DAYS * 86400000);
    const token = randomBytes(24).toString('base64url');
    const [row] = await this.db
      .insert(financialSummaries)
      .values({ userId: user.id, clientId: user.clientId, kind, period, token, tone: payload.tone, score: payload.score, payload, expiresAt })
      .onConflictDoUpdate({
        target: [financialSummaries.userId, financialSummaries.kind, financialSummaries.period],
        set: { tone: payload.tone, score: payload.score, payload, expiresAt, updatedAt: new Date() },
      })
      .returning({ id: financialSummaries.id, token: financialSummaries.token });
    return { id: row.id, token: row.token, url: this.pageUrl(row.token), payload };
  }

  /** What the private page shows. The token is the secret; expired or unknown links answer 404. */
  async byToken(token: string): Promise<{ payload: SummaryPayload; kind: string; generatedAt: Date; clientId: string } | null> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
    const [row] = await this.db.select().from(financialSummaries).where(eq(financialSummaries.token, token)).limit(1);
    if (!row || row.expiresAt.getTime() < Date.now()) return null;
    if (!row.openedAt) await this.db.update(financialSummaries).set({ openedAt: new Date() }).where(eq(financialSummaries.id, row.id));
    return { payload: row.payload as SummaryPayload, kind: row.kind, generatedAt: row.updatedAt, clientId: row.clientId };
  }

  /** Generates (if needed) and e-mails a summary. Returns false when it was skipped (already sent, opted out). */
  async send(userId: string, kind: SummaryKind, opts: { which?: 'last' | 'this'; force?: boolean; toOverride?: string } = {}): Promise<boolean> {
    const user = await this.loadUser(userId);
    if (user.reminderEmailsOptOut && !opts.force) return false;
    const generated = await this.generate(userId, kind, opts.which ?? 'last');
    const [row] = await this.db.select({ sentAt: financialSummaries.sentAt }).from(financialSummaries).where(eq(financialSummaries.id, generated.id)).limit(1);
    if (row?.sentAt && !opts.force) return false;

    const api = (process.env.API_BASE_URL ?? 'https://api.realwise.com.br').replace(/\/+$/, '');
    const unsubscribeUrl = `${api}/reminders/unsubscribe?u=${user.id}&t=${unsubscribeToken(user.id)}`;
    const mail = buildSummaryEmail(generated.payload, generated.url, unsubscribeUrl);
    await this.notifications.sendSummaryEmail(opts.toOverride ?? user.email, { ...mail, unsubscribeUrl });
    await this.db.update(financialSummaries).set({ sentAt: new Date() }).where(eq(financialSummaries.id, generated.id));
    return true;
  }

  // ───────────────────────────── scheduled runs ─────────────────────────────

  private async hasTransactions(userId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt))).limit(1);
    return Boolean(row);
  }

  /** Early in the month: the recap of the month that just closed, once per user. */
  async runMonthly(now = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
    const rows = await this.db.select().from(users).where(eq(users.reminderEmailsOptOut, false));
    const result = { sent: 0, skipped: 0, failed: 0 };
    for (const user of rows) {
      try {
        const access = computeAccess(user, now);
        if (!access.allowed || !(await this.hasTransactions(user.id))) {
          result.skipped++;
          continue;
        }
        if (await this.send(user.id, 'monthly', { which: 'last' })) {
          result.sent++;
          await sleep(EMAIL_GAP_MS);
        } else result.skipped++;
      } catch (error) {
        result.failed++;
        this.logger.error(`Monthly summary failed for ${user.id}: ${String(error)}`);
      }
    }
    this.logger.log(`Monthly summaries: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);
    return result;
  }

  /** The recap of what Elio found, sent when the trial has between one and two days left (the "ends tomorrow" reminder comes after). */
  async runTrialEnding(now = new Date()): Promise<{ sent: number }> {
    const rows = await this.db.select().from(users).where(and(eq(users.reminderEmailsOptOut, false), eq(users.premiumStatus, 'trialing')));
    let sent = 0;
    for (const user of rows) {
      try {
        const access = computeAccess(user, now);
        const left = (user.premiumAccessEndsAt?.getTime() ?? 0) - now.getTime();
        if (access.state !== 'trial' || left > 48 * 3600000 || left <= 24 * 3600000) continue;
        if (!(await this.hasTransactions(user.id))) continue;
        if (await this.send(user.id, 'trial_end')) {
          sent++;
          await sleep(EMAIL_GAP_MS);
        }
      } catch (error) {
        this.logger.error(`Trial summary failed for ${user.id}: ${String(error)}`);
      }
    }
    return { sent };
  }

  /** Links older than their expiry are useless; drop the rows after a grace period. */
  async purgeExpired(): Promise<void> {
    await this.db.execute(sql`delete from ${financialSummaries} where ${financialSummaries.expiresAt} < now() - interval '60 days'`);
  }
}
