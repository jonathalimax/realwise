import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lte, ne, sql, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { categories, transactions } from '../db/schema';
import { pairTransfers } from '../chat/transfer';
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
    const conditions = [eq(transactions.clientId, clientId), eq(transactions.userId, userId), isNull(transactions.deletedAt)];

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
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId), isNull(transactions.deletedAt)));
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
    const existing = await this.findOne(id, clientId, userId);
    const patch = this.normalizePayload(dto);

    // A category chosen by name alone: keep its id in sync (or clear it) so every screen agrees on the category.
    if (dto.category !== undefined && dto.categoryId === undefined) {
      patch.categoryId = dto.category ? await this.categoryIdByName(clientId, userId, dto.category, dto.type ?? existing.type) : null;
    }

    if (dto.isTransfer === true) {
      // A transfer between the user's own accounts is not income or expense: no category, out of the totals.
      Object.assign(patch, { isTransfer: true, ignored: true, category: null, categoryId: null });
    } else if (dto.isTransfer === false && existing.isTransfer) {
      // No longer a transfer: it counts again and is unlinked from the other side.
      Object.assign(patch, { isTransfer: false, transferGroupId: null, ignored: dto.ignored ?? false });
      if (existing.transferGroupId) {
        await this.db
          .update(transactions)
          .set({ transferGroupId: null })
          .where(and(eq(transactions.userId, userId), eq(transactions.transferGroupId, existing.transferGroupId), ne(transactions.id, id)));
      }
    }

    const rows = await this.db
      .update(transactions)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
      .returning();

    if (dto.isTransfer === true) await this.linkOpenTransfers(clientId, userId);
    return (await this.findOne(id, clientId, userId)) ?? rows[0];
  }

  private async categoryIdByName(clientId: string, userId: string, name: string, type: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: categories.id, name: categories.name, type: categories.type })
      .from(categories)
      .where(and(eq(categories.clientId, clientId), eq(categories.userId, userId), isNull(categories.deletedAt)));
    const wanted = name.trim().toLowerCase();
    const named = rows.filter((c) => c.name.trim().toLowerCase() === wanted);
    return (named.find((c) => c.type === type) ?? named.find((c) => !c.type))?.id ?? null;
  }

  /** Pairs the two sides of transfers that are not linked yet (same amount, different accounts, a few days apart). */
  private async linkOpenTransfers(clientId: string, userId: string): Promise<void> {
    const rows = await this.db
      .select({ id: transactions.id, type: transactions.type, accountId: transactions.accountId, amount: transactions.amount, date: transactions.date })
      .from(transactions)
      .where(
        and(
          eq(transactions.clientId, clientId),
          eq(transactions.userId, userId),
          eq(transactions.isTransfer, true),
          isNull(transactions.transferGroupId),
          isNull(transactions.deletedAt),
        ),
      );
    const pairs = pairTransfers(rows.map((r) => ({ id: r.id, type: r.type, accountId: r.accountId, amount: String(r.amount), date: String(r.date) })));
    for (const [a, b] of pairs) {
      await this.db.update(transactions).set({ transferGroupId: randomUUID() }).where(inArray(transactions.id, [a, b]));
    }
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .update(transactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId), isNull(transactions.deletedAt)));
  }
}
