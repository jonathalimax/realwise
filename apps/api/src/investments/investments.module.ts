import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { DrizzleModule } from '../db/drizzle.module';
import { B3SyncModule } from '../b3-sync/b3-sync.module';

@Module({
  imports: [DrizzleModule, B3SyncModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
})
export class InvestmentsModule {}
