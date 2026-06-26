import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillRemindersService } from './bill-reminders.service';

@Injectable()
export class BillRemindersScheduler {
  private readonly logger = new Logger(BillRemindersScheduler.name);

  constructor(private readonly service: BillRemindersService) {}

  // Daily at 9 AM Brasilia time (UTC-3 → 12:00 UTC)
  @Cron('0 12 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyReminders(): Promise<void> {
    this.logger.log('[BillReminders] Starting daily reminder run');
    await this.service.runForAllUsers();
    this.logger.log('[BillReminders] Daily reminder run complete');
  }
}
