import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EngagementRemindersController } from './engagement-reminders.controller';
import { EngagementRemindersScheduler } from './engagement-reminders.scheduler';
import { EngagementRemindersService } from './engagement-reminders.service';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [EngagementRemindersController],
  providers: [EngagementRemindersService, EngagementRemindersScheduler],
  exports: [EngagementRemindersService],
})
export class EngagementRemindersModule {}
