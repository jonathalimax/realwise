import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Business modules (Plan 5)
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BillsModule } from './bills/bills.module';
import { BudgetsModule } from './budgets/budgets.module';
import { InvestmentsModule } from './investments/investments.module';
import { PlannerModule } from './planner/planner.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { CategorizationRulesModule } from './categorization-rules/categorization-rules.module';

// Feature parity modules (Plan 6)
import { StorageModule } from './storage/storage.module';
import { ImportsModule } from './imports/imports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { B3SyncModule } from './b3-sync/b3-sync.module';
import { BillRemindersModule } from './bill-reminders/bill-reminders.module';
import { BillActionsModule } from './bill-actions/bill-actions.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    HealthModule,
    AuthModule,
    // Plan 5
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BillsModule,
    BudgetsModule,
    InvestmentsModule,
    PlannerModule,
    UserSettingsModule,
    CategorizationRulesModule,
    // Plan 6
    StorageModule,
    ImportsModule,
    NotificationsModule,
    B3SyncModule,
    BillRemindersModule,
    BillActionsModule,
    AdminModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
