import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BillsModule } from './bills/bills.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { InvestmentsModule } from './investments/investments.module';
import { PlannerModule } from './planner/planner.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { ImportsModule } from './imports/imports.module';
import { BillRemindersModule } from './bill-reminders/bill-reminders.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DrizzleModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BillsModule,
    BudgetsModule,
    GoalsModule,
    InvestmentsModule,
    PlannerModule,
    UserSettingsModule,
    ImportsModule,
    BillRemindersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
