import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { investments } from '../db/schema';
import { CreateInvestmentDto, UpdateInvestmentDto } from './dto/create-investment.dto';

type Investment = typeof investments.$inferSelect;

@Injectable()
export class InvestmentsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  findAll(clientId: string, userId: string): Promise<Investment[]> {
    return this.db.select().from(investments).where(and(eq(investments.clientId, clientId), eq(investments.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Investment> {
    const rows = await this.db
      .select().from(investments)
      .where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateInvestmentDto, clientId: string, userId: string): Promise<Investment> {
    const rows = await this.db.insert(investments).values({ ...dto, clientId, userId }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateInvestmentDto, clientId: string, userId: string): Promise<Investment> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(investments).set({ ...dto, updatedAt: new Date() })
      .where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(investments).where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)));
  }
}
