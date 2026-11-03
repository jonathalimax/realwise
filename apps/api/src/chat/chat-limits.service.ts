import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { chatLimitHits, chatMessages, users } from '../db/schema';

const num = (v: string | undefined, fallback: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

type Window = 'minute' | 'hour' | 'day';

const WINDOWS: { key: Window; seconds: number; env: string; fallback: number }[] = [
  { key: 'minute', seconds: 60, env: 'CHAT_LIMIT_PER_MINUTE', fallback: 3 },
  { key: 'hour', seconds: 3600, env: 'CHAT_LIMIT_PER_HOUR', fallback: 10 },
  { key: 'day', seconds: 86400, env: 'CHAT_LIMIT_PER_DAY', fallback: 30 },
];

const HIT_LOG_EVERY_MS = 60_000;

function waitText(seconds: number): string {
  if (seconds < 90) return `${Math.max(5, Math.ceil(seconds / 5) * 5)} segundos`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

/**
 * Protects the single API instance (and the AI bill) from a person, or a script, sending messages too fast, and from
 * too many chat turns running at once. Message counts come from `chat_messages`, so they survive restarts.
 * Admins can switch the per-person limits off on a user (`users.chat_limits_disabled`); every refusal is logged in
 * `chat_limit_hits` for the admin to see who keeps hitting them.
 */
@Injectable()
export class ChatLimitsService {
  private readonly logger = new Logger(ChatLimitsService.name);
  private readonly lastLogged = new Map<string, number>();
  private active = 0;

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private get maxConcurrent() {
    return num(process.env.CHAT_MAX_CONCURRENT, 12);
  }

  /** Throws 429 when the person already sent their share of messages in the last minute, hour or day. */
  async checkMessageRate(scope: { clientId: string; userId: string }): Promise<void> {
    const [user] = await this.db.select({ off: users.chatLimitsDisabled }).from(users).where(eq(users.id, scope.userId)).limit(1);
    if (user?.off) return;

    const now = Date.now();
    const rows = await this.db
      .select({ at: chatMessages.createdAt })
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, scope.userId), eq(chatMessages.role, 'user'), gt(chatMessages.createdAt, sql`now() - interval '1 day'`)))
      .orderBy(chatMessages.createdAt)
      .limit(500);
    const times = rows.map((r) => r.at.getTime());

    let worst: { key: Window; max: number; waitSec: number } | null = null;
    for (const w of WINDOWS) {
      const max = num(process.env[w.env], w.fallback);
      const inside = times.filter((t) => t > now - w.seconds * 1000);
      if (inside.length < max) continue;
      // Free again once enough of the oldest messages in this window have aged out.
      const waitSec = Math.max(1, Math.ceil((inside[inside.length - max] + w.seconds * 1000 - now) / 1000));
      if (!worst || waitSec > worst.waitSec) worst = { key: w.key, max, waitSec };
    }
    if (!worst) return;

    await this.logHit(scope, worst.key);
    const wait = waitText(worst.waitSec);
    const message =
      worst.key === 'minute'
        ? `Você mandou várias mensagens seguidas. Espere ${wait} e continue de onde parou.`
        : worst.key === 'hour'
          ? `Você chegou ao limite de ${worst.max} mensagens por hora. Pode voltar a conversar em ${wait}.`
          : `Você chegou ao limite de ${worst.max} mensagens por dia. Pode voltar a conversar em ${wait}.`;
    throw new HttpException({ message, code: 'CHAT_RATE_LIMIT', window: worst.key, retryAfterSec: worst.waitSec }, 429);
  }

  /** Reserves a slot for one running chat turn; the returned function frees it. Throws 429 when the server is full. */
  async acquire(scope: { clientId: string; userId: string }): Promise<() => void> {
    if (this.active >= this.maxConcurrent) {
      await this.logHit(scope, 'busy');
      throw new HttpException(
        { message: 'O Elio está com muitas conversas ao mesmo tempo. Tente de novo em alguns segundos.', code: 'CHAT_BUSY', retryAfterSec: 10 },
        429,
      );
    }
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }

  /** Records a refusal, at most once a minute per person and kind, so a hammering script cannot fill the table. */
  private async logHit(scope: { clientId: string; userId: string }, window: Window | 'busy'): Promise<void> {
    const key = `${scope.userId}:${window}`;
    const now = Date.now();
    if (now - (this.lastLogged.get(key) ?? 0) < HIT_LOG_EVERY_MS) return;
    this.lastLogged.set(key, now);
    if (this.lastLogged.size > 5000) this.lastLogged.clear();
    try {
      await this.db.insert(chatLimitHits).values({ clientId: scope.clientId, userId: scope.userId, window });
    } catch (e) {
      this.logger.warn(`could not log chat limit hit: ${(e as Error).message}`);
    }
  }
}
