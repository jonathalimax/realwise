import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { pushSubscriptions, transactions, users } from '../db/schema';
import { computeAccess } from '../billing/access';
import { weeklyRecapPush } from './push-catalog';
import { PushService } from './push.service';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Sunday evening: how much was spent in the last 7 days against the 7 before. Push only, for people who opted in. */
@Injectable()
export class WeeklyRecapService {
  private readonly logger = new Logger(WeeklyRecapService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly push: PushService,
  ) {}

  @Cron('0 18 * * 0', { timeZone: 'America/Sao_Paulo' })
  async scheduled(): Promise<void> {
    const result = await this.run();
    this.logger.log(`[WeeklyRecap] sent=${result.sent} skipped=${result.skipped}`);
  }

  private async spent(userId: string, from: Date, to: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          eq(transactions.ignored, false),
          eq(transactions.isTransfer, false),
          isNull(transactions.deletedAt),
          gte(transactions.date, isoDay(from)),
          lte(transactions.date, isoDay(to)),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async run(now = new Date()): Promise<{ sent: number; skipped: number }> {
    const subscribed = await this.db.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions);
    if (subscribed.length === 0) return { sent: 0, skipped: 0 };
    const rows = await this.db.select().from(users).where(inArray(users.id, subscribed.map((s) => s.userId)));

    const day = 86_400_000;
    const weekStart = new Date(now.getTime() - 6 * day);
    const prevEnd = new Date(now.getTime() - 7 * day);
    const prevStart = new Date(now.getTime() - 13 * day);
    let sent = 0;
    let skipped = 0;
    for (const user of rows) {
      try {
        if (!computeAccess(user, now).allowed) { skipped++; continue; }
        const spent = await this.spent(user.id, weekStart, now);
        if (spent <= 0) { skipped++; continue; }
        const previous = await this.spent(user.id, prevStart, prevEnd);
        if ((await this.push.sendToUser(user.id, weeklyRecapPush(spent, previous))) > 0) sent++;
        else skipped++;
      } catch (e) {
        skipped++;
        this.logger.error(`weekly recap failed for ${user.id}: ${(e as Error).message}`);
      }
    }
    return { sent, skipped };
  }
}
