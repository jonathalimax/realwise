import { createHash } from 'crypto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { errorEvents, users } from '../db/schema';
import { AppLogger } from './app-logger';

export const RETENTION_DAYS = 90;
/** Per fingerprint: a runaway loop must not fill the table, the first events already tell the story. */
const MAX_PER_FINGERPRINT_PER_MINUTE = 30;

export type ErrorSource = 'api' | 'web' | 'job';

export interface ErrorInput {
  source: ErrorSource;
  level?: 'error' | 'warn';
  statusCode?: number | null;
  method?: string | null;
  /** Route pattern, never the raw URL. */
  route?: string | null;
  message: string;
  stack?: string | null;
  userId?: string | null;
  appVersion?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown> | null;
}

const cut = (v: string | null | undefined, max: number) => (v ? v.slice(0, max) : null);

/** Strips what varies between occurrences of the same problem (ids, numbers, quoted values). */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\b\d+\b/g, '#')
    .replace(/(["'`]).{1,80}?\1/g, '$1…$1')
    .slice(0, 200);
}

/** First stack frame that points at our own code, so unrelated bugs with a similar message stay apart. */
function topFrame(stack?: string | null): string {
  const line = (stack ?? '').split('\n').find((l) => /\bat .*(\/src\/|\/apps\/|\.jsx?:)/.test(l) && !l.includes('node_modules'));
  return line ? line.replace(/\d+:\d+\)?$/, '').trim().slice(0, 160) : '';
}

export function fingerprintOf(input: Pick<ErrorInput, 'source' | 'statusCode' | 'method' | 'route' | 'message' | 'stack'>): string {
  return createHash('sha1')
    .update([input.source, input.statusCode ?? '', input.method ?? '', input.route ?? '', normalizeMessage(input.message), topFrame(input.stack)].join('|'))
    .digest('hex')
    .slice(0, 20);
}

/**
 * The single place that stores errors. `record` never throws and never blocks the caller: logging a failure must not
 * create another one. Also installed as the sink of the app logger, so every `logger.error(...)` in background code
 * (webhooks, e-mail, LLM calls, schedulers) lands here without each call site knowing about it.
 */
@Injectable()
export class ErrorLogService implements OnModuleInit {
  private readonly logger = new Logger('ErrorLog');
  private readonly emails = new Map<string, string | null>();
  private readonly recent = new Map<string, number[]>();

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  onModuleInit(): void {
    AppLogger.sink = (input) => void this.record(input);
    // Fires for uncaught exceptions without changing Node's default (crash) behaviour.
    process.on('uncaughtExceptionMonitor', (err) => void this.record({ source: 'job', message: `Uncaught exception: ${err?.message ?? err}`, stack: err?.stack ?? null }));
  }

  private throttled(fingerprint: string): boolean {
    const now = Date.now();
    const recent = (this.recent.get(fingerprint) ?? []).filter((t) => now - t < 60_000);
    recent.push(now);
    this.recent.set(fingerprint, recent);
    if (this.recent.size > 2000) for (const [k, v] of this.recent) if (!v.some((t) => now - t < 60_000)) this.recent.delete(k);
    return recent.length > MAX_PER_FINGERPRINT_PER_MINUTE;
  }

  private async emailOf(userId: string): Promise<string | null> {
    if (this.emails.has(userId)) return this.emails.get(userId) ?? null;
    try {
      const [row] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      const email = row?.email ?? null;
      if (this.emails.size > 500) this.emails.clear();
      this.emails.set(userId, email);
      return email;
    } catch {
      return null;
    }
  }

  async record(input: ErrorInput): Promise<void> {
    try {
      const message = (input.message || 'Unknown error').slice(0, 2000);
      const fingerprint = fingerprintOf({ ...input, message });
      if (this.throttled(fingerprint)) return;
      const userEmail = input.userId ? await this.emailOf(input.userId) : null;
      await this.db.insert(errorEvents).values({
        fingerprint,
        source: input.source,
        level: input.level ?? 'error',
        statusCode: input.statusCode ?? null,
        method: cut(input.method, 10),
        route: cut(input.route, 300),
        message,
        stack: cut(input.stack, 8000),
        userId: input.userId ?? null,
        userEmail,
        appVersion: cut(input.appVersion, 40),
        userAgent: cut(input.userAgent, 400),
        context: input.context ?? null,
      });
    } catch (e) {
      // Context 'ErrorLog' is ignored by the logger sink, so this cannot loop.
      this.logger.warn(`could not store error event: ${(e as Error).message}`);
    }
  }

  /** Keeps 90 days: enough to debug, and limits how long personal data (e-mail, user agent) is held. */
  @Cron('30 3 * * *', { timeZone: 'America/Sao_Paulo' })
  async purgeOld(): Promise<void> {
    try {
      await this.db.execute(sql`delete from ${errorEvents} where ${errorEvents.createdAt} < now() - make_interval(days => ${RETENTION_DAYS})`);
      await this.db.execute(sql`delete from ${schema.errorGroups} g where not exists (select 1 from ${errorEvents} e where e.fingerprint = g.fingerprint)`);
    } catch (e) {
      this.logger.warn(`error log cleanup failed: ${(e as Error).message}`);
    }
  }
}
