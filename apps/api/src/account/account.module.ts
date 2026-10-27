import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DrizzleModule } from '../db/drizzle.module';
import { StorageModule } from '../storage/storage.module';
import { AccountDeletionService } from './account-deletion.service';
import { AccountController } from './account.controller';
import { ACCOUNT_DELETION } from '../admin-users/account-deletion.token';

@Module({
  imports: [DrizzleModule, BillingModule, StorageModule],
  controllers: [AccountController],
  providers: [AccountDeletionService, { provide: ACCOUNT_DELETION, useExisting: AccountDeletionService }],
  exports: [AccountDeletionService, ACCOUNT_DELETION],
})
export class AccountModule {}
