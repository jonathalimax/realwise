import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { transactions } from '../db/schema';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';

type Transaction = typeof transactions.$inferSelect;

@Injectable()
export class TransactionsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

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
    if (filters.type) conditions.push(eq(transactions.type, filters.type as 'income' | 'expense'));
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
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateTransactionDto, clientId: string, userId: string): Promise<Transaction> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(transactions)
      .set({ ...dto, updatedAt: new Date() })
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
