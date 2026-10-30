import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AdminAnalyticsModule } from '../admin-analytics/admin-analytics.module';
import { ChatModule } from '../chat/chat.module';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminSimulatorController } from './admin-simulator.controller';
import { OpsAssistantService } from './ops-assistant.service';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [DrizzleModule, AccountModule, AdminAnalyticsModule, ChatModule],
  controllers: [AdminSimulatorController],
  providers: [SimulatorService, OpsAssistantService],
})
export class AdminSimulatorModule {}
