import { Module } from '@nestjs/common';
import { AdminActorService } from '../admin-comms/admin-actor.service';
import { AdminCommonModule } from '../admin-common/admin-common.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BillingModule } from '../billing/billing.module';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminCouponsController } from './admin-coupons.controller';

@Module({
  imports: [BillingModule, DrizzleModule, AdminCommonModule],
  controllers: [AdminCouponsController],
  providers: [AdminGuard, AdminActorService],
})
export class AdminCouponsModule {}
