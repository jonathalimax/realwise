import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { ChatSnippetsService } from './chat-snippets.service';

/** Shared by the chat (reads) and the admin (edits) so both see the same cache. */
@Module({
  imports: [DrizzleModule],
  providers: [ChatSnippetsService],
  exports: [ChatSnippetsService],
})
export class ChatSnippetsModule {}
