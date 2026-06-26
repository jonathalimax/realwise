import { Inject, Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { imports, transactions } from '../db/schema';
import { BankParserService, ParsedTransaction } from './bank-parser.service';

type Import = typeof imports.$inferSelect;

interface ConfirmTransaction extends ParsedTransaction {
  categoryId?: string;
  accountId?: string;
}

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly parser: BankParserService,
  ) {}

  async processUpload(
    buffer: Buffer,
    fileName: string,
    clientId: string,
    userId: string,
  ): Promise<{ importId: string; bank: string; transactions: ParsedTransaction[] }> {
    const { bank, transactions: parsed } = this.parser.parse(buffer, fileName);

    const rows = await this.db
      .insert(imports)
      .values({ clientId, userId, bank, status: 'review', rowCount: parsed.length })
      .returning();
    const imp: Import = rows[0];

    return { importId: imp.id, bank, transactions: parsed };
  }

  async confirm(
    importId: string,
    txs: ConfirmTransaction[],
    clientId: string,
    userId: string,
  ): Promise<void> {
    if (txs.length > 0) {
      await this.db.insert(transactions).values(
        txs.map((t) => ({
          clientId,
          userId,
          amount: t.amount,
          type: t.type,
          date: t.date,
          description: t.description,
          categoryId: t.categoryId ?? null,
          accountId: t.accountId ?? null,
        })),
      );
    }

    await this.db
      .update(imports)
      .set({ status: 'complete', updatedAt: new Date() })
      .where(and(eq(imports.id, importId), eq(imports.clientId, clientId), eq(imports.userId, userId)));
  }
}
