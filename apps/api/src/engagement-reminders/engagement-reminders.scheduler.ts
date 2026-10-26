import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EngagementRemindersService } from './engagement-reminders.service';

@Injectable()
export class EngagementRemindersScheduler {
  constructor(private readonly service: EngagementRemindersService) {}

  // 10:00 Brasilia, an hour after bill reminders so the two never compete for the same inbox moment.
  @Cron('0 10 * * *', { timeZone: 'America/Sao_Paulo' })
  async daily(): Promise<void> {
    await this.service.runForAllUsers();
  }
}
