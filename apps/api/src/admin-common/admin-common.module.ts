import { Global, Module } from '@nestjs/common';
import { DrizzleModule } from '../db/drizzle.module';
import { AdminAuditService } from './admin-audit.service';

@Global()
@Module({ imports: [DrizzleModule], providers: [AdminAuditService], exports: [AdminAuditService] })
export class AdminCommonModule {}
