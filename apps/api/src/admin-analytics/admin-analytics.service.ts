import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, SQL, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { adminAuditLog, chatMessages, imports, llmCallLog, transactions, users } from '../db/schema';
import { accessStateSql } from '../admin-common/access-sql';
import {
  ADMIN_TZ,
  likeContains,
  microCentsToUsd,
  parseInteger,
  parsePaging,
  parseUuid,
  RawQuery,
  startOfBrtDay,
  str,
  ts,
} from '../admin-common/admin-query.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = sql.raw(`'${ADMIN_TZ}'`);

/**
 * List prices in BRL cents used for MRR. They mirror the Stripe prices (R$ 8,99 / month and
 * R$ 74,90 / year); override with ADMIN_PRICE_MONTHLY_CENTS / ADMIN_PRICE_ANNUAL_CENTS if Stripe changes.
 * Discounts from promotion codes are not reflected (admin sees list-price MRR).
 */
function priceCents(): { monthly: number; annual: number } {
  const read = (name: string, def: number) => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return { monthly: read('ADMIN_PRICE_MONTHLY_CENTS', 899), annual: read('ADMIN_PRICE_ANNUAL_CENTS', 7490) };
}

const n = (v: unknown) => Number(v ?? 0);
const USAGE_SORTS = { cost: 'cost', messages: 'messages', imports: 'imports' } as const;

@Injectable()
export class AdminAnalyticsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async overview(q: RawQuery) {
    const days = parseInteger(q.days, 30, 1, 365, 'days');
    const now = new Date();
    // The window starts at Brazil-time midnight, `days` calendar days including today.
    const since = new Date(startOfBrtDay(now).getTime() - (days - 1) * DAY_MS);
    const state = accessStateSql();
    const sinceTs = ts(since);
    const dayList = sql`select generate_series((${sinceTs} at time zone ${TZ})::date, (now() at time zone ${TZ})::date, interval '1 day')::date as d`;
    const isError = sql`(${llmCallLog.error} is not null and ${llmCallLog.error} <> '')`;

