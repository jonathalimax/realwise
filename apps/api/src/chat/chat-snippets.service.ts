import { Inject, Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { chatSnippets } from '../db/schema';

export interface Snippet {
  key: string;
  title: string;
  body: string;
  quickReplies: string[];
  triggerLabel: string | null;
}

const TTL_MS = 5 * 60_000;
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Elio's fixed explanations, read from the database (cached a few minutes) so they never cost model tokens. */
@Injectable()
export class ChatSnippetsService {
  private cache: { at: number; rows: Snippet[] } | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private async all(): Promise<Snippet[]> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.rows;
    const rows = (await this.db.select().from(chatSnippets).orderBy(asc(chatSnippets.sortOrder))).map((r) => ({
      key: r.key,
      title: r.title,
      body: r.body,
      quickReplies: Array.isArray(r.quickReplies) ? r.quickReplies : [],
      triggerLabel: r.triggerLabel,
    }));
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  async get(key: string): Promise<Snippet | null> {
    return (await this.all()).find((s) => s.key === key) ?? null;
  }

  /** The snippet a tapped quick-reply chip stands for, if the text is exactly its label. */
  async byTrigger(text: string): Promise<Snippet | null> {
    if (text.length > 80) return null;
    const t = norm(text);
    return (await this.all()).find((s) => s.triggerLabel && norm(s.triggerLabel) === t) ?? null;
  }

  async keys(): Promise<string[]> {
    return (await this.all()).map((s) => s.key);
  }
}
