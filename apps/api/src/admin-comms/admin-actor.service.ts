import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AdminAuditService, AuditEntry } from '../admin-common/admin-audit.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';

/** Records an admin action attributed to the logged-in admin (the JWT only carries the id, so the email is looked up). */
@Injectable()
export class AdminActorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly audit: AdminAuditService,
  ) {}

  async email(actor: JwtPayload): Promise<string | null> {
    try {
      const [row] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, actor.sub)).limit(1);
      return row?.email ?? null;
    } catch {
      return null;
    }
  }

  async record(actor: JwtPayload, entry: Omit<AuditEntry, 'adminUserId' | 'adminEmail'>): Promise<void> {
    await this.audit.record({ ...entry, adminUserId: actor.sub, adminEmail: await this.email(actor) });
  }
}
