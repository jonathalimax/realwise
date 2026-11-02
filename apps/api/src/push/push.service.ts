import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as webpush from 'web-push';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { pushSubscriptions } from '../db/schema';
import { AppSettingsService } from '../app-settings/app-settings.service';

export interface PushPayload {
  title: string;
  body: string;
  /** Path (inside the app) opened when the notification is tapped. */
  url?: string;
  tag?: string;
}

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const VAPID_KEY = 'push.vapid';

/**
 * Web push. VAPID keys come from env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) when set, otherwise one pair is generated on
 * first use and kept in app_settings, so the feature works without touching the deploy secrets.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private keys: Promise<VapidKeys> | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly settings: AppSettingsService,
  ) {}

  private loadKeys(): Promise<VapidKeys> {
    this.keys ??= (async () => {
      const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
      let keys: VapidKeys | undefined =
        VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } : undefined;
      keys ??= await this.settings.get<VapidKeys>(VAPID_KEY);
      if (!keys?.publicKey || !keys.privateKey) {
        keys = webpush.generateVAPIDKeys();
        await this.settings.set(VAPID_KEY, keys);
        this.logger.log('Generated a new VAPID key pair');
      }
      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:contato@realwise.com.br', keys.publicKey, keys.privateKey);
      return keys;
    })().catch((e) => {
      this.keys = null; // let the next call retry instead of caching a failure
      throw e;
    });
    return this.keys;
  }

  async publicKey(): Promise<string> {
    return (await this.loadKeys()).publicKey;
  }

  async status(userId: string): Promise<{ subscribed: boolean; devices: number }> {
    const rows = await this.db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    return { subscribed: rows.length > 0, devices: rows.length };
  }

  async subscribe(userId: string, clientId: string, input: SubscriptionInput): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({ userId, clientId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent?.slice(0, 255) ?? null })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, clientId, p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent?.slice(0, 255) ?? null, updatedAt: new Date() },
      });
  }

  async unsubscribe(userId: string, endpoint?: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(endpoint ? and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)) : eq(pushSubscriptions.userId, userId));
  }

  /** Sends to every device of the user. Dead subscriptions (404/410) are removed. Returns how many devices accepted it. */
  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    const subs = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (subs.length === 0) return 0;
    await this.loadKeys();
    const base = (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/+$/, '');
    let delivered = 0;
    for (const sub of subs) {
      // In-app paths live under the client id (the web router's basename); absolute URLs are used as they are.
      const url = payload.url?.startsWith('/') ? `${base}/${sub.clientId}${payload.url}` : payload.url ?? `${base}/${sub.clientId}/dashboard`;
      const body = JSON.stringify({ ...payload, url });
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: 60 * 60 * 12 });
        delivered += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          this.logger.warn(`push to ${sub.id} failed: ${(e as Error).message}`);
        }
      }
    }
    return delivered;
  }
}
