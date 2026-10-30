import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat-tools.service';
import { InsightsService } from './insights.service';
import { ChatEditService } from './chat-edit.service';
import { ChatBillsService } from './chat-bills.service';
import { ChatCategoriesService } from './chat-categories.service';
import { ChatMemoryService } from './chat-memory.service';
import { ChatSnippetsModule } from './chat-snippets.module';
import { EngagementRemindersModule } from '../engagement-reminders/engagement-reminders.module';
import { BillsModule } from '../bills/bills.module';
import { BillSuggestionsModule } from '../bill-suggestions/bill-suggestions.module';
import { SummaryModule } from '../summary/summary.module';

@Module({
  imports: [DrizzleModule, BillsModule, BillSuggestionsModule, SummaryModule, EngagementRemindersModule, ChatSnippetsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService, ChatEditService, ChatBillsService, ChatCategoriesService, ChatMemoryService, InsightsService],
  exports: [ChatService],
})
export class ChatModule {}
