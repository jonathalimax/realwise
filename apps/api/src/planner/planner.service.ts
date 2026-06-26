import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { planner } from '../db/schema';
import { UpsertPlannerDto } from './dto/upsert-planner.dto';

type Planner = typeof planner.$inferSelect;

@Injectable()
export class PlannerService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async get(clientId: string, userId: string): Promise<Planner | null> {
    const rows = await this.db
      .select().from(planner)
      .where(and(eq(planner.clientId, clientId), eq(planner.userId, userId)));
    return rows[0] ?? null;
  }

  async upsert(dto: UpsertPlannerDto, clientId: string, userId: string): Promise<Planner> {
    const rows = await this.db
      .insert(planner)
      .values({ ...dto, clientId, userId })
      .onConflictDoUpdate({
        target: [planner.clientId, planner.userId],
        set: { ...dto, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }
}
