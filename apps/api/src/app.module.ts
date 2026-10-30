import { AdminSubscriptionsModule } from './admin-subscriptions/admin-subscriptions.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from './billing/subscription.guard';
import { BillingModule } from './billing/billing.module';

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
import { EngagementRemindersModule } from './engagement-reminders/engagement-reminders.module';
import { AdminCommonModule } from './admin-common/admin-common.module';
import { SupportModule } from './support/support.module';
import { AccountModule } from './account/account.module';
import { AdminUsersModule } from './admin-users/admin-users.module';
import { AdminLlmModule } from './admin-llm/admin-llm.module';
import { AdminAnalyticsModule } from './admin-analytics/admin-analytics.module';
import { AdminCommsModule } from './admin-comms/admin-comms.module';
import { AdminCouponsModule } from './admin-coupons/admin-coupons.module';
import { LandingModule } from './landing/landing.module';
import { BillActionsModule } from './bill-actions/bill-actions.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';

// AI assistant
import { LlmModule } from './llm/llm.module';
import { ChatModule } from './chat/chat.module';

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
    EngagementRemindersModule,
    AdminCommonModule,
    SupportModule,
    AccountModule,
    AdminUsersModule,
    AdminLlmModule,
    AdminAnalyticsModule,
    AdminCommsModule,
    AdminCouponsModule,
    AdminSubscriptionsModule,
    LandingModule,
    BillActionsModule,
    AdminModule,
    PaymentsModule,
    BillingModule,
    // AI assistant
    LlmModule,
    ChatModule,
  ],
  // Order matters: JwtAuthGuard authenticates (sets request.user), SubscriptionGuard then enforces the paywall.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
})
export class AppModule {}
