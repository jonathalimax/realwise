import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppSettingsService, brtHour } from '../app-settings/app-settings.service';
import { EngagementRemindersService } from './engagement-reminders.service';

@Injectable()
export class EngagementRemindersScheduler {
  private readonly logger = new Logger(EngagementRemindersScheduler.name);

  constructor(
    private readonly service: EngagementRemindersService,
    private readonly settings: AppSettingsService,
  ) {}

  // Checked hourly; runs only at the configured Brasilia hour (default 10:00, an hour after bill reminders so the
  // two never compete for the same inbox moment) and only while the group is enabled in the admin settings.
  @Cron('0 * * * *', { timeZone: 'America/Sao_Paulo' })
  async hourly(): Promise<void> {
    const { engagement } = await this.settings.getEmails();
    if (!engagement.enabled || brtHour(new Date()) !== engagement.hourBrt) return;
    this.logger.log('[EngagementReminders] Starting scheduled run');
    await this.service.runForAllUsers();
  }
}
