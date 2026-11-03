import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, SQL, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import {
  adminAuditLog,
  bills,
  budgets,
  categorizationRules,
  chatLimitHits,
  chatMessages,
  financialSummaries,
  imports,
  investments,
  llmCallLog,
  planner,
  pushSubscriptions,
  transactions,
  users,
} from '../db/schema';
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
 * List prices in BRL cents used for MRR. They mirror the current Stripe prices (R$ 12,90 / month and
 * R$ 106,90 / year); override with ADMIN_PRICE_MONTHLY_CENTS / ADMIN_PRICE_ANNUAL_CENTS if Stripe changes.
 * They are only the fallback: each subscription's real amount (after coupons) is stored when it is synced from Stripe,
 * and MRR is built from that. The list prices also give the "without discounts" figure.
 */
function priceCents(): { monthly: number; annual: number } {
  const read = (name: string, def: number) => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return { monthly: read('ADMIN_PRICE_MONTHLY_CENTS', 1290), annual: read('ADMIN_PRICE_ANNUAL_CENTS', 10690) };
}

/** Assumptions for the revenue-vs-cost estimate; env vars override them. */
function financeAssumptions(): { usdBrl: number; feePct: number; feeFixedCents: number } {
  const read = (name: string, def: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v >= 0 ? v : def;
  };
  return {
    usdBrl: read('ADMIN_USD_BRL', 5.5),
    // Stripe Brazil, domestic card: 3.99% + R$ 0,39 per charge.
    feePct: read('ADMIN_STRIPE_FEE_PCT', 3.99),
    feeFixedCents: read('ADMIN_STRIPE_FEE_FIXED_CENTS', 39),
  };
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
    const prices = priceCents();
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
                 (count(*) filter (where ${users.subscriptionCancelAtPeriodEnd}))::int as canceling,
                 (count(*) filter (where coalesce(${users.subscriptionAmountCents}, 1) > 0 and ${users.subscriptionPlan} = 'monthly'))::int as paying_monthly,
                 (count(*) filter (where coalesce(${users.subscriptionAmountCents}, 1) > 0 and ${users.subscriptionPlan} = 'annual'))::int as paying_annual,
                 coalesce(sum(case when ${users.subscriptionPlan} = 'annual'
                                   then coalesce(${users.subscriptionAmountCents}, ${prices.annual}) / 12.0
                                   else coalesce(${users.subscriptionAmountCents}, ${prices.monthly}) end), 0)::float8 as mrr_cents
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
          select count(*)::int as calls, (count(*) filter (where ${isError}))::int as errors,
                 (count(*) filter (where ${llmCallLog.createdAt} >= now() - interval '30 minutes'))::int as calls30,
                 (count(*) filter (where ${isError} and ${llmCallLog.createdAt} >= now() - interval '30 minutes'))::int as errors30,
                 (array_agg(${llmCallLog.error} order by ${llmCallLog.createdAt} desc) filter (where ${isError}))[1] as last_error,
                 max(${llmCallLog.createdAt}) filter (where ${isError}) as last_error_at,
                 max(${llmCallLog.createdAt}) filter (where not ${isError}) as last_ok_at
          from ${llmCallLog} where ${llmCallLog.createdAt} >= now() - interval '24 hours'`),
      ]);

    const u = userRows[0] ?? {};
    const f = funnelRows[0] ?? {};
    const r = revenueRows[0] ?? {};
    const a = aiTotals[0] ?? {};
    const usage = usageRows[0] ?? {};
    const h = health[0] ?? {};
    const monthly = n(r.monthly);
    const annual = n(r.annual);
    const listMrrCents = Math.round(monthly * prices.monthly + (annual * prices.annual) / 12);
    const mrrCents = Math.round(n(r.mrr_cents));
    const aiCostUsd = microCentsToUsd(n(a.cost));

    // Revenue vs cost, on a monthly basis: AI cost in the window is scaled to 30 days and converted to BRL.
    const fx = financeAssumptions();
    const aiMonthlyCents = Math.round((aiCostUsd / days) * 30 * fx.usdBrl * 100);
    const feeCents = Math.round(mrrCents * (fx.feePct / 100) + (n(r.paying_monthly) + n(r.paying_annual) / 12) * fx.feeFixedCents);
    const netCents = mrrCents - feeCents - aiMonthlyCents;
    const finance = {
      mrrCents,
      feeCents,
      aiCostCents: aiMonthlyCents,
      netCents,
      /** Share of revenue the AI eats; null without revenue. */
      aiShareOfRevenue: mrrCents > 0 ? aiMonthlyCents / mrrCents : null,
      /** Net as a share of revenue; null without revenue. */
      margin: mrrCents > 0 ? netCents / mrrCents : null,
      assumptions: { usdBrl: fx.usdBrl, feePct: fx.feePct, feeFixedCents: fx.feeFixedCents, windowDays: days },
    };
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
        /** MRR at list price, to show what coupons are costing. */
        listMrrCents,
      },
      finance,
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
        // "The AI is down" signal: several recent calls and every one of them failed (or nothing worked since the last failure).
        llmCallsLast30m: n(h.calls30),
        llmErrorsLast30m: n(h.errors30),
        llmDown: n(h.errors30) >= 3 && (!h.last_ok_at || new Date(h.last_ok_at as string) < new Date(h.last_error_at as string)),
        llmLastError: h.last_error ? { message: String(h.last_error).slice(0, 400), at: new Date(h.last_error_at as string).toISOString() } : null,
      },
    };
  }

  /**
   * Engagement and retention, built from what users did (there is no event log): an "active day" is a day with a
   * chat message, a transaction they or Elio added, or a bill created. Simulator accounts and the owner are left out.
   * Everything is in Brasilia time.
   */
  async engagement(q: RawQuery) {
    const days = parseInteger(q.days, 30, 7, 180, 'days');
    const state = accessStateSql();
    const real = sql`(${state} <> 'owner' and ${users.email} not ilike '%.invalid')`;
    const since = new Date(startOfBrtDay(new Date()).getTime() - (days + 29) * DAY_MS);
    const sinceTs = ts(since);
    const dayList = sql`select generate_series((${ts(new Date(startOfBrtDay(new Date()).getTime() - (days - 1) * DAY_MS))} at time zone ${TZ})::date, (now() at time zone ${TZ})::date, interval '1 day')::date as d`;

    // One row per (user, local day) with any activity; shared by every query below.
    const activity = (from: SQL) => sql`
      select distinct a.uid, (a.at at time zone ${TZ})::date as d from (
        select ${chatMessages.userId} as uid, ${chatMessages.createdAt} as at from ${chatMessages}
          where ${chatMessages.role} = 'user' and ${chatMessages.createdAt} >= ${from}
        union all
        select ${transactions.userId}, ${transactions.createdAt} from ${transactions}
          where ${transactions.deletedAt} is null and not ${transactions.autoGenerated} and ${transactions.createdAt} >= ${from}
        union all
        select ${bills.userId}, ${bills.createdAt} from ${bills} where ${bills.createdAt} >= ${from}
      ) a join ${users} on ${users.id} = a.uid where ${real}`;

    const cohortSince = new Date(startOfBrtDay(new Date()).getTime() - 12 * 7 * DAY_MS);
    const featSince = sql`now() - interval '30 days'`;
    const feature = (uid: SQL, at: SQL, from: SQL, extra: SQL = sql`true`) =>
      sql`select ${uid} as uid, (${at} >= ${featSince}) as recent from ${from} where ${extra}`;

    const [series, cohorts, dn, funnel, depth, features, heat] = await Promise.all([
      // DAU / WAU / MAU for every day of the window.
      this.db.execute(sql`
        with act as (${activity(sinceTs)}), days as (${dayList})
        select to_char(days.d, 'YYYY-MM-DD') as date,
               (select count(*) from act where act.d = days.d)::int as dau,
               (select count(distinct uid) from act where act.d between days.d - 6 and days.d)::int as wau,
               (select count(distinct uid) from act where act.d between days.d - 29 and days.d)::int as mau
        from days order by days.d`),
      // Weekly signup cohorts: share of each cohort active in week 0..8 after signing up.
      this.db.execute(sql`
        with act as (${activity(ts(cohortSince))}),
        wk as (select uid, date_trunc('week', d)::date as w from act group by 1, 2),
        cohort as (
          select ${users.id} as uid, date_trunc('week', ${users.createdAt} at time zone ${TZ})::date as w
          from ${users} where ${users.createdAt} >= ${ts(cohortSince)} and ${real}
        ),
        size as (select w, count(*)::int as n from cohort group by w)
        select to_char(size.w, 'YYYY-MM-DD') as week, size.n as size, k.k as k,
               (select count(distinct cohort.uid) from cohort join wk on wk.uid = cohort.uid and wk.w = cohort.w + (k.k * 7)
                 where cohort.w = size.w)::int as retained
        from size cross join generate_series(0, 8) as k(k)
        where size.w + (k.k * 7) <= (now() at time zone ${TZ})::date
        order by size.w, k.k`),
      // Classic D1 / D7 / D30: active exactly N calendar days after signing up.
      this.db.execute(sql`
        with act as (${activity(ts(new Date(startOfBrtDay(new Date()).getTime() - 120 * DAY_MS)))}),
        u as (select ${users.id} as uid, (${users.createdAt} at time zone ${TZ})::date as s from ${users}
              where ${users.createdAt} >= ${ts(new Date(startOfBrtDay(new Date()).getTime() - 90 * DAY_MS))} and ${real})
        select n.n as day,
               (select count(*) from u where u.s + n.n <= (now() at time zone ${TZ})::date)::int as eligible,
               (select count(*) from u join act on act.uid = u.uid and act.d = u.s + n.n
                 where u.s + n.n <= (now() at time zone ${TZ})::date)::int as returned
        from (values (1), (7), (30)) as n(n) order by n.n`),
      // Activation funnel of everyone who signed up in the window.
      this.db.execute(sql`
        with act as (${activity(sinceTs)}),
        u as (select ${users.id} as uid, ${users.createdAt} as c, ${state} as st, ${users.stripeSubscriptionId} as sub from ${users}
              where ${users.createdAt} >= ${ts(new Date(startOfBrtDay(new Date()).getTime() - (days - 1) * DAY_MS))} and ${real})
        select count(*)::int as signups,
               (count(*) filter (where exists (select 1 from ${chatMessages} m where m.user_id = u.uid and m.role = 'user')))::int as chatted,
               (count(*) filter (where exists (select 1 from ${transactions} t where t.user_id = u.uid and t.deleted_at is null and not t.auto_generated)))::int as has_transactions,
               (count(*) filter (where exists (select 1 from ${imports} i where i.user_id = u.uid)))::int as imported,
               (count(*) filter (where (select count(*) from act where act.uid = u.uid) >= 2))::int as returned,
               (count(*) filter (where (select count(*) from act where act.uid = u.uid) >= 4))::int as habit,
               (count(*) filter (where u.sub is not null or u.st = 'lifetime'))::int as paying
        from u`),
      // How many days in the last 30 each recently-active user showed up.
      this.db.execute(sql`
        with act as (${activity(sql`now() - interval '30 days'`)}), per as (select uid, count(*)::int as n from act group by uid)
        select (count(*) filter (where n = 1))::int as d1,
               (count(*) filter (where n between 2 and 3))::int as d2_3,
               (count(*) filter (where n between 4 and 7))::int as d4_7,
               (count(*) filter (where n between 8 and 14))::int as d8_14,
               (count(*) filter (where n >= 15))::int as d15,
               (select count(distinct a.uid) from ${sql`(${activity(sql`now() - interval '60 days'`)})`} a
                  where a.d < (now() at time zone ${TZ})::date - 14
                    and a.uid not in (select uid from act where act.d >= (now() at time zone ${TZ})::date - 14))::int as at_risk
        from per`),
      // Feature adoption among people active in the last 30 days.
      this.db.execute(sql`
        with act as (${activity(sql`now() - interval '30 days'`)}), base as (select distinct uid from act),
        f as (
          select 'chat' as feature, uid, recent from (${feature(sql`${chatMessages.userId}`, sql`${chatMessages.createdAt}`, sql`${chatMessages}`, sql`${chatMessages.role} = 'user'`)}) x
          union all select 'imports', uid, recent from (${feature(sql`${imports.userId}`, sql`${imports.createdAt}`, sql`${imports}`)}) x
          union all select 'transactions', uid, recent from (${feature(sql`${transactions.userId}`, sql`${transactions.createdAt}`, sql`${transactions}`, sql`${transactions.deletedAt} is null and not ${transactions.autoGenerated}`)}) x
          union all select 'bills', uid, recent from (${feature(sql`${bills.userId}`, sql`${bills.createdAt}`, sql`${bills}`)}) x
          union all select 'planner', uid, recent from (${feature(sql`${planner.userId}`, sql`${planner.createdAt}`, sql`${planner}`)}) x
          union all select 'budgets', uid, recent from (${feature(sql`${budgets.userId}`, sql`${budgets.createdAt}`, sql`${budgets}`)}) x
          union all select 'investments', uid, recent from (${feature(sql`${investments.userId}`, sql`${investments.createdAt}`, sql`${investments}`)}) x
          union all select 'rules', uid, recent from (${feature(sql`${categorizationRules.userId}`, sql`${categorizationRules.createdAt}`, sql`${categorizationRules}`)}) x
          union all select 'push', uid, recent from (${feature(sql`${pushSubscriptions.userId}`, sql`${pushSubscriptions.createdAt}`, sql`${pushSubscriptions}`)}) x
          union all select 'summary', uid, recent from (${feature(sql`${financialSummaries.userId}`, sql`${financialSummaries.createdAt}`, sql`${financialSummaries}`)}) x
        )
        select f.feature,
               (count(distinct f.uid) filter (where f.recent and f.uid in (select uid from base)))::int as recent,
               (count(distinct f.uid) filter (where f.uid in (select ${users.id} from ${users} where ${real})))::int as ever,
               (select count(*) from base)::int as base
        from f group by f.feature`),
      // When people write to Elio: weekday (0 = Sunday) x hour of day, last 30 days.
      this.db.execute(sql`
        select extract(dow from (${chatMessages.createdAt} at time zone ${TZ}))::int as dow,
               extract(hour from (${chatMessages.createdAt} at time zone ${TZ}))::int as hour,
               count(*)::int as n
        from ${chatMessages}
        where ${chatMessages.role} = 'user' and ${chatMessages.createdAt} >= now() - interval '30 days'
        group by 1, 2`),
    ]);

    const cohortMap = new Map<string, { week: string; size: number; retained: (number | null)[] }>();
    for (const r of cohorts as unknown as { week: string; size: number; k: number; retained: number }[]) {
      const c = cohortMap.get(r.week) ?? { week: r.week, size: n(r.size), retained: Array(9).fill(null) };
      c.retained[n(r.k)] = n(r.retained);
      cohortMap.set(r.week, c);
    }
    const f = (funnel as unknown as Record<string, number>[])[0] ?? {};
    const d = (depth as unknown as Record<string, number>[])[0] ?? {};
    return {
      days,
      series: (series as unknown as { date: string; dau: number; wau: number; mau: number }[]).map((r) => ({ date: r.date, dau: n(r.dau), wau: n(r.wau), mau: n(r.mau) })),
      cohorts: [...cohortMap.values()],
      dn: (dn as unknown as { day: number; eligible: number; returned: number }[]).map((r) => ({ day: n(r.day), eligible: n(r.eligible), returned: n(r.returned) })),
      funnel: Object.fromEntries(['signups', 'chatted', 'has_transactions', 'imported', 'returned', 'habit', 'paying'].map((k) => [k, n(f[k])])),
      depth: Object.fromEntries(['d1', 'd2_3', 'd4_7', 'd8_14', 'd15', 'at_risk'].map((k) => [k, n(d[k])])),
      features: (features as unknown as { feature: string; recent: number; ever: number; base: number }[]).map((r) => ({ feature: r.feature, recent: n(r.recent), ever: n(r.ever), base: n(r.base) })),
      heat: (heat as unknown as { dow: number; hour: number; n: number }[]).map((r) => ({ dow: n(r.dow), hour: n(r.hour), n: n(r.n) })),
    };
  }

  /** Who is being told to slow down (message limits) or wait (server full), and how often. */
  async chatLimits(q: RawQuery) {
    const days = parseInteger(q.days, 7, 1, 90, 'days');
    const sinceTs = ts(new Date(Date.now() - days * DAY_MS));
    const [totals, perUser] = await Promise.all([
      this.db.execute(sql`
        select ${chatLimitHits.window} as window, count(*)::int as hits, count(distinct ${chatLimitHits.userId})::int as people
        from ${chatLimitHits} where ${chatLimitHits.createdAt} >= ${sinceTs} group by 1`),
      this.db.execute(sql`
        select ${users.id} as id, ${users.email} as email, ${users.name} as name, ${users.chatLimitsDisabled} as disabled,
               count(*)::int as hits,
               (count(*) filter (where ${chatLimitHits.window} = 'minute'))::int as minute,
               (count(*) filter (where ${chatLimitHits.window} = 'hour'))::int as hour,
               (count(*) filter (where ${chatLimitHits.window} = 'day'))::int as day,
               (count(*) filter (where ${chatLimitHits.window} = 'busy'))::int as busy,
               max(${chatLimitHits.createdAt}) as last_at
        from ${chatLimitHits} join ${users} on ${users.id} = ${chatLimitHits.userId}
        where ${chatLimitHits.createdAt} >= ${sinceTs}
        group by ${users.id} order by hits desc, last_at desc limit 20`),
    ]);
    return {
      days,
      totals: Object.fromEntries((totals as unknown as { window: string; hits: number; people: number }[]).map((r) => [r.window, { hits: n(r.hits), people: n(r.people) }])),
      users: (perUser as unknown as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        email: String(r.email),
        name: (r.name as string | null) ?? null,
        disabled: Boolean(r.disabled),
        hits: n(r.hits),
        minute: n(r.minute),
        hour: n(r.hour),
        day: n(r.day),
        busy: n(r.busy),
        lastAt: r.last_at ? new Date(r.last_at as string).toISOString() : null,
      })),
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
