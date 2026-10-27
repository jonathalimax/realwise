import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Admin user management. `DELETE /admin/users/:id` needs Area A's AccountDeletionService through the
 * ACCOUNT_DELETION token (see account-deletion.token.ts); without a provider it answers 503.
 */
@Module({
  imports: [DrizzleModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminGuard],
})
export class AdminUsersModule {}
