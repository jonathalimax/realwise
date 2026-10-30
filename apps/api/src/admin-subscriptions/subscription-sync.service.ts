import { Inject, Injectable, Logger } from '@nestjs/common';
import { isNotNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { BillingService } from '../billing/billing.service';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';

export interface SyncAllStatus {
  running: boolean;
  total: number;
  done: number;
  /** Users whose subscription status or plan changed. */
  updated: number;
  failed: number;
  startedAt: string | null;
  finishedAt: string | null;
}

const CONCURRENCY = 4;
const MAX_USERS = 2000;

/**
 * Re-reads every Stripe customer's subscription into our database: the catch-up after a webhook that never worked.
 * Runs in the background (a loop over many customers outlasts an HTTP request) and reports progress for the admin to poll.
 */
@Injectable()
export class SubscriptionSyncService {
  private readonly logger = new Logger(SubscriptionSyncService.name);
  private state: SyncAllStatus = { running: false, total: 0, done: 0, updated: 0, failed: 0, startedAt: null, finishedAt: null };

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly billing: BillingService,
  ) {}

  status(): SyncAllStatus {
    return { ...this.state };
  }

  /** Starts the run (or reports the one already running). Returns right away. */
  async start(): Promise<SyncAllStatus> {
    if (this.state.running) return this.status();
    const rows = await this.db
      .select({ id: users.id, status: users.subscriptionStatus, plan: users.subscriptionPlan })
      .from(users)
      .where(isNotNull(users.stripeCustomerId))
      .limit(MAX_USERS);
    this.state = { running: true, total: rows.length, done: 0, updated: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: null };
    void this.run(rows);
    return this.status();
  }

  private async run(rows: { id: string; status: string | null; plan: string | null }[]): Promise<void> {
    const queue = [...rows];
    const worker = async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        try {
          const after = await this.billing.syncFromStripe(row.id);
          if ((after.subscriptionStatus ?? null) !== row.status || (after.plan ?? null) !== row.plan) this.state.updated += 1;
        } catch (error) {
          this.state.failed += 1;
          this.logger.warn(`sync failed for ${row.id}: ${(error as Error).message}`);
        }
        this.state.done += 1;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    this.state.running = false;
    this.state.finishedAt = new Date().toISOString();
    this.logger.log(`Stripe sync finished: ${this.state.done} checked, ${this.state.updated} updated, ${this.state.failed} failed`);
  }
}
