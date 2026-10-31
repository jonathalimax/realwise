import { Module } from '@nestjs/common';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BillingModule } from '../billing/billing.module';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminRetentionController } from './admin-retention.controller';
import { CancelFlowController } from './cancel-flow.controller';
import { CancelFlowService } from './cancel-flow.service';
import { RetentionSettingsService } from './retention-settings.service';
import { WinbackService } from './winback.service';

/** Cancel flow with save offers, win-back codes and the admin's churn view. Depends on billing, never the reverse. */
@Module({
  imports: [DrizzleModule, BillingModule],
  controllers: [CancelFlowController, AdminRetentionController],
  providers: [CancelFlowService, RetentionSettingsService, WinbackService, AdminGuard, AdminActorService],
  exports: [WinbackService, RetentionSettingsService],
})
export class RetentionModule {}
