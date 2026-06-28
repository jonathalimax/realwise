import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { CategorizationRulesController } from './categorization-rules.controller';
import { CategorizationRulesService } from './categorization-rules.service';

@Module({
  imports: [DrizzleModule],
  controllers: [CategorizationRulesController],
  providers: [CategorizationRulesService],
  exports: [CategorizationRulesService],
})
export class CategorizationRulesModule {}
