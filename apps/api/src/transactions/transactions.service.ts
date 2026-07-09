import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { transactions } from '../db/schema';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';

type Transaction = typeof transactions.$inferSelect;
type TransactionPayload = Partial<Omit<typeof transactions.$inferInsert, 'clientId' | 'userId'>>;
type CreateTransactionPayload = Omit<typeof transactions.$inferInsert, 'clientId' | 'userId'>;

@Injectable()
export class TransactionsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private normalizeAmount(amount: unknown): string | undefined {
    if (amount == null) {
      return undefined;
    }

    if (typeof amount === 'number' && Number.isFinite(amount)) {
      return amount.toFixed(2);
    }

    if (typeof amount === 'string') {
      const trimmed = amount.trim();
      if (!trimmed) {
        return trimmed;
      }

      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed.toFixed(2);
      }

      return trimmed;
    }

    return String(amount);
  }

  private normalizePayload(dto: UpdateTransactionDto): TransactionPayload {
    return {
      ...dto,
      amount: dto.amount != null ? this.normalizeAmount(dto.amount) : undefined,
      date: dto.date ? dto.date.slice(0, 10) : undefined,
      recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null,
    };
  }

  private normalizeCreatePayload(dto: CreateTransactionDto): CreateTransactionPayload {
    return {
      ...dto,
      amount: this.normalizeAmount(dto.amount),
      date: dto.date.slice(0, 10),
      recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null,
    };
  }

  findAll(clientId: string, userId: string, filters: ListTransactionsDto): Promise<Transaction[]> {
    const conditions = [eq(transactions.clientId, clientId), eq(transactions.userId, userId)];

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const start = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0);
      const end = endDate.toISOString().slice(0, 10);
      conditions.push(gte(transactions.date, start));
      conditions.push(lte(transactions.date, end));
    }
    if (filters.type) conditions.push(eq(transactions.type, filters.type));
    if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
    if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));

    const limit = filters.limit ? Number(filters.limit) : 200;
    const offset = filters.offset ? Number(filters.offset) : 0;

    return this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(sql`${transactions.date} DESC`)
      .limit(limit)
      .offset(offset);
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Transaction> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateTransactionDto, clientId: string, userId: string): Promise<Transaction> {
    const rows = await this.db
      .insert(transactions)
      .values({ ...this.normalizeCreatePayload(dto), clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateTransactionDto, clientId: string, userId: string): Promise<Transaction> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(transactions)
      .set({ ...this.normalizePayload(dto), updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId)));
  }
}
