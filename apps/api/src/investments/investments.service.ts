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

  private normalizeDateOnly(value?: string | null): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return value.slice(0, 10);
  }

  private normalizeTimestamp(value?: string | null): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return new Date(value);
  }

  private mapInvestmentDto(dto: CreateInvestmentDto | UpdateInvestmentDto) {
    return {
      ...dto,
      initialAmount: dto.initialAmount !== undefined ? String(dto.initialAmount) : undefined,
      currentAmount: dto.currentAmount !== undefined ? String(dto.currentAmount) : undefined,
      expectedReturn: dto.expectedReturn !== undefined ? String(dto.expectedReturn) : undefined,
      quantity: dto.quantity !== undefined ? String(dto.quantity) : undefined,
      avgPrice: dto.avgPrice !== undefined ? String(dto.avgPrice) : undefined,
      currentPrice: dto.currentPrice !== undefined ? String(dto.currentPrice) : undefined,
      totalWithdrawn: dto.totalWithdrawn !== undefined ? String(dto.totalWithdrawn) : undefined,
      purchaseDate: this.normalizeDateOnly(dto.purchaseDate),
      maturityDate: this.normalizeDateOnly(dto.maturityDate),
      lastWithdrawDate: this.normalizeTimestamp(dto.lastWithdrawDate),
    };
  }

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
    const rows = await this.db.insert(investments).values({
      ...this.mapInvestmentDto(dto),
      clientId,
      userId,
      name: dto.name,
      type: dto.type,
    }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateInvestmentDto, clientId: string, userId: string): Promise<Investment> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(investments).set({ ...this.mapInvestmentDto(dto), updatedAt: new Date() })
      .where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(investments).where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)));
  }
}
