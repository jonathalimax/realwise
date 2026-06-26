import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { B3SyncService } from './b3-sync.service';

@Injectable()
export class B3SyncScheduler {
  private readonly logger = new Logger(B3SyncScheduler.name);

  constructor(private readonly b3Sync: B3SyncService) {}

  // Daily at 9 AM Brasilia time (UTC-3 → 12:00 UTC)
  @Cron('0 12 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailySync(): Promise<void> {
    this.logger.log('[B3Sync] Starting daily B3 sync for all users');
    await this.b3Sync.syncAllUsers();
    this.logger.log('[B3Sync] Daily B3 sync complete');
  }
}
