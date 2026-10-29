import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, or, sql, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import {
  accounts,
  adminAuditLog,
  chatMessages,
  imports,
  llmCallLog,
  supportMessages,
  transactions,
  users,
} from '../db/schema';
import { AdminAuditService } from '../admin-common/admin-audit.service';
import { accessStateSql } from '../admin-common/access-sql';
import {
  likeContains,
  microCentsToUsd,
  parsePaging,
  RawQuery,
  startOfUtcMonth,
  str,
} from '../admin-common/admin-query.util';
import { AccessInfo, AccessState, computeAccess, hasLiveSubscription } from '../billing/access';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ACCOUNT_DELETION, AccountDeletion } from './account-deletion.token';
import { PlanActionDto, UpdateAdminUserDto } from './dto/admin-user.dto';

type UserRow = typeof users.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCESS_STATES: AccessState[] = ['owner', 'lifetime', 'subscribed', 'trial', 'blocked'];
const SORTS = ['createdAt', 'lastActiveAt', 'aiCost'] as const;

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  access: AccessInfo;
  aiCostMonthUsd: number;
  transactionCount: number;
  reminderEmailsOptOut: boolean;
  marketingEmailsOptOut: boolean;
  adminNote: string | null;
  llmBudgetOverrideUsd: number | null;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly audit: AdminAuditService,
    @Optional() @Inject(ACCOUNT_DELETION) private readonly deletion?: AccountDeletion,
  ) {}

  // ---------------------------------------------------------------- list

  async list(q: RawQuery) {
    const { page, pageSize, offset } = parsePaging(q);
    const search = str(q.search, 100);
    const stateParam = str(q.state, 20);
    if (stateParam && !ACCESS_STATES.includes(stateParam as AccessState)) {
      throw new BadRequestException(`state must be one of ${ACCESS_STATES.join(', ')}`);
    }
    const sortParam = str(q.sort, 20) ?? 'createdAt';
    if (!(SORTS as readonly string[]).includes(sortParam)) {
      throw new BadRequestException(`sort must be one of ${SORTS.join(', ')}`);
    }
    const orderParam = str(q.order, 4)?.toLowerCase();
    if (orderParam && orderParam !== 'asc' && orderParam !== 'desc') {
      throw new BadRequestException('order must be asc or desc');
    }
    const dir = (orderParam ?? 'desc') === 'asc' ? sql`asc` : sql`desc`;

    const conditions: SQL[] = [];
    if (search) {
      const pattern = likeContains(search);
      conditions.push(sql`(${users.email} ilike ${pattern} or ${users.name} ilike ${pattern})`);
    }
    if (stateParam) conditions.push(sql`${accessStateSql()} = ${stateParam}`);
    const where = conditions.length ? and(...conditions) : undefined;

    const monthStart = startOfUtcMonth(new Date());
    let rows: UserRow[];
    if (sortParam === 'aiCost') {
      // Only this sort needs the month's cost for every user; the other sorts fetch it for the page only.
      const ai = this.db
        .select({
          userId: llmCallLog.userId,
          cost: sql<string>`sum(${llmCallLog.costMicroCents})`.as('cost'),
        })
        .from(llmCallLog)
        .where(sql`${llmCallLog.createdAt} >= ${monthStart.toISOString()}::timestamptz`)
        .groupBy(llmCallLog.userId)
        .as('ai');
      const joined = await this.db
        .select({ user: users })
        .from(users)
        .leftJoin(ai, eq(ai.userId, users.id))
        .where(where)
        .orderBy(sql`coalesce(${ai.cost}, 0) ${dir}`, users.id)
        .limit(pageSize)
        .offset(offset);
      rows = joined.map((r) => r.user);
    } else {
      const column = sortParam === 'lastActiveAt' ? users.lastActiveAt : users.createdAt;
      rows = await this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(sql`${column} ${dir} nulls last`, users.id)
        .limit(pageSize)
        .offset(offset);
    }

    const [totalRow] = await this.db.select({ total: count() }).from(users).where(where);
    const ids = rows.map((r) => r.id);
    const [costs, txCounts] = await Promise.all([this.monthCosts(ids, monthStart), this.transactionCounts(ids)]);
    const now = new Date();
    const items = rows.map((u) => this.toListItem(u, now, costs.get(u.id) ?? 0, txCounts.get(u.id) ?? 0));
    return { items, total: totalRow?.total ?? 0, page, pageSize };
  }

  private async monthCosts(ids: string[], monthStart: Date): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ userId: llmCallLog.userId, cost: sql<string>`sum(${llmCallLog.costMicroCents})` })
      .from(llmCallLog)
      .where(and(inArray(llmCallLog.userId, ids), sql`${llmCallLog.createdAt} >= ${monthStart.toISOString()}::timestamptz`))
      .groupBy(llmCallLog.userId);
    return new Map(rows.map((r) => [r.userId, microCentsToUsd(r.cost)]));
  }

  private async transactionCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ userId: transactions.userId, total: count() })
      .from(transactions)
      .where(and(inArray(transactions.userId, ids), isNull(transactions.deletedAt)))
      .groupBy(transactions.userId);
    return new Map(rows.map((r) => [r.userId, r.total]));
  }

  private toListItem(u: UserRow, now: Date, aiCostMonthUsd: number, transactionCount: number): AdminUserListItem {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
      access: computeAccess(u, now),
      aiCostMonthUsd,
      transactionCount,
      reminderEmailsOptOut: u.reminderEmailsOptOut,
      marketingEmailsOptOut: u.marketingEmailsOptOut,
      adminNote: u.adminNote,
      llmBudgetOverrideUsd: u.llmBudgetOverrideUsd === null ? null : Number(u.llmBudgetOverrideUsd),
    };
  }

  // ---------------------------------------------------------------- detail

  async detail(id: string) {
    const user = await this.requireUser(id);
    const monthStart = startOfUtcMonth(new Date());
    const [costs, txCounts, accountCount, importCount, chatCount, recentCalls, support, auditRows] = await Promise.all([
      this.monthCosts([id], monthStart),
      this.transactionCounts([id]),
      this.db.select({ n: count() }).from(accounts).where(and(eq(accounts.userId, id), isNull(accounts.deletedAt))),
      this.db.select({ n: count() }).from(imports).where(eq(imports.userId, id)),
      this.db.select({ n: count() }).from(chatMessages).where(eq(chatMessages.userId, id)),
      this.db
        .select()
        .from(llmCallLog)
        .where(eq(llmCallLog.userId, id))
        .orderBy(desc(llmCallLog.createdAt))
        .limit(20),
      this.db
        .select()
        .from(supportMessages)
        .where(or(eq(supportMessages.userId, id), eq(supportMessages.email, user.email)))
        .orderBy(desc(supportMessages.createdAt))
        .limit(20),
      this.db
        .select()
        .from(adminAuditLog)
        .where(eq(adminAuditLog.targetUserId, id))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(50),
    ]);
    const now = new Date();
    const txCount = txCounts.get(id) ?? 0;
    return {
      ...this.toListItem(user, now, costs.get(id) ?? 0, txCount),
      counts: {
        accounts: accountCount[0]?.n ?? 0,
        transactions: txCount,
        imports: importCount[0]?.n ?? 0,
        chatMessages: chatCount[0]?.n ?? 0,
      },
      premium: {
        status: user.premiumStatus,
        startedAt: user.premiumAccessStartedAt?.toISOString() ?? null,
        endsAt: user.premiumAccessEndsAt?.toISOString() ?? null,
        purchasedAt: user.premiumPurchasedAt?.toISOString() ?? null,
      },
      subscription: {
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
      },
      recentLlmCalls: recentCalls.map((c) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        purpose: c.purpose,
        provider: c.provider,
        model: c.model,
        inputTokens: c.inputTokens,
        outputTokens: c.outputTokens,
        costUsd: microCentsToUsd(c.costMicroCents),
        latencyMs: c.latencyMs,
        error: c.error ? c.error.slice(0, 500) : null,
      })),
      supportMessages: support.map((m) => ({
        id: m.id,
        subject: m.subject,
        message: m.message,
        status: m.status,
        source: m.source,
        adminReply: m.adminReply,
        repliedAt: m.repliedAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      audit: auditRows.map((a) => ({
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        adminEmail: a.adminEmail,
        action: a.action,
        details: a.details,
      })),
    };
  }

  // ---------------------------------------------------------------- update

  async update(id: string, dto: UpdateAdminUserDto, actor: JwtPayload) {
    const user = await this.requireUser(id);
    const set: Partial<typeof users.$inferInsert> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const change = (key: string, from: unknown, to: unknown) => {
      if (from !== to) changes[key] = { from, to };
    };

    if (dto.name !== undefined) {
      const name = dto.name === null ? null : dto.name.trim() || null;
      set.name = name;
      change('name', user.name, name);
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== user.email) {
        if (this.isProtected(user)) {
          throw new ForbiddenException('The e-mail of an admin/owner account cannot be changed here.');
        }
        set.email = email;
        change('email', user.email, email);
      }
    }
    if (dto.adminNote !== undefined) {
      const note = dto.adminNote === null ? null : dto.adminNote.trim() || null;
      set.adminNote = note;
      change('adminNote', user.adminNote, note);
    }
    if (dto.reminderEmailsOptOut !== undefined) {
      set.reminderEmailsOptOut = dto.reminderEmailsOptOut;
      change('reminderEmailsOptOut', user.reminderEmailsOptOut, dto.reminderEmailsOptOut);
    }
    if (dto.marketingEmailsOptOut !== undefined) {
      set.marketingEmailsOptOut = dto.marketingEmailsOptOut;
      change('marketingEmailsOptOut', user.marketingEmailsOptOut, dto.marketingEmailsOptOut);
    }
    if (dto.llmBudgetOverrideUsd !== undefined) {
      const value = dto.llmBudgetOverrideUsd;
      set.llmBudgetOverrideUsd = value === null ? null : value.toFixed(4);
      change('llmBudgetOverrideUsd', user.llmBudgetOverrideUsd === null ? null : Number(user.llmBudgetOverrideUsd), value);
    }

    if (Object.keys(set).length > 0) {
      try {
        await this.db.update(users).set({ ...set, updatedAt: new Date() }).where(eq(users.id, id));
      } catch (e) {
        const pg = (e as { code?: string; cause?: { code?: string } });
        if (pg.code === '23505' || pg.cause?.code === '23505') {
          throw new ConflictException('Another user already has this e-mail.');
        }
        throw e;
      }
      if (Object.keys(changes).length > 0) {
        await this.recordAudit(actor, 'user.update', user, { changes });
      }
    }
    return this.detail(id);
  }

  // ---------------------------------------------------------------- plan

  async changePlan(id: string, dto: PlanActionDto, actor: JwtPayload) {
    const user = await this.requireUser(id);
    if (this.isProtected(user)) {
      throw new ForbiddenException('Plan changes are not allowed on admin/owner accounts.');
    }
    const now = new Date();
    const before = computeAccess(user, now);
    const set: Partial<typeof users.$inferInsert> = { updatedAt: now };
    let details: Record<string, unknown> = {};

    switch (dto.action) {
      case 'extend_trial':
      case 'start_trial': {
        if (!dto.days) throw new BadRequestException('days is required (1-365).');
        if (before.state === 'lifetime') {
          throw new ConflictException('This user already has lifetime access; a trial would replace it.');
        }
        if (hasLiveSubscription(user)) {
          throw new ConflictException('This user has a live Stripe subscription; a trial does not apply.');
        }
        const currentEnd = user.premiumAccessEndsAt;
        const running = user.premiumStatus === 'trialing' && currentEnd !== null && currentEnd > now;
        // extend_trial adds to a running trial; start_trial always restarts from now.
        const base = dto.action === 'extend_trial' && running ? currentEnd : now;
        const endsAt = new Date(base.getTime() + dto.days * DAY_MS);
        set.premiumStatus = 'trialing';
        set.premiumAccessEndsAt = endsAt;
        if (!running || !user.premiumAccessStartedAt) set.premiumAccessStartedAt = now;
        details = { days: dto.days, endsAt: endsAt.toISOString() };
        break;
      }
      case 'grant_until': {
        if (!dto.until) throw new BadRequestException('until is required (YYYY-MM-DD).');
        if (before.state === 'lifetime') {
          throw new ConflictException('This user already has lifetime access; a time-limited grant would replace it.');
        }
        if (hasLiveSubscription(user)) {
          throw new ConflictException('This user has a live Stripe subscription; a free grant does not apply.');
        }
        // Access runs through the end of the chosen day in Brasília (UTC-3, no DST).
        const endsAt = new Date(`${dto.until}T23:59:59-03:00`);
        if (Number.isNaN(endsAt.getTime()) || endsAt <= now) {
          throw new BadRequestException('until must be a valid date in the future.');
        }
        if (endsAt.getTime() - now.getTime() > 5 * 365 * DAY_MS) {
          throw new BadRequestException('until cannot be more than 5 years away; use lifetime instead.');
        }
        // Same storage as a trial: premiumStatus 'trialing' + premiumAccessEndsAt (see computeAccess).
        set.premiumStatus = 'trialing';
        set.premiumAccessEndsAt = endsAt;
        if (!user.premiumAccessStartedAt) set.premiumAccessStartedAt = now;
        details = { until: dto.until, endsAt: endsAt.toISOString() };
        break;
      }
      case 'grant_lifetime': {
        if (hasLiveSubscription(user)) {
          throw new ConflictException(
            'This user has a live Stripe subscription. Cancel it in Stripe first, otherwise they would keep being billed.',
          );
        }
        // Lifetime state = premium_status 'active' with no Stripe subscription id: drop any ended subscription.
        set.premiumStatus = 'active';
        set.premiumAccessEndsAt = null;
        set.premiumPurchasedAt = now;
        set.premiumPaymentProvider = 'admin';
        set.premiumProviderPaymentId = null;
        if (!user.premiumAccessStartedAt) set.premiumAccessStartedAt = now;
        set.stripeSubscriptionId = null;
        set.subscriptionStatus = null;
        set.subscriptionPlan = null;
        set.subscriptionCurrentPeriodEnd = null;
        set.subscriptionCancelAtPeriodEnd = false;
        break;
      }
      case 'revoke': {
        if (hasLiveSubscription(user)) {
          throw new ConflictException(
            'This user has a live Stripe subscription. Cancel it in Stripe (or have the user cancel) before revoking access.',
          );
        }
        if (before.state === 'subscribed') {
          throw new ConflictException(
            'This user is still covered by a paid Stripe period (or past-due grace); revoking now would not remove access.',
          );
        }
        set.premiumStatus = 'expired';
        set.premiumAccessEndsAt = now;
        break;
      }
    }

    await this.db.update(users).set(set).where(eq(users.id, id));
    const [fresh] = await this.db.select().from(users).where(eq(users.id, id));
    const access = computeAccess(fresh ?? null, new Date());
    await this.recordAudit(actor, `user.plan.${dto.action}`, user, {
      ...details,
      from: before.state,
      to: access.state,
    });
    return { id, access };
  }

  // ---------------------------------------------------------------- delete

  async remove(id: string, actor: JwtPayload) {
    const user = await this.requireUser(id);
    if (this.isProtected(user) || id === actor.sub) {
      throw new ForbiddenException('Admin/owner accounts cannot be deleted from the admin.');
    }
    if (!this.deletion) {
      throw new ServiceUnavailableException('Account deletion is not available yet.');
    }
    // Audit first: the user row (and its e-mail) will be gone afterwards.
    await this.recordAudit(actor, 'user.delete', user, { email: user.email });
    await this.deletion.deleteUser(id);
    return { ok: true };
  }

  // ---------------------------------------------------------------- helpers

  private isProtected(user: UserRow): boolean {
    return computeAccess(user, new Date()).state === 'owner';
  }

  private async requireUser(id: string): Promise<UserRow> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('User not found');
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async recordAudit(actor: JwtPayload, action: string, target: UserRow, details: Record<string, unknown>) {
    const [admin] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, actor.sub));
    await this.audit.record({
      adminUserId: actor.sub,
      adminEmail: admin?.email ?? null,
      action,
      targetUserId: target.id,
      targetLabel: target.email,
      details,
    });
  }
}
