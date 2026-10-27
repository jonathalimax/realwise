import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { adminAuditLog } from '../db/schema';

export interface AuditEntry {
  adminUserId?: string | null;
  adminEmail?: string | null;
  action: string;
  targetUserId?: string | null;
  targetLabel?: string | null;
  details?: Record<string, unknown>;
}

/** One place that records admin actions. Never throws: an audit failure must not block the action. */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(adminAuditLog).values({
        adminUserId: entry.adminUserId ?? null,
        adminEmail: entry.adminEmail ?? null,
        action: entry.action,
        targetUserId: entry.targetUserId ?? null,
        targetLabel: entry.targetLabel ?? null,
        details: entry.details ?? null,
      });
    } catch (e) {
      this.logger.error(`audit write failed for ${entry.action}: ${(e as Error).message}`);
    }
  }
}
