import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat-tools.service';
import { InsightsService } from './insights.service';

@Module({
  imports: [DrizzleModule],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService, InsightsService],
})
export class ChatModule {}
