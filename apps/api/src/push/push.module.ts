import { Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { WeeklyRecapService } from './weekly-recap.service';

@Module({
  imports: [DrizzleModule],
  controllers: [PushController],
  providers: [PushService, WeeklyRecapService],
  exports: [PushService],
})
export class PushModule {}
