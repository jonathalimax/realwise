import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminLlmController } from './admin-llm.controller';
import { AdminLlmService } from './admin-llm.service';

@Module({
  imports: [DrizzleModule],
  controllers: [AdminLlmController],
  providers: [AdminLlmService, AdminGuard],
})
export class AdminLlmModule {}
