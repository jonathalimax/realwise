import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppSettingsService, brtHour } from '../app-settings/app-settings.service';
import { BillRemindersService } from './bill-reminders.service';

@Injectable()
export class BillRemindersScheduler {
  private readonly logger = new Logger(BillRemindersScheduler.name);

  constructor(
    private readonly service: BillRemindersService,
    private readonly settings: AppSettingsService,
  ) {}

  // Checked hourly; runs only at the configured Brasilia hour (default 09:00) and only while enabled in the admin settings.
  @Cron('0 * * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyReminders(): Promise<void> {
    const { billReminders } = await this.settings.getEmails();
    if (!billReminders.enabled || brtHour(new Date()) !== billReminders.hourBrt) return;
    this.logger.log('[BillReminders] Starting daily reminder run');
    await this.service.runForAllUsers();
    this.logger.log('[BillReminders] Daily reminder run complete');
  }
}
