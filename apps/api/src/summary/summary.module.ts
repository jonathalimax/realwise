import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminSummaryController, PublicSummaryController, SummaryController } from './summary.controller';
import { SummaryScheduler } from './summary.scheduler';
import { SummaryService } from './summary.service';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  controllers: [PublicSummaryController, SummaryController, AdminSummaryController],
  providers: [SummaryService, SummaryScheduler, AdminGuard],
  exports: [SummaryService],
})
export class SummaryModule {}
