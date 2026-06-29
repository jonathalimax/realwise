import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { BillsModule } from '../bills/bills.module';
import { BillActionsController } from './bill-actions.controller';
import { BillActionsService } from './bill-actions.service';

@Module({
  imports: [DrizzleModule, BillsModule],
  controllers: [BillActionsController],
  providers: [BillActionsService],
  exports: [BillActionsService],
})
export class BillActionsModule {}
