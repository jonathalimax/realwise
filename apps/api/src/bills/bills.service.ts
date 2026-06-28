import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { bills } from '../db/schema';
import { CreateBillDto, UpdateBillDto, MarkBillPaidDto } from './dto/create-bill.dto';

type Bill = typeof bills.$inferSelect;

@Injectable()
export class BillsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private normalizeDateOnly(value?: string | null): string | undefined {
    if (!value) return undefined;
    return value.slice(0, 10);
  }

  private normalizeTimestamp(value?: string | null): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return new Date(value);
  }

  private mapCreateBillDto(dto: CreateBillDto) {
    return {
      name: dto.name,
      amount: String(dto.amount),
      dueDate: this.normalizeDateOnly(dto.dueDate),
      status: dto.status,
      recurrence: dto.recurrence,
      categoryId: dto.categoryId,
      description: dto.description,
      category: dto.category,
      recurrenceEndDate: this.normalizeTimestamp(dto.recurrenceEndDate),
      notificationEnabled: dto.notificationEnabled,
      notificationDaysBefore: dto.notificationDaysBefore,
      linkedBankId: dto.linkedBankId,
      paidDate: this.normalizeTimestamp(dto.paidDate),
      postponeCount: dto.postponeCount,
      nextReminderAt: this.normalizeTimestamp(dto.nextReminderAt),
    };
  }

  private mapUpdateBillDto(dto: UpdateBillDto) {
    return {
      ...dto,
      amount: dto.amount !== undefined ? String(dto.amount) : undefined,
      dueDate: dto.dueDate ? this.normalizeDateOnly(dto.dueDate) : undefined,
      recurrenceEndDate: this.normalizeTimestamp(dto.recurrenceEndDate),
      paidDate: this.normalizeTimestamp(dto.paidDate),
      nextReminderAt: this.normalizeTimestamp(dto.nextReminderAt),
    };
  }

  private calculateNextDueDate(currentDueDate: string, recurrenceType?: string | null): string | null {
    if (!recurrenceType) return null;
    const date = new Date(`${currentDueDate}T12:00:00`);

    switch (recurrenceType) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }

    return date.toISOString().slice(0, 10);
  }

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
      .values({ ...this.mapCreateBillDto(dto), clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateBillDto, clientId: string, userId: string): Promise<Bill> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(bills)
      .set({ ...this.mapUpdateBillDto(dto), updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)))
      .returning();
    return rows[0];
  }

  async markPaid(id: string, dto: MarkBillPaidDto, clientId: string, userId: string): Promise<Bill> {
    const sourceBill = await this.findOne(id, clientId, userId);
    const paidDate = this.normalizeTimestamp(dto?.paidDate) ?? new Date();
    const virtualDueDate = this.normalizeDateOnly(dto?.virtualDueDate);

    if (sourceBill.status === 'paid' && virtualDueDate) {
      const baseBill = { ...sourceBill };
      delete (baseBill as { id?: string }).id;
      const rows = await this.db
        .insert(bills)
        .values({
          ...baseBill,
          firebaseDocId: null,
          dueDate: virtualDueDate,
          status: 'paid',
          paidDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return rows[0];
    }

    const rows = await this.db
      .update(bills)
      .set({ status: 'paid', paidDate, updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)))
      .returning();
    const updatedBill = rows[0];

    if (sourceBill.recurrence) {
      const sourceDueDate = this.normalizeDateOnly(sourceBill.dueDate);
      const sourceEndDate = sourceBill.recurrenceEndDate ? new Date(sourceBill.recurrenceEndDate) : null;
      const shouldCreateNext = !sourceEndDate || (sourceDueDate ? sourceEndDate > new Date(`${sourceDueDate}T00:00:00`) : false);
      const nextDueDate = sourceDueDate ? this.calculateNextDueDate(sourceDueDate, sourceBill.recurrence) : null;

      if (shouldCreateNext && nextDueDate) {
        const existingRows = await this.db
          .select()
          .from(bills)
          .where(and(
            eq(bills.clientId, clientId),
            eq(bills.userId, userId),
            eq(bills.name, sourceBill.name),
            eq(bills.dueDate, nextDueDate),
            eq(bills.status, 'pending'),
          ));

        if (existingRows.length === 0) {
          const baseBill = { ...sourceBill };
          delete (baseBill as { id?: string }).id;
          await this.db.insert(bills).values({
            ...baseBill,
            firebaseDocId: null,
            dueDate: nextDueDate,
            status: 'pending',
            paidDate: null,
            postponeCount: 0,
            nextReminderAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    return updatedBill;
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(bills)
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)));
  }
}
