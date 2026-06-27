import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { imports, transactions, categories, accounts } from '../db/schema';
import { BankParserService, ParsedTransaction } from './bank-parser.service';

type Import = typeof imports.$inferSelect;

interface ConfirmTransaction extends ParsedTransaction {
  categoryId?: string;
  accountId?: string;
}

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
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
    const existingImport = await this.db
      .select()
      .from(imports)
      .where(and(eq(imports.id, importId), eq(imports.clientId, clientId), eq(imports.userId, userId)));
    if (existingImport.length === 0) throw new NotFoundException('Import not found');

    const catIds = [...new Set(txs.map((t) => t.categoryId).filter(Boolean))] as string[];
    if (catIds.length > 0) {
      const owned = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(and(inArray(categories.id, catIds), eq(categories.clientId, clientId), eq(categories.userId, userId)));
      if (owned.length !== catIds.length) throw new ForbiddenException('Invalid categoryId');
    }

    const accIds = [...new Set(txs.map((t) => t.accountId).filter(Boolean))] as string[];
    if (accIds.length > 0) {
      const owned = await this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(inArray(accounts.id, accIds), eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
      if (owned.length !== accIds.length) throw new ForbiddenException('Invalid accountId');
    }

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
