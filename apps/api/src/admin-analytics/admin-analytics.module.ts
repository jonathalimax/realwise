import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { LastActiveInterceptor } from './last-active.interceptor';

@Module({
  imports: [DrizzleModule],
  controllers: [AdminAnalyticsController],
  providers: [
    AdminAnalyticsService,
    AdminGuard,
    // Global: stamps users.last_active_at (throttled to once per 10 minutes per user).
    { provide: APP_INTERCEPTOR, useClass: LastActiveInterceptor },
  ],
})
export class AdminAnalyticsModule {}
