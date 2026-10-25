import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { LlmService } from './llm.service';
import { OpenRouterProvider } from './openrouter.provider';
import { LLM_PROVIDER } from './llm.types';

@Global()
@Module({
  imports: [DrizzleModule],
  providers: [OpenRouterProvider, { provide: LLM_PROVIDER, useExisting: OpenRouterProvider }, LlmService],
  exports: [LlmService],
})
export class LlmModule {}
