import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { B3SyncService } from './b3-sync.service';
import { B3SyncScheduler } from './b3-sync.scheduler';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule, ConfigModule],
  providers: [B3SyncService, B3SyncScheduler],
  exports: [B3SyncService],
})
export class B3SyncModule {}