    const [userRows, funnelRows, revenueRows, aiTotals, aiByModel, usageRows, signupSeries, activeSeries, costSeries, health] =
      await Promise.all([
        this.db.execute(sql`
          select count(*)::int as total,
                 (count(*) filter (where ${users.createdAt} >= ${sinceTs}))::int as new,
                 (count(*) filter (where ${users.lastActiveAt} >= now() - interval '1 day'))::int as dau,
                 (count(*) filter (where ${users.lastActiveAt} >= now() - interval '7 days'))::int as wau,
                 (count(*) filter (where ${users.lastActiveAt} >= now() - interval '30 days'))::int as mau,
                 (count(*) filter (where ${state} = 'blocked'))::int as blocked,
                 (count(*) filter (where ${state} = 'trial'))::int as trial,
                 (count(*) filter (where ${state} = 'subscribed'))::int as subscribed,
                 (count(*) filter (where ${state} = 'lifetime'))::int as lifetime
          from ${users}`),
        // Funnel of the cohort that signed up inside the window (owner/admin accounts excluded).
        this.db.execute(sql`
          select count(*)::int as signups,
                 (count(*) filter (where
                    ${users.id} in (select ${imports.userId} from ${imports})
                    or exists (select 1 from ${chatMessages} where ${chatMessages.userId} = ${users.id} and ${chatMessages.role} = 'user')
                 ))::int as activated,
                 (count(*) filter (where ${state} = 'trial'))::int as trialing,
                 (count(*) filter (where ${users.stripeSubscriptionId} is not null or ${state} = 'lifetime'))::int as converted,
                 (count(*) filter (where ${state} = 'blocked' and ${users.stripeSubscriptionId} is null))::int as expired
          from ${users}
          where ${users.createdAt} >= ${sinceTs} and ${state} <> 'owner'`),
        this.db.execute(sql`
          select (count(*) filter (where ${users.subscriptionPlan} = 'monthly'))::int as monthly,
                 (count(*) filter (where ${users.subscriptionPlan} = 'annual'))::int as annual,
                 (count(*) filter (where ${users.subscriptionCancelAtPeriodEnd}))::int as canceling
          from ${users}
          where ${state} = 'subscribed' and ${users.stripeSubscriptionId} is not null
            and ${users.subscriptionStatus} in ('active', 'trialing', 'past_due')`),
        this.db.execute(sql`
          select count(*)::int as calls,
                 coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as cost,
                 (count(*) filter (where ${isError}))::int as errors,
                 count(distinct ${llmCallLog.userId})::int as users
          from ${llmCallLog} where ${llmCallLog.createdAt} >= ${sinceTs}`),
        this.db.execute(sql`
          select ${llmCallLog.model} as model, count(*)::int as calls,
                 coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as cost,
                 coalesce(sum(${llmCallLog.inputTokens}), 0)::float8 as input_tokens,
                 coalesce(sum(${llmCallLog.outputTokens}), 0)::float8 as output_tokens
          from ${llmCallLog} where ${llmCallLog.createdAt} >= ${sinceTs}
          group by 1 order by 3 desc limit 20`),
        this.db.execute(sql`
          select (select count(*) from ${imports} where ${imports.createdAt} >= ${sinceTs})::int as imports,
                 (select count(*) from ${transactions}
                    where ${transactions.createdAt} >= ${sinceTs} and ${transactions.deletedAt} is null
                      and not ${transactions.autoGenerated})::int as transactions_created,
                 (select count(*) from ${chatMessages}
                    where ${chatMessages.createdAt} >= ${sinceTs} and ${chatMessages.role} = 'user')::int as chat_messages`),
        this.db.execute(sql`
          with days as (${dayList}), agg as (
            select (${users.createdAt} at time zone ${TZ})::date as d, count(*)::int as c
            from ${users} where ${users.createdAt} >= ${sinceTs} group by 1)
          select to_char(days.d, 'YYYY-MM-DD') as date, coalesce(agg.c, 0) as count
          from days left join agg on agg.d = days.d order by days.d`),
        // Active = sent a chat message or created an import that day, plus each user's latest `last_active_at` day.
        this.db.execute(sql`
          with days as (${dayList}), act as (
            select ${chatMessages.userId} as uid, (${chatMessages.createdAt} at time zone ${TZ})::date as d
              from ${chatMessages} where ${chatMessages.createdAt} >= ${sinceTs} and ${chatMessages.role} = 'user'
            union
            select ${imports.userId}, (${imports.createdAt} at time zone ${TZ})::date
              from ${imports} where ${imports.createdAt} >= ${sinceTs}
            union
            select ${users.id}, (${users.lastActiveAt} at time zone ${TZ})::date
              from ${users} where ${users.lastActiveAt} >= ${sinceTs}
          )
          select to_char(days.d, 'YYYY-MM-DD') as date, count(act.uid)::int as count
          from days left join act on act.d = days.d group by days.d order by days.d`),
        this.db.execute(sql`
          with days as (${dayList}), agg as (
            select (${llmCallLog.createdAt} at time zone ${TZ})::date as d, sum(${llmCallLog.costMicroCents})::float8 as cost
            from ${llmCallLog} where ${llmCallLog.createdAt} >= ${sinceTs} group by 1)
          select to_char(days.d, 'YYYY-MM-DD') as date, coalesce(agg.cost, 0) as cost
          from days left join agg on agg.d = days.d order by days.d`),
        this.db.execute(sql`
          select count(*)::int as calls, (count(*) filter (where ${isError}))::int as errors
          from ${llmCallLog} where ${llmCallLog.createdAt} >= now() - interval '24 hours'`),
      ]);

    const u = userRows[0] ?? {};
    const f = funnelRows[0] ?? {};
    const r = revenueRows[0] ?? {};
    const a = aiTotals[0] ?? {};
    const usage = usageRows[0] ?? {};
    const h = health[0] ?? {};
    const prices = priceCents();
    const monthly = n(r.monthly);
    const annual = n(r.annual);
    const mrrCents = Math.round(monthly * prices.monthly + (annual * prices.annual) / 12);
    const aiCostUsd = microCentsToUsd(n(a.cost));
    const aiCalls = n(a.calls);
    const signups = n(f.signups);
    const converted = n(f.converted);

