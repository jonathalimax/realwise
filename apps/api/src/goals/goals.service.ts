import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { goals } from '../db/schema';
import { CreateGoalDto, UpdateGoalDto } from './dto/create-goal.dto';

type Goal = typeof goals.$inferSelect;

@Injectable()
export class GoalsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  findAll(clientId: string, userId: string): Promise<Goal[]> {
    return this.db.select().from(goals).where(and(eq(goals.clientId, clientId), eq(goals.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Goal> {
    const rows = await this.db
      .select().from(goals)
      .where(and(eq(goals.id, id), eq(goals.clientId, clientId), eq(goals.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateGoalDto, clientId: string, userId: string): Promise<Goal> {
    const rows = await this.db.insert(goals).values({ ...dto, clientId, userId }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateGoalDto, clientId: string, userId: string): Promise<Goal> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(goals).set({ ...dto, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.clientId, clientId), eq(goals.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(goals).where(and(eq(goals.id, id), eq(goals.clientId, clientId), eq(goals.userId, userId)));
  }
}
