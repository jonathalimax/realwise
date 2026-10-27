import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AccountModule } from '../account/account.module';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Admin user management. `DELETE /admin/users/:id` uses AccountDeletionService through the ACCOUNT_DELETION token
 * (see account-deletion.token.ts), provided by AccountModule.
 */
@Module({
  imports: [DrizzleModule, AccountModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminGuard],
})
export class AdminUsersModule {}
