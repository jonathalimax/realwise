import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { BillRemindersModule } from '../bill-reminders/bill-reminders.module';
import { DrizzleModule } from '../db/drizzle.module';
import { EngagementRemindersModule } from '../engagement-reminders/engagement-reminders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminActorService } from './admin-actor.service';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSnippetsController } from './admin-snippets.controller';
import { ChatSnippetsModule } from '../chat/chat-snippets.module';
import { AdminSupportController } from './admin-support.controller';
import { CampaignsScheduler } from './campaigns.scheduler';
import { CampaignsService } from './campaigns.service';
import { PublicCommsController } from './public.controller';

/** Admin API for communication (support inbox, campaigns, reminder emails, announcement) and runtime settings. */
@Module({
  imports: [DrizzleModule, AppSettingsModule, NotificationsModule, EngagementRemindersModule, BillRemindersModule, ChatSnippetsModule],
  controllers: [AdminSettingsController, AdminSnippetsController, AdminSupportController, AdminCampaignsController, PublicCommsController],
  providers: [AdminActorService, CampaignsService, CampaignsScheduler],
  exports: [AppSettingsModule],
})
export class AdminCommsModule {}
