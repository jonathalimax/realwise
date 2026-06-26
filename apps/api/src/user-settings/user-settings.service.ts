import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { settings } from '../db/schema';
import { UpsertUserSettingsDto } from './dto/upsert-user-settings.dto';

type Settings = typeof settings.$inferSelect;

@Injectable()
export class UserSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async get(clientId: string, userId: string): Promise<Settings | null> {
    const rows = await this.db
      .select().from(settings)
      .where(and(eq(settings.clientId, clientId), eq(settings.userId, userId)));
    return rows[0] ?? null;
  }

  async upsert(dto: UpsertUserSettingsDto, clientId: string, userId: string): Promise<Settings> {
    const rows = await this.db
      .insert(settings)
      .values({ ...dto, clientId, userId })
      .onConflictDoUpdate({
        target: [settings.clientId, settings.userId],
        set: { ...dto, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }
}
