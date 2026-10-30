import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { sql, SQL } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { errorEvents, errorGroups } from '../db/schema';

const STATES = ['open', 'resolved', 'ignored'] as const;
const SOURCES = ['api', 'web', 'job'] as const;
const FP_RE = /^[0-9a-f]{20}$/;

const rowsOf = <T>(res: unknown): T[] => (Array.isArray(res) ? (res as T[]) : ((res as { rows?: T[] })?.rows ?? []));

/** The admin's window onto the error log: grouped list, one group's occurrences, and triage (resolve / ignore). */
@Controller('admin/errors')
@UseGuards(AdminGuard)
export class AdminErrorsController {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  @Get('summary')
  async summary() {
    const [counts] = rowsOf<Record<string, number>>(
      await this.db.execute(sql`
        select count(*) filter (where created_at >= now() - interval '1 day')::int as last24h,
               count(*) filter (where created_at >= now() - interval '7 days')::int as last7d,
               (count(distinct user_id) filter (where created_at >= now() - interval '1 day'))::int as users24h,
               (count(*) filter (where created_at >= now() - interval '1 day' and source = 'api' and level = 'error'))::int as api24h,
               (count(*) filter (where created_at >= now() - interval '1 day' and source = 'web'))::int as web24h,
               (count(*) filter (where created_at >= now() - interval '1 day' and source = 'job'))::int as job24h
        from ${errorEvents}`),
    );
    const [open] = rowsOf<{ n: number }>(
      await this.db.execute(sql`
        select count(*)::int as n from (
          select e.fingerprint
          from ${errorEvents} e left join ${errorGroups} g on g.fingerprint = e.fingerprint
          where e.created_at >= now() - interval '30 days'
          group by e.fingerprint, g.status, g.resolved_at
          having coalesce(g.status, 'open') = 'open' or (g.status = 'resolved' and max(e.created_at) > g.resolved_at)
        ) t`),
    );
    return { ...counts, openGroups: open?.n ?? 0 };
  }

  @Get()
  async list(@Query() query: Record<string, string>) {
    const days = Math.min(90, Math.max(1, Number(query.days) || 7));
    const state = (STATES as readonly string[]).includes(query.status) ? query.status : query.status === 'all' ? null : 'open';
    const conds: SQL[] = [sql`e.created_at >= now() - make_interval(days => ${days})`];
    if ((SOURCES as readonly string[]).includes(query.source)) conds.push(sql`e.source = ${query.source}`);
    const q = (query.q ?? '').trim().slice(0, 100);
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conds.push(sql`(e.message ilike ${like} or e.route ilike ${like} or e.user_email ilike ${like})`);
    }
    const rows = await this.db.execute(sql`
      select * from (
        select e.fingerprint,
               count(*)::int as count,
               min(e.created_at) as first_seen,
               max(e.created_at) as last_seen,
               (count(distinct e.user_id))::int as users,
               (array_agg(e.source order by e.created_at desc))[1] as source,
               (array_agg(e.level order by e.created_at desc))[1] as level,
               (array_agg(e.status_code order by e.created_at desc))[1] as status_code,
               (array_agg(e.method order by e.created_at desc))[1] as method,
               (array_agg(e.route order by e.created_at desc))[1] as route,
               (array_agg(e.message order by e.created_at desc))[1] as message,
               case when g.status = 'ignored' then 'ignored'
                    when g.status = 'resolved' and max(e.created_at) <= g.resolved_at then 'resolved'
                    else 'open' end as state,
               coalesce(g.status = 'resolved' and max(e.created_at) > g.resolved_at, false) as regressed
        from ${errorEvents} e left join ${errorGroups} g on g.fingerprint = e.fingerprint
        where ${sql.join(conds, sql` and `)}
        group by e.fingerprint, g.status, g.resolved_at
      ) t
      ${state ? sql`where t.state = ${state}` : sql``}
      order by t.last_seen desc
      limit 200`);
    return rowsOf(rows);
  }

  @Get(':fingerprint')
  async detail(@Param('fingerprint') fingerprint: string) {
    if (!FP_RE.test(fingerprint)) throw new BadRequestException('Invalid error id.');
    const [group] = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`
        select e.fingerprint, count(*)::int as count, min(e.created_at) as first_seen, max(e.created_at) as last_seen,
               (count(distinct e.user_id))::int as users,
               (array_agg(e.source order by e.created_at desc))[1] as source,
               (array_agg(e.status_code order by e.created_at desc))[1] as status_code,
               (array_agg(e.method order by e.created_at desc))[1] as method,
               (array_agg(e.route order by e.created_at desc))[1] as route,
               (array_agg(e.message order by e.created_at desc))[1] as message,
               g.status as group_status, g.resolved_at
        from ${errorEvents} e left join ${errorGroups} g on g.fingerprint = e.fingerprint
        where e.fingerprint = ${fingerprint}
        group by g.status, g.resolved_at, e.fingerprint`),
    );
    if (!group) throw new BadRequestException('Error not found (it may have been purged after 90 days).');
    const events = rowsOf(
      await this.db.execute(sql`
        select id, source, level, status_code as "statusCode", method, route, message, stack, user_id as "userId",
               user_email as "userEmail", app_version as "appVersion", user_agent as "userAgent", context, created_at as "createdAt"
        from ${errorEvents} where fingerprint = ${fingerprint} order by created_at desc limit 50`),
    );
    const affected = rowsOf(
      await this.db.execute(sql`
        select user_id as "userId", user_email as "email", count(*)::int as count, max(created_at) as "lastSeen"
        from ${errorEvents} where fingerprint = ${fingerprint} and user_id is not null
        group by user_id, user_email order by max(created_at) desc limit 20`),
    );
    const groupStatus = group.group_status as string | null;
    const resolvedAt = group.resolved_at ? new Date(group.resolved_at as string) : null;
    const lastSeen = new Date(group.last_seen as string);
    const state = groupStatus === 'ignored' ? 'ignored' : groupStatus === 'resolved' && resolvedAt && lastSeen <= resolvedAt ? 'resolved' : 'open';
    return { ...group, state, regressed: groupStatus === 'resolved' && resolvedAt !== null && lastSeen > resolvedAt, events, affected };
  }

  @Patch(':fingerprint')
  async setStatus(@Param('fingerprint') fingerprint: string, @Body() body: { status?: string }, @CurrentUser() admin: JwtPayload) {
    if (!FP_RE.test(fingerprint)) throw new BadRequestException('Invalid error id.');
    const status = String(body?.status ?? '');
    if (!(STATES as readonly string[]).includes(status)) throw new BadRequestException('status must be open, resolved or ignored.');
    const resolved = status === 'resolved';
    await this.db
      .insert(errorGroups)
      .values({ fingerprint, status, resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? admin.sub : null })
      .onConflictDoUpdate({
        target: errorGroups.fingerprint,
        set: { status, resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? admin.sub : null, updatedAt: new Date() },
      });
    return { ok: true, status };
  }
}
