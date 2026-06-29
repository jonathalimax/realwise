import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { billActionTokens, bills } from '../db/schema';
import { BillsService } from '../bills/bills.service';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

type BillRow = typeof bills.$inferSelect;
type BillActionTokenRow = typeof billActionTokens.$inferSelect;

export type BillActionSession = {
  token: string;
  expiresAt: Date;
  bill: BillRow;
  isUsed: boolean;
};

export type CreateBillActionTokenResult = {
  token: string;
  expiresAt: Date;
};

export type ConfirmBillActionPayload = {
  paidAmount?: string;
  paidAt?: string;
};

@Injectable()
export class BillActionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly billsService: BillsService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizePaidAt(value?: string): string {
    return value || new Date().toISOString();
  }

  private async findTokenRow(token: string): Promise<BillActionTokenRow | null> {
    const tokenHash = this.hashToken(token);
    const rows = await this.db
      .select()
      .from(billActionTokens)
      .where(eq(billActionTokens.tokenHash, tokenHash));
    return rows[0] ?? null;
  }

  private async assertValidToken(token: string): Promise<BillActionTokenRow> {
    const row = await this.findTokenRow(token);
    if (!row) {
      throw new NotFoundException('Invalid bill action token');
    }
    if (row.usedAt) {
      throw new BadRequestException('Bill action token has already been used');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Bill action token has expired');
    }
    return row;
  }

  async createTokenForBill(
    bill: Pick<BillRow, 'id' | 'clientId' | 'userId'>,
    options: { tokenTtlHours?: number } = {},
  ): Promise<CreateBillActionTokenResult> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + (options.tokenTtlHours ?? 48) * 60 * 60 * 1000);
    await this.db.insert(billActionTokens).values({
      clientId: bill.clientId,
      userId: bill.userId,
      billId: bill.id,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { token, expiresAt };
  }

  async getSession(token: string): Promise<BillActionSession> {
    const tokenRow = await this.assertValidToken(token);
    const bill = await this.billsService.findOne(tokenRow.billId, tokenRow.clientId, tokenRow.userId);
    return {
      token,
      expiresAt: tokenRow.expiresAt,
      bill,
      isUsed: Boolean(tokenRow.usedAt),
    };
  }

  async confirmPayment(token: string, payload: ConfirmBillActionPayload = {}): Promise<BillRow> {
    const tokenRow = await this.assertValidToken(token);
    const bill = await this.billsService.findOne(tokenRow.billId, tokenRow.clientId, tokenRow.userId);
    const paidAmount = payload.paidAmount ?? bill.amount;
    const paidAt = this.normalizePaidAt(payload.paidAt);

    const paidBill = await this.billsService.markPaid(
      bill.id,
      {
        paidAt,
        paidAmount,
        targetDueDate: bill.dueDate,
      },
      tokenRow.clientId,
      tokenRow.userId,
    );

    const updated = await this.db
      .update(billActionTokens)
      .set({ usedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(billActionTokens.id, tokenRow.id), isNull(billActionTokens.usedAt)))
      .returning();

    if (updated.length === 0) {
      throw new BadRequestException('Bill action token has already been used');
    }

    return paidBill;
  }
}
