import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { budgets } from '../db/schema';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/create-budget.dto';

type Budget = typeof budgets.$inferSelect;

@Injectable()
export class BudgetsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private mapBudgetDto(dto: CreateBudgetDto | UpdateBudgetDto) {
    return {
      ...dto,
      amount: dto.amount !== undefined ? String(dto.amount) : undefined,
      totalBudget: dto.totalBudget !== undefined ? String(dto.totalBudget) : undefined,
      categoryBudgets: dto.categoryBudgets ?? undefined,
    };
  }

  findAll(clientId: string, userId: string): Promise<Budget[]> {
    return this.db.select().from(budgets).where(and(eq(budgets.clientId, clientId), eq(budgets.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Budget> {
    const rows = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.clientId, clientId), eq(budgets.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateBudgetDto, clientId: string, userId: string): Promise<Budget> {
    const rows = await this.db.insert(budgets).values({ ...this.mapBudgetDto(dto), clientId, userId }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateBudgetDto, clientId: string, userId: string): Promise<Budget> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(budgets)
      .set({ ...this.mapBudgetDto(dto), updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.clientId, clientId), eq(budgets.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.clientId, clientId), eq(budgets.userId, userId)));
  }
}
