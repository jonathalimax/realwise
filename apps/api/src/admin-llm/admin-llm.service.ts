import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, sql, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { llmCallLog, users } from '../db/schema';
import {
  ADMIN_TZ,
  csvCell,
  likeContains,
  MICRO_CENTS_PER_USD,
  microCentsToUsd,
  parsePaging,
  parseRange,
  parseUuid,
  RawQuery,
  str,
  ts,
} from '../admin-common/admin-query.util';

const MAX_RANGE_DAYS = 400;
const DEFAULT_SUMMARY_DAYS = 30;
export const CSV_MAX_ROWS = 50000;
const CSV_CHUNK = 2000;

interface Filters {
  where: SQL | undefined;
}

const toNum = (v: unknown) => Number(v ?? 0);

@Injectable()
export class AdminLlmService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private buildFilters(q: RawQuery): Filters {
    const conditions: SQL[] = [];
    const userId = parseUuid(q.userId, 'userId');
    if (userId) conditions.push(eq(llmCallLog.userId, userId));
    const userEmail = str(q.userEmail, 100);
    if (userEmail) conditions.push(sql`${users.email} ilike ${likeContains(userEmail)}`);
    const model = str(q.model, 100);
    if (model) conditions.push(sql`${llmCallLog.model} ilike ${likeContains(model)}`);
    const purpose = str(q.purpose, 60);
    if (purpose) conditions.push(eq(llmCallLog.purpose, purpose));
    const status = str(q.status, 10);
    if (status) {
      if (status === 'error') conditions.push(sql`(${llmCallLog.error} is not null and ${llmCallLog.error} <> '')`);
      else if (status === 'ok') conditions.push(sql`(${llmCallLog.error} is null or ${llmCallLog.error} = '')`);
      else throw new BadRequestException('status must be ok or error');
    }
    const { from, to } = parseRange(q, { maxDays: MAX_RANGE_DAYS });
    if (from) conditions.push(sql`${llmCallLog.createdAt} >= ${ts(from)}`);
    if (to) conditions.push(sql`${llmCallLog.createdAt} < ${ts(to)}`);
    const minCost = str(q.minCostUsd, 20);
    if (minCost !== undefined) {
      const n = Number(minCost);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('minCostUsd must be a non-negative number');
      conditions.push(sql`${llmCallLog.costMicroCents} >= ${Math.round(n * MICRO_CENTS_PER_USD)}`);
    }
    const search = str(q.q, 100);
    if (search) {
      const p = likeContains(search);
      conditions.push(sql`(${llmCallLog.error} ilike ${p} or ${llmCallLog.model} ilike ${p})`);
    }
    return { where: conditions.length ? and(...conditions) : undefined };
  }

  private rowSelect() {
    return {
      id: llmCallLog.id,
      createdAt: llmCallLog.createdAt,
      userId: llmCallLog.userId,
      userEmail: users.email,
      purpose: llmCallLog.purpose,
      provider: llmCallLog.provider,
      model: llmCallLog.model,
      inputTokens: llmCallLog.inputTokens,
      outputTokens: llmCallLog.outputTokens,
      costMicroCents: llmCallLog.costMicroCents,
      latencyMs: llmCallLog.latencyMs,
      error: llmCallLog.error,
    };
  }

  private mapRow(r: {
    id: string;
    createdAt: Date;
    userId: string;
    userEmail: string;
    purpose: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicroCents: number;
    latencyMs: number;
    error: string | null;
  }) {
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      userId: r.userId,
      userEmail: r.userEmail,
      purpose: r.purpose,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsd: microCentsToUsd(r.costMicroCents),
      latencyMs: r.latencyMs,
      error: r.error ? r.error : null,
    };
  }

  async list(q: RawQuery) {
    const { page, pageSize, offset } = parsePaging(q);
    const { where } = this.buildFilters(q);
    const [rows, totals] = await Promise.all([
      this.db
        .select(this.rowSelect())
        .from(llmCallLog)
        .innerJoin(users, eq(users.id, llmCallLog.userId))
        .where(where)
        .orderBy(desc(llmCallLog.createdAt), desc(llmCallLog.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(llmCallLog).innerJoin(users, eq(users.id, llmCallLog.userId)).where(where),
    ]);
    // Error text can be long (provider payloads); keep list responses small.
    const items = rows.map((r) => {
      const item = this.mapRow(r);
      return { ...item, error: item.error ? item.error.slice(0, 2000) : null };
    });
    return { items, total: totals[0]?.total ?? 0, page, pageSize };
  }

  /** Streams the filtered rows (newest first, max 50 000) as CSV through `write`. */
  async exportCsv(q: RawQuery, write: (chunk: string) => void): Promise<void> {
    const { where } = this.buildFilters(q);
    write(
      [
        'id', 'createdAt', 'userId', 'userEmail', 'purpose', 'provider', 'model',
        'inputTokens', 'outputTokens', 'costUsd', 'latencyMs', 'error',
      ].join(',') + '\n',
    );
    for (let offset = 0; offset < CSV_MAX_ROWS; offset += CSV_CHUNK) {
      const rows = await this.db
        .select(this.rowSelect())
        .from(llmCallLog)
        .innerJoin(users, eq(users.id, llmCallLog.userId))
        .where(where)
        .orderBy(desc(llmCallLog.createdAt), desc(llmCallLog.id))
        .limit(Math.min(CSV_CHUNK, CSV_MAX_ROWS - offset))
        .offset(offset);
      if (rows.length === 0) break;
      write(
        rows
          .map((r) => {
            const i = this.mapRow(r);
            return [
              i.id, i.createdAt, i.userId, i.userEmail, i.purpose, i.provider, i.model,
              i.inputTokens, i.outputTokens, i.costUsd, i.latencyMs, i.error,
            ]
              .map(csvCell)
              .join(',');
          })
          .join('\n') + '\n',
      );
      if (rows.length < CSV_CHUNK) break;
    }
  }

  async summary(q: RawQuery) {
    const { from: rawFrom, to } = parseRange(q, { defaultDays: DEFAULT_SUMMARY_DAYS, maxDays: MAX_RANGE_DAYS });
    const from = rawFrom ?? new Date(Date.now() - DEFAULT_SUMMARY_DAYS * 86400000);
    const range = to
      ? sql`${llmCallLog.createdAt} >= ${ts(from)} and ${llmCallLog.createdAt} < ${ts(to)}`
      : sql`${llmCallLog.createdAt} >= ${ts(from)}`;
    const isError = sql`(${llmCallLog.error} is not null and ${llmCallLog.error} <> '')`;
    // `to` is an exclusive bound: the last bucket is the day of the instant just before it.
    const upper = to ? new Date(to.getTime() - 1) : new Date();

    const [totals, byModel, byPurpose, byDay, topUsers] = await Promise.all([
      this.db.execute(sql`
        select count(*)::int as calls,
               coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as cost,
               (count(*) filter (where ${isError}))::int as errors,
               coalesce(sum(${llmCallLog.inputTokens}), 0)::float8 as input_tokens,
               coalesce(sum(${llmCallLog.outputTokens}), 0)::float8 as output_tokens,
               coalesce(sum(${llmCallLog.cachedInputTokens}), 0)::float8 as cached_tokens,
               coalesce(avg(${llmCallLog.latencyMs}), 0)::float8 as avg_latency,
               coalesce(percentile_cont(0.95) within group (order by ${llmCallLog.latencyMs}), 0)::float8 as p95_latency
        from ${llmCallLog} where ${range}`),
      this.db.execute(sql`
        select ${llmCallLog.model} as model, count(*)::int as calls,
               coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as cost,
               coalesce(sum(${llmCallLog.inputTokens}), 0)::float8 as input_tokens,
               coalesce(sum(${llmCallLog.outputTokens}), 0)::float8 as output_tokens
        from ${llmCallLog} where ${range} group by 1 order by 3 desc limit 50`),
      this.db.execute(sql`
        select ${llmCallLog.purpose} as purpose, count(*)::int as calls,
               coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as cost,
               coalesce(sum(${llmCallLog.inputTokens}), 0)::float8 as input_tokens,
               coalesce(sum(${llmCallLog.outputTokens}), 0)::float8 as output_tokens
        from ${llmCallLog} where ${range} group by 1 order by 3 desc limit 50`),
      // Zero-filled daily series in Brazil time so the chart has no gaps.
      this.db.execute(sql`
        with days as (
          select generate_series(
            (${ts(from)} at time zone ${ADMIN_TZ})::date,
            (${ts(upper)} at time zone ${ADMIN_TZ})::date,
            interval '1 day')::date as d
        ), agg as (
          select (${llmCallLog.createdAt} at time zone ${ADMIN_TZ})::date as d, count(*)::int as calls,
                 sum(${llmCallLog.costMicroCents})::float8 as cost,
                 (count(*) filter (where ${isError}))::int as errors,
                 sum(${llmCallLog.inputTokens})::float8 as input_tokens,
                 sum(${llmCallLog.outputTokens})::float8 as output_tokens,
                 sum(${llmCallLog.cachedInputTokens})::float8 as cached_tokens
          from ${llmCallLog} where ${range} group by 1
        )
        select to_char(days.d, 'YYYY-MM-DD') as date, coalesce(agg.calls, 0) as calls,
               coalesce(agg.cost, 0) as cost, coalesce(agg.errors, 0) as errors,
               coalesce(agg.input_tokens, 0) as input_tokens, coalesce(agg.output_tokens, 0) as output_tokens,
               coalesce(agg.cached_tokens, 0) as cached_tokens
        from days left join agg on agg.d = days.d order by days.d limit 800`),
      this.db.execute(sql`
        select ${llmCallLog.userId} as user_id, ${users.email} as email, count(*)::int as calls,
               coalesce(sum(${llmCallLog.costMicroCents}), 0)::float8 as cost
        from ${llmCallLog} join ${users} on ${users.id} = ${llmCallLog.userId}
        where ${range} group by 1, 2 order by 4 desc limit 10`),
    ]);

    const t = totals[0] ?? {};
    const calls = toNum(t.calls);
    const errors = toNum(t.errors);
    return {
      totalCostUsd: microCentsToUsd(toNum(t.cost)),
      calls,
      errors,
      errorRate: calls ? errors / calls : 0,
      inputTokens: toNum(t.input_tokens),
      outputTokens: toNum(t.output_tokens),
      cachedTokens: toNum(t.cached_tokens),
      // Share of input tokens served from the prompt cache; the lever for the cost plan (.ai/plans/token-savings.md).
      cacheHitRate: toNum(t.input_tokens) ? toNum(t.cached_tokens) / toNum(t.input_tokens) : 0,
      tokensPerCall: calls ? Math.round((toNum(t.input_tokens) + toNum(t.output_tokens)) / calls) : 0,
      avgLatencyMs: Math.round(toNum(t.avg_latency)),
      p95LatencyMs: Math.round(toNum(t.p95_latency)),
      byModel: [...byModel].map((r) => ({
        model: r.model as string,
        calls: toNum(r.calls),
        costUsd: microCentsToUsd(toNum(r.cost)),
        inputTokens: toNum(r.input_tokens),
        outputTokens: toNum(r.output_tokens),
      })),
      byPurpose: [...byPurpose].map((r) => ({
        purpose: r.purpose as string,
        calls: toNum(r.calls),
        costUsd: microCentsToUsd(toNum(r.cost)),
        inputTokens: toNum(r.input_tokens),
        outputTokens: toNum(r.output_tokens),
      })),
      byDay: [...byDay].map((r) => ({
        date: r.date as string,
        calls: toNum(r.calls),
        costUsd: microCentsToUsd(toNum(r.cost)),
        errors: toNum(r.errors),
        inputTokens: toNum(r.input_tokens),
        outputTokens: toNum(r.output_tokens),
        cachedTokens: toNum(r.cached_tokens),
      })),
      topUsers: [...topUsers].map((r) => ({
        userId: r.user_id as string,
        email: r.email as string,
        calls: toNum(r.calls),
        costUsd: microCentsToUsd(toNum(r.cost)),
      })),
    };
  }
}
