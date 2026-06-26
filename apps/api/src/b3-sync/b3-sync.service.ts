import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray } from 'drizzle-orm';
import axios from 'axios';
import { DRIZZLE } from '../db/drizzle.module';
import { investments } from '../db/schema';

const BRAPI_BASE = 'https://brapi.dev/api';

@Injectable()
export class B3SyncService {
  private readonly logger = new Logger(B3SyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly config: ConfigService,
  ) {}

  async syncUser(userId: string, clientId: string): Promise<{ updated: number }> {
    const rows = await this.db
      .select()
      .from(investments)
      .where(
        and(
          eq(investments.userId, userId),
          eq(investments.clientId, clientId),
          inArray(investments.type, ['stock', 'fii', 'etf']),
        ),
      );

    const b3Investments = rows.filter((i: any) => i.ticker);
    if (b3Investments.length === 0) return { updated: 0 };

    const tickers = [...new Set<string>(b3Investments.map((i: any) => i.ticker as string))];
    const prices = await this.fetchPrices(tickers);

    let updated = 0;
    for (const inv of b3Investments) {
      const price = prices[inv.ticker];
      if (price == null) continue;
      await this.db
        .update(investments)
        .set({ currentPrice: price.toFixed(2), lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(investments.id, inv.id));
      updated++;
    }

    this.logger.log(`[B3Sync] ${clientId}/${userId} — updated ${updated}/${b3Investments.length} investments`);
    return { updated };
  }

  private async fetchPrices(tickers: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const token = this.config.get<string>('BRAPI_TOKEN');
    const tokenParam = token ? `?token=${token}` : '';

    const BATCH = 10;
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH).join(',');
      try {
        const url = `${BRAPI_BASE}/quote/${batch}${tokenParam}`;
        const { data } = await axios.get(url, { timeout: 10_000 });
        for (const r of data?.results ?? []) {
          if (r.symbol && r.regularMarketPrice != null) {
            prices[r.symbol] = r.regularMarketPrice;
          }
        }
      } catch (err) {
        this.logger.warn(`[B3Sync] Failed to fetch batch ${batch}: ${(err as Error).message}`);
      }
    }
    return prices;
  }

  async syncAllUsers(): Promise<void> {
    const rows: { userId: string; clientId: string }[] = await this.db
      .select({ userId: investments.userId, clientId: investments.clientId })
      .from(investments)
      .where(inArray(investments.type, ['stock', 'fii', 'etf']));

    const unique = new Map<string, { userId: string; clientId: string }>();
    for (const r of rows) unique.set(`${r.clientId}:${r.userId}`, r);

    for (const { userId, clientId } of unique.values()) {
      try {
        await this.syncUser(userId, clientId);
      } catch (err) {
        this.logger.error(`[B3Sync] Failed for ${clientId}/${userId}: ${(err as Error).message}`);
      }
    }
  }
}
