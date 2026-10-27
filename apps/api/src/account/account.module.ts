import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DrizzleModule } from '../db/drizzle.module';
import { StorageModule } from '../storage/storage.module';
import { AccountDeletionService } from './account-deletion.service';
import { AccountController } from './account.controller';

@Module({
  imports: [DrizzleModule, BillingModule, StorageModule],
  controllers: [AccountController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountModule {}
