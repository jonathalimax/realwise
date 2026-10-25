import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { randomUUID } from 'crypto';
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

  private normalizeAmount(value?: string | null): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return String(value);
  }

  private normalizeBillSeriesId(dto: { recurrence?: string | null; seriesId?: string | null }, allowGenerate = false) {
    if (dto.seriesId !== undefined) return dto.seriesId ?? null;
    if (allowGenerate && dto.recurrence && dto.recurrence !== 'none') {
      return randomUUID();
    }
    return undefined;
  }

  private normalizePaidDate(dto: { paidAt?: string | null; paidDate?: string | null }) {
    return this.normalizeTimestamp(dto.paidAt ?? dto.paidDate);
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
      paidAt: this.normalizeTimestamp(dto.paidAt),
      paidAmount: this.normalizeAmount(dto.paidAmount),
      seriesId: this.normalizeBillSeriesId(dto, true),
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
      paidAt: this.normalizeTimestamp(dto.paidAt),
      paidAmount: this.normalizeAmount(dto.paidAmount),
      seriesId: this.normalizeBillSeriesId(dto, false),
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
      .where(and(eq(bills.clientId, clientId), eq(bills.userId, userId), isNull(bills.deletedAt)));
  }

  private getSeriesKey(bill: Bill): string {
    if (bill.seriesId) return `series:${bill.seriesId}`;
    if (!bill.recurrence) return `bill:${bill.id}`;
    return `legacy:${[
      bill.clientId,
      bill.userId,
      bill.name,
      bill.amount,
      bill.categoryId ?? '',
      bill.category ?? '',
      bill.description ?? '',
      bill.recurrence ?? '',
      bill.linkedBankId ?? '',
      this.normalizeDateOnly(bill.recurrenceEndDate ? new Date(bill.recurrenceEndDate).toISOString() : undefined) ?? '',
    ].join('|')}`;
  }

  private getSeriesAliases(bill: Bill): string[] {
    const aliases = [this.getSeriesKey(bill)];
    if (bill.recurrence) {
      aliases.push(`legacy:${[
        bill.clientId,
        bill.userId,
        bill.name,
        bill.amount,
        bill.categoryId ?? '',
        bill.category ?? '',
        bill.description ?? '',
        bill.recurrence ?? '',
        bill.linkedBankId ?? '',
        this.normalizeDateOnly(bill.recurrenceEndDate ? new Date(bill.recurrenceEndDate).toISOString() : undefined) ?? '',
      ].join('|')}`);
    }
    return [...new Set(aliases)];
  }

  private getOccurrenceKey(bill: Bill): string {
    return `${this.getSeriesKey(bill)}::${this.normalizeDateOnly(bill.dueDate)}`;
  }

  private sameRecurringSeries(left: Bill, right: Bill): boolean {
    if (!left.recurrence || !right.recurrence) return false;
    const leftKeys = new Set(this.getSeriesAliases(left));
    return this.getSeriesAliases(right).some((key) => leftKeys.has(key));
  }

  private async maybeCreateNextOccurrence(paidBill: Bill, clientId: string, userId: string): Promise<void> {
    if (!paidBill.recurrence) return;

    const sourceDueDate = this.normalizeDateOnly(paidBill.dueDate);
    const nextDueDate = sourceDueDate ? this.calculateNextDueDate(sourceDueDate, paidBill.recurrence) : null;
    if (!sourceDueDate || !nextDueDate) return;

    const sourceEndDate = paidBill.recurrenceEndDate ? new Date(paidBill.recurrenceEndDate) : null;
    if (sourceEndDate && new Date(`${nextDueDate}T00:00:00`) > sourceEndDate) {
      return;
    }

    const allBills = await this.findAll(clientId, userId);
    const nextExists = allBills.some((bill) => this.sameRecurringSeries(bill, paidBill) && this.normalizeDateOnly(bill.dueDate) === nextDueDate);
    if (nextExists) return;

    const baseBill = { ...paidBill };
    delete (baseBill as { id?: string }).id;
    await this.db.insert(bills).values({
      ...baseBill,
      firebaseDocId: null,
      dueDate: nextDueDate,
      status: 'pending',
      paidDate: null,
      paidAt: null,
      paidAmount: null,
      postponeCount: 0,
      nextReminderAt: null,
      seriesId: paidBill.seriesId ?? paidBill.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Bill> {
    const rows = await this.db
      .select()
      .from(bills)
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId), isNull(bills.deletedAt)));
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
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId), isNull(bills.deletedAt)))
      .returning();
    return rows[0];
  }

  async markPaid(id: string, dto: MarkBillPaidDto, clientId: string, userId: string): Promise<Bill> {
    const sourceBill = await this.findOne(id, clientId, userId);
    const paidDate = this.normalizePaidDate(dto) ?? new Date();
    const targetDueDate = this.normalizeDateOnly(dto?.targetDueDate ?? dto?.virtualDueDate ?? sourceBill.dueDate);
    const paidAmount = this.normalizeAmount(dto?.paidAmount) ?? sourceBill.amount;
    const allBills = await this.findAll(clientId, userId);
    const matchingOccurrence = allBills.find((bill) => this.sameRecurringSeries(bill, sourceBill) && this.normalizeDateOnly(bill.dueDate) === targetDueDate);
    const paidBill = matchingOccurrence ?? sourceBill;

    if (matchingOccurrence || this.normalizeDateOnly(sourceBill.dueDate) === targetDueDate) {
      const rows = await this.db
        .update(bills)
        .set({ status: 'paid', paidDate, paidAt: paidDate, paidAmount, updatedAt: new Date() })
        .where(and(eq(bills.id, paidBill.id), eq(bills.clientId, clientId), eq(bills.userId, userId), isNull(bills.deletedAt)))
        .returning();
      const updatedBill = rows[0];
      await this.maybeCreateNextOccurrence(updatedBill, clientId, userId);
      return updatedBill;
    }

    const baseBill = { ...sourceBill };
    delete (baseBill as { id?: string }).id;
    const rows = await this.db
      .insert(bills)
      .values({
        ...baseBill,
        firebaseDocId: null,
        dueDate: targetDueDate,
        status: 'paid',
        paidDate,
        paidAt: paidDate,
        paidAmount,
        seriesId: sourceBill.seriesId ?? sourceBill.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    const insertedBill = rows[0];
    await this.maybeCreateNextOccurrence(insertedBill, clientId, userId);
    return insertedBill;
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    // Soft delete only: reminders/action tokens stay (they resolve to "not found" once the bill is hidden).
    await this.db
      .update(bills)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId), isNull(bills.deletedAt)));
  }
}
