import { Module } from '@nestjs/common';
import { BillRemindersService } from './bill-reminders.service';
import { BillRemindersScheduler } from './bill-reminders.scheduler';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  providers: [BillRemindersService, BillRemindersScheduler],
})
export class BillRemindersModule {}
