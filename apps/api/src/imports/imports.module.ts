import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BankParserService } from './bank-parser.service';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    DrizzleModule,
    NotificationsModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [ImportsController],
  providers: [BankParserService, ImportsService],
})
export class ImportsModule {}
