import { Module } from '@nestjs/common';
import { EmailBudgetService } from './email-budget.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService, EmailBudgetService],
  exports: [NotificationsService, EmailBudgetService],
})
export class NotificationsModule {}
