import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminErrorsController } from './admin-errors.controller';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ErrorLogService } from './error-log.service';
import { PublicErrorsController } from './public-errors.controller';

@Global()
@Module({
  imports: [DrizzleModule],
  controllers: [PublicErrorsController, AdminErrorsController],
  providers: [ErrorLogService, AdminGuard, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
