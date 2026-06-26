import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule, ConfigModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
