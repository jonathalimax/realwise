import { Module } from '@nestjs/common';
import { BillRemindersService } from './bill-reminders.service';
import { BillRemindersScheduler } from './bill-reminders.scheduler';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillActionsModule } from '../bill-actions/bill-actions.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [DrizzleModule, NotificationsModule, BillActionsModule, PushModule],
  providers: [BillRemindersService, BillRemindersScheduler],
  exports: [BillRemindersService],
})
export class BillRemindersModule {}
