import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { appSettings } from '../db/schema';
import {
  AiSettings,
  AnnouncementSettings,
  DEFAULT_EMAIL_SETTINGS,
  EmailSettings,
  ENGAGEMENT_KINDS,
} from './app-settings.types';

const CACHE_TTL_MS = 60_000;

function clampHour(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}

/** Hour of day (0-23) in Brasilia for the given instant. */
export function brtHour(now: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(now)
    .find((p) => p.type === 'hour');
  return Number(part?.value ?? 0) % 24;
}

/**
 * Runtime-editable settings stored in `app_settings`. Precedence everywhere: DB value > env var > built-in default.
 * Reads are cached for 60s (and invalidated by set()); a DB failure never throws, callers just get "no stored value".
 */
@Injectable()
export class AppSettingsService {
  private readonly logger = new Logger(AppSettingsService.name);
  private readonly cache = new Map<string, { value: unknown; expires: number }>();

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /** Stored value for `key`, or undefined when unset or the database is unreachable. */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T | undefined;
    try {
      const [row] = await this.db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
      this.cache.set(key, { value: row?.value, expires: Date.now() + CACHE_TTL_MS });
      return row?.value as T | undefined;
    } catch (e) {
      this.logger.error(`failed to read setting "${key}": ${(e as Error).message}`);
      // Short negative cache so a down database does not add a failing query to every LLM call.
      this.cache.set(key, { value: hit?.value, expires: Date.now() + 5_000 });
      return hit?.value as T | undefined;
    }
  }

  async set(key: string, value: unknown, updatedBy?: string | null): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({ key, value: value as never, updatedBy: updatedBy ?? null })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: value as never, updatedBy: updatedBy ?? null, updatedAt: new Date() },
      });
    this.cache.delete(key);
  }

  /** Stored `ai` overrides (may be empty). */
  async getAi(): Promise<AiSettings> {
    const raw = await this.get<AiSettings>('ai');
    return raw && typeof raw === 'object' ? raw : {};
  }

  /** Email schedule with every missing field filled from the defaults (engagement 10h, bills 9h, all enabled). */
  async getEmails(): Promise<EmailSettings> {
    const raw = (await this.get<Partial<EmailSettings>>('emails')) ?? {};
    const d = DEFAULT_EMAIL_SETTINGS;
    const kinds = Object.fromEntries(
      ENGAGEMENT_KINDS.map((k) => [k, { enabled: raw.engagement?.kinds?.[k]?.enabled ?? d.engagement.kinds[k].enabled }]),
    ) as EmailSettings['engagement']['kinds'];
    return {
      engagement: {
        enabled: raw.engagement?.enabled ?? d.engagement.enabled,
        hourBrt: clampHour(raw.engagement?.hourBrt, d.engagement.hourBrt),
        kinds,
      },
      billReminders: {
        enabled: raw.billReminders?.enabled ?? d.billReminders.enabled,
        hourBrt: clampHour(raw.billReminders?.hourBrt, d.billReminders.hourBrt),
      },
    };
  }

  async getAnnouncement(): Promise<AnnouncementSettings | undefined> {
    return this.get<AnnouncementSettings>('announcement');
  }
}
