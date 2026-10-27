import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RawQuery } from '../admin-common/admin-query.util';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  @Get('analytics/overview')
  overview(@Query() query: RawQuery) {
    return this.service.overview(query);
  }

  @Get('analytics/users-usage')
  usersUsage(@Query() query: RawQuery) {
    return this.service.usersUsage(query);
  }

  @Get('audit')
  audit(@Query() query: RawQuery) {
    return this.service.audit(query);
  }
}
