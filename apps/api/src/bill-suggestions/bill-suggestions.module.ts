import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { DrizzleModule } from '../db/drizzle.module';
import { BillSuggestionsService } from './bill-suggestions.service';

@Module({
  imports: [DrizzleModule, BillsModule],
  providers: [BillSuggestionsService],
  exports: [BillSuggestionsService],
})
export class BillSuggestionsModule {}