    return {
      days,
      since: since.toISOString(),
      users: {
        total: n(u.total),
        new: n(u.new),
        dau: n(u.dau),
        wau: n(u.wau),
        mau: n(u.mau),
        blocked: n(u.blocked),
        trial: n(u.trial),
        subscribed: n(u.subscribed),
        lifetime: n(u.lifetime),
      },
      funnel: {
        signups,
        activated: n(f.activated),
        trialing: n(f.trialing),
        converted,
        expired: n(f.expired),
        conversionRate: signups ? converted / signups : 0,
      },
      revenue: {
        activeSubscriptions: monthly + annual,
        monthly,
        annual,
        cancelingAtPeriodEnd: n(r.canceling),
        mrrCents,
        arrCents: mrrCents * 12,
      },
      ai: {
        costUsd: aiCostUsd,
        calls: aiCalls,
        costPerActiveUserUsd: n(a.users) ? Math.round((aiCostUsd / n(a.users)) * 1e6) / 1e6 : 0,
        errorRate: aiCalls ? n(a.errors) / aiCalls : 0,
        byModel: [...aiByModel].map((m) => ({
          model: m.model as string,
          calls: n(m.calls),
          costUsd: microCentsToUsd(n(m.cost)),
          inputTokens: n(m.input_tokens),
          outputTokens: n(m.output_tokens),
        })),
      },
      usage: {
        imports: n(usage.imports),
        transactionsCreated: n(usage.transactions_created),
        chatMessages: n(usage.chat_messages),
      },
      series: {
        signups: [...signupSeries].map((x) => ({ date: x.date as string, count: n(x.count) })),
        activeUsers: [...activeSeries].map((x) => ({ date: x.date as string, count: n(x.count) })),
        aiCostUsd: [...costSeries].map((x) => ({ date: x.date as string, costUsd: microCentsToUsd(n(x.cost)) })),
      },
      health: {
        llmErrorRateLast24h: n(h.calls) ? n(h.errors) / n(h.calls) : 0,
        llmCallsLast24h: n(h.calls),
      },
    };
  }

  async usersUsage(q: RawQuery) {
    const sortParam = str(q.sort, 12) ?? 'cost';
    if (!(sortParam in USAGE_SORTS)) throw new BadRequestException('sort must be cost, messages or imports');
    const limit = parseInteger(q.limit, 20, 1, 100, 'limit');
    const days = parseInteger(q.days, 30, 1, 365, 'days');
    const since = new Date(startOfBrtDay(new Date()).getTime() - (days - 1) * DAY_MS);
    const sinceTs = ts(since);
    const orderBy = sql.raw(USAGE_SORTS[sortParam as keyof typeof USAGE_SORTS]);

    const rows = await this.db.execute(sql`
      with c as (
        select ${llmCallLog.userId} as uid, sum(${llmCallLog.costMicroCents})::float8 as cost, count(*)::int as calls
        from ${llmCallLog} where ${llmCallLog.createdAt} >= ${sinceTs} group by 1),
      m as (
        select ${chatMessages.userId} as uid, count(*)::int as messages
        from ${chatMessages} where ${chatMessages.createdAt} >= ${sinceTs} and ${chatMessages.role} = 'user' group by 1),
      i as (
        select ${imports.userId} as uid, count(*)::int as imports
        from ${imports} where ${imports.createdAt} >= ${sinceTs} group by 1)
      select ${users.id} as id, ${users.email} as email, ${users.name} as name,
             coalesce(c.cost, 0) as cost, coalesce(c.calls, 0) as calls,
             coalesce(m.messages, 0) as messages, coalesce(i.imports, 0) as imports
      from ${users}
      left join c on c.uid = ${users.id} left join m on m.uid = ${users.id} left join i on i.uid = ${users.id}
      where coalesce(c.cost, 0) > 0 or coalesce(m.messages, 0) > 0 or coalesce(i.imports, 0) > 0
      order by ${orderBy} desc, ${users.id}
      limit ${limit}`);

    return {
      days,
      sort: sortParam,
      items: [...rows].map((x) => ({
        userId: x.id as string,
        email: x.email as string,
        name: (x.name as string | null) ?? null,
        costUsd: microCentsToUsd(n(x.cost)),
        calls: n(x.calls),
        messages: n(x.messages),
        imports: n(x.imports),
      })),
    };
  }

  async audit(q: RawQuery) {
    const { page, pageSize, offset } = parsePaging(q, 50);
    const conditions: SQL[] = [];
    const actor = str(q.actor, 100);
    if (actor) conditions.push(sql`${adminAuditLog.adminEmail} ilike ${likeContains(actor)}`);
    const action = str(q.action, 100);
    if (action) conditions.push(sql`${adminAuditLog.action} ilike ${likeContains(action)}`);
    const targetUserId = parseUuid(q.targetUserId, 'targetUserId');
    if (targetUserId) conditions.push(eq(adminAuditLog.targetUserId, targetUserId));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(adminAuditLog)
        .where(where)
        .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(adminAuditLog).where(where),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        adminUserId: r.adminUserId,
        adminEmail: r.adminEmail,
        action: r.action,
        targetUserId: r.targetUserId,
        targetLabel: r.targetLabel,
        details: r.details,
      })),
      total: totals[0]?.total ?? 0,
      page,
      pageSize,
    };
  }
}
