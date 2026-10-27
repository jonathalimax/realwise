import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { supportMessages, users } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

export interface SupportConfig {
  whatsapp: string;
  email: string;
}

export interface CreateSupportMessageInput {
  /** Session user (from the JWT cookie), when there is one. */
  userId: string | null;
  ipKey: string;
  message: string;
  name?: string;
  email?: string;
  subject?: string;
}

const DEFAULT_WHATSAPP = '5541992310339';
const DEFAULT_SUPPORT_EMAIL = 'suporte@realwise.com.br';
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export function supportEmailAddress(): string {
  return process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  /** key -> timestamps (ms) of recent messages. In memory: good enough to stop casual abuse. */
  private readonly hits = new Map<string, number[]>();

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly notifications: NotificationsService,
  ) {}

  getConfig(): SupportConfig {
    const whatsapp = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '') || DEFAULT_WHATSAPP;
    return { whatsapp, email: supportEmailAddress() };
  }

  private allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  private sweep(now: number): void {
    if (this.hits.size < 1000) return;
    for (const [key, list] of this.hits) {
      if (list.every((at) => now - at >= RATE_WINDOW_MS)) this.hits.delete(key);
    }
  }

  async createMessage(input: CreateSupportMessageInput): Promise<void> {
    const message = input.message.trim();
    if (message.length < 5) throw new BadRequestException('Message is too short');

    let name = input.name?.trim() || null;
    let email = input.email?.trim().toLowerCase() || null;
    let userId: string | null = null;

    if (input.userId) {
      const rows = await this.db.select().from(users).where(eq(users.id, input.userId));
      if (rows[0]) {
        userId = rows[0].id;
        email = rows[0].email;
        name = rows[0].name ?? name;
      }
    }
    if (!email) throw new BadRequestException('Email is required');

    const now = Date.now();
    this.sweep(now);
    const keys = [userId ? `user:${userId}` : `ip:${input.ipKey}`, `email:${email}`];
    if (!keys.every((key) => this.allow(key, now))) {
      throw new HttpException('Too many messages, try again later', HttpStatus.TOO_MANY_REQUESTS);
    }

    const source = userId ? 'app' : 'login';
    const subject = input.subject?.trim() || null;
    await this.db.insert(supportMessages).values({ userId, name, email, subject, message, source });

    try {
      await this.notifications.sendSupportMessageEmail({
        to: supportEmailAddress(),
        fromName: name,
        fromEmail: email,
        subject,
        message,
        source,
        userId,
      });
    } catch (error) {
      // The message is stored and visible in the admin inbox; do not fail the user's request.
      this.logger.error(`Failed to e-mail support message: ${String(error)}`);
    }
  }
}
