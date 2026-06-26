import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { bills } from '../db/schema';
import { CreateBillDto, UpdateBillDto } from './dto/create-bill.dto';

type Bill = typeof bills.$inferSelect;

@Injectable()
export class BillsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  findAll(clientId: string, userId: string): Promise<Bill[]> {
    return this.db
      .select()
      .from(bills)
      .where(and(eq(bills.clientId, clientId), eq(bills.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Bill> {
    const rows = await this.db
      .select()
      .from(bills)
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateBillDto, clientId: string, userId: string): Promise<Bill> {
    const rows = await this.db
      .insert(bills)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateBillDto, clientId: string, userId: string): Promise<Bill> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(bills)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)))
      .returning();
    return rows[0];
  }

  async markPaid(id: string, clientId: string, userId: string): Promise<Bill> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(bills)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(bills)
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)));
  }
}
