import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createHash } from 'crypto';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { accounts, categories, categorizationRules, chatFiles, imports, transactions } from '../db/schema';
import type { LlmToolDefinition } from '../llm/llm.types';
import { extractPattern, merchantKey } from './pattern';

export interface ToolContext {
  clientId: string;
  userId: string;
}

export interface SavedSummary {
  importId: string;
  source: string | null;
  accountName: string;
  saved: number;
  duplicatesSkipped: number;
  income: number;
  expense: number;
}

export interface ToolOutcome {
  /** JSON-serialisable result returned to the model. */
  result: unknown;
  saved?: SavedSummary;
}

// Model-produced JSON: untrusted and untyped by nature. Every field is validated before use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolArgs = Record<string, any>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 200;

const ISO_DATE = { type: 'string', description: 'Date as YYYY-MM-DD' };

export const CHAT_TOOLS: LlmToolDefinition[] = [
  {
    name: 'save_transactions',
    description:
      'Save extracted transactions to ONE account. Only call when you are confident which account the document belongs to; otherwise ask the user first. Send at most 100 rows per call (call repeatedly for longer statements). Duplicates already in the database are skipped automatically.',
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'UUID of an existing account from the context.' },
        sourceFile: { type: 'string', description: 'Exact filename of the attachment these rows came from, if any.' },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: ISO_DATE,
              amount: { type: 'number', description: 'Always positive. Direction is given by type.' },
              type: { type: 'string', enum: ['income', 'expense'] },
              description: { type: 'string', description: 'Merchant/description as printed, cleaned of noise.' },
              categoryId: { type: ['string', 'null'], description: 'UUID of an existing category, or null if unsure.' },
            },
            required: ['date', 'amount', 'type', 'description'],
          },
        },
      },
      required: ['accountId', 'transactions'],
    },
  },
  {
    name: 'create_account',
    description: 'Create a new account/card when the user confirms a document belongs to one that does not exist yet.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'e.g. "Nubank Cartão" or "Itaú Conta"' },
        type: { type: 'string', enum: ['checking', 'savings', 'credit', 'wallet'] },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'create_category',
    description: 'Create a category when none of the existing ones fit a recurring kind of transaction.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' }, type: { type: 'string', enum: ['income', 'expense'] } },
      required: ['name', 'type'],
    },
  },
  {
    name: 'set_category_rule',
    description:
      "Remember that a merchant/description always belongs to a category (the user's long-term categorization memory). Use when the user corrects or states a category. Optionally re-categorize matching past transactions.",
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Merchant or description text, e.g. "UBER *TRIP".' },
        categoryId: { type: 'string' },
        applyToExisting: { type: 'boolean', description: 'Also update already-saved transactions that match.' },
      },
      required: ['description', 'categoryId'],
    },
  },
  {
    name: 'query_transactions',
    description: 'List individual transactions, newest first. Use for questions about specific purchases.',
    parameters: {
      type: 'object',
      properties: {
        from: ISO_DATE,
        to: ISO_DATE,
        type: { type: 'string', enum: ['income', 'expense'] },
        categoryId: { type: 'string' },
        accountId: { type: 'string' },
        search: { type: 'string', description: 'Case-insensitive text in the description.' },
        limit: { type: 'number', description: 'Max rows, default 30, max 100.' },
      },
    },
  },
  {
    name: 'summarize_transactions',
    description:
      'Aggregate totals grouped by category, month, account or day. Use for "how much did I spend…" questions and trends. Ignored transactions are excluded.',
    parameters: {
      type: 'object',
      properties: {
        from: ISO_DATE,
        to: ISO_DATE,
        type: { type: 'string', enum: ['income', 'expense'], description: 'Default expense.' },
        groupBy: { type: 'string', enum: ['category', 'month', 'account', 'day'] },
      },
      required: ['from', 'to', 'groupBy'],
    },
  },
];

@Injectable()
export class ChatToolsService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolOutcome> {
    let args: ToolArgs;
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      return { result: { error: 'Arguments were not valid JSON (likely cut off). Retry with fewer rows per call.' } };
    }

    try {
      switch (name) {
        case 'save_transactions':
          return await this.saveTransactions(args, ctx);
        case 'create_account':
          return { result: await this.createAccount(args, ctx) };
        case 'create_category':
          return { result: await this.createCategory(args, ctx) };
        case 'set_category_rule':
          return { result: await this.setCategoryRule(args, ctx) };
        case 'query_transactions':
          return { result: await this.queryTransactions(args, ctx) };
        case 'summarize_transactions':
          return { result: await this.summarize(args, ctx) };
        default:
          return { result: { error: `Unknown tool ${name}` } };
      }
    } catch (e) {
      return { result: { error: e instanceof Error ? e.message : 'Tool failed' } };
    }
  }

  private async saveTransactions(args: ToolArgs, ctx: ToolContext): Promise<ToolOutcome> {
    const rows: ToolArgs[] = Array.isArray(args.transactions) ? args.transactions : [];
    if (rows.length === 0) return { result: { error: 'No transactions provided.' } };
    if (rows.length > MAX_ROWS) return { result: { error: `Too many rows; send at most ${MAX_ROWS} per call.` } };

    const [account] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, String(args.accountId)), eq(accounts.clientId, ctx.clientId), eq(accounts.userId, ctx.userId)));
    if (!account) return { result: { error: 'accountId does not match any of the user\'s accounts.' } };

    const cats = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.clientId, ctx.clientId), eq(categories.userId, ctx.userId)));
    const catById = new Map(cats.map((c) => [c.id, c]));

    const seen = new Map<string, number>();
    const prepared: (typeof transactions.$inferInsert)[] = [];
    const rejected: string[] = [];

    rows.forEach((r, i) => {
      const amount = Number(r.amount);
      const description = String(r.description ?? '').trim();
      if (!DATE_RE.test(String(r.date)) || !Number.isFinite(amount) || amount <= 0 || !description || !['income', 'expense'].includes(r.type)) {
        rejected.push(`row ${i + 1}`);
        return;
      }
      const base = createHash('sha1')
        .update(`${ctx.userId}|${account.id}|${r.date}|${amount.toFixed(2)}|${extractPattern(description) || description.toLowerCase()}`)
        .digest('hex');
      // Two identical purchases on the same day are legitimate: disambiguate by occurrence.
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const cat = r.categoryId ? catById.get(String(r.categoryId)) : undefined;
      prepared.push({
        clientId: ctx.clientId,
        userId: ctx.userId,
        amount: amount.toFixed(2),
        type: r.type,
        date: r.date,
        description,
        accountId: account.id,
        categoryId: cat?.id ?? null,
        category: cat?.name ?? null,
        source: 'ai-chat',
        dedupHash: `${base}#${n}`,
      });
    });

    if (prepared.length === 0) return { result: { error: 'All rows were invalid.', rejected } };

    const existing = await this.db
      .select({ h: transactions.dedupHash })
      .from(transactions)
      .where(and(eq(transactions.userId, ctx.userId), inArray(transactions.dedupHash, prepared.map((p) => p.dedupHash!))));
    const existingHashes = new Set(existing.map((e) => e.h));
    const fresh = prepared.filter((p) => !existingHashes.has(p.dedupHash!));

    let importId = '';
    if (fresh.length > 0) {
      const [imp] = await this.db
        .insert(imports)
        .values({ clientId: ctx.clientId, userId: ctx.userId, bank: args.sourceFile ?? 'chat', status: 'complete', rowCount: fresh.length })
        .returning();
      importId = imp.id;
      await this.db.insert(transactions).values(fresh.map((f) => ({ ...f, importId })));
      await this.bumpMatchedRules(fresh, ctx);
    }

    if (args.sourceFile) {
      await this.db
        .delete(chatFiles)
        .where(and(eq(chatFiles.userId, ctx.userId), eq(chatFiles.name, String(args.sourceFile))));
    }

    const sum = (t: 'income' | 'expense') =>
      fresh.filter((f) => f.type === t).reduce((acc, f) => acc + Number(f.amount), 0);
    const saved: SavedSummary | undefined = fresh.length
      ? {
          importId,
          source: args.sourceFile ?? null,
          accountName: account.name,
          saved: fresh.length,
          duplicatesSkipped: prepared.length - fresh.length,
          income: Number(sum('income').toFixed(2)),
          expense: Number(sum('expense').toFixed(2)),
        }
      : undefined;

    return {
      result: { saved: fresh.length, duplicatesSkipped: prepared.length - fresh.length, rejected, account: account.name },
      saved,
    };
  }

  /** A saved row that matches an existing rule's category counts as a use of that rule. */
  private async bumpMatchedRules(rows: (typeof transactions.$inferInsert)[], ctx: ToolContext) {
    const patterns = new Map<string, string | null>();
    rows.forEach((r) => {
      const key = merchantKey(r.description ?? '');
      if (key) patterns.set(key, r.categoryId ?? null);
    });
    if (patterns.size === 0) return;
    const rules = await this.db
      .select()
      .from(categorizationRules)
      .where(and(eq(categorizationRules.userId, ctx.userId), inArray(categorizationRules.keyword, [...patterns.keys()])));
    const hit = rules.filter((r) => r.categoryId && patterns.get(r.keyword) === r.categoryId).map((r) => r.id);
    if (hit.length) {
      await this.db
        .update(categorizationRules)
        .set({ usedCount: sql`${categorizationRules.usedCount} + 1`, updatedAt: new Date() })
        .where(inArray(categorizationRules.id, hit));
    }
  }

  private async createAccount(args: ToolArgs, ctx: ToolContext) {
    const name = String(args.name ?? '').trim();
    if (!name) return { error: 'name is required' };
    const type = ['checking', 'savings', 'credit', 'wallet'].includes(args.type) ? args.type : 'checking';
    const [acc] = await this.db
      .insert(accounts)
      .values({ clientId: ctx.clientId, userId: ctx.userId, name, type, hasCredit: type === 'credit' })
      .returning();
    return { accountId: acc.id, name: acc.name, type: acc.type };
  }

  private async createCategory(args: ToolArgs, ctx: ToolContext) {
    const name = String(args.name ?? '').trim();
    if (!name) return { error: 'name is required' };
    const type = args.type === 'income' ? 'income' : 'expense';
    const [cat] = await this.db
      .insert(categories)
      .values({ clientId: ctx.clientId, userId: ctx.userId, name, type })
      .returning();
    return { categoryId: cat.id, name: cat.name, type: cat.type };
  }

  private async setCategoryRule(args: ToolArgs, ctx: ToolContext) {
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, String(args.categoryId)), eq(categories.clientId, ctx.clientId), eq(categories.userId, ctx.userId)));
    if (!cat) return { error: 'categoryId does not match any of the user\'s categories.' };

    const keyword = merchantKey(String(args.description ?? ''));
    if (keyword.length < 3) return { error: 'Description is too short to remember as a pattern.' };

    const [existing] = await this.db
      .select()
      .from(categorizationRules)
      .where(and(eq(categorizationRules.userId, ctx.userId), eq(categorizationRules.keyword, keyword)));
    if (existing) {
      await this.db
        .update(categorizationRules)
        .set({
          categoryId: cat.id,
          category: cat.name,
          type: cat.type,
          isActive: true,
          usedCount: sql`${categorizationRules.usedCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(categorizationRules.id, existing.id));
    } else {
      await this.db.insert(categorizationRules).values({
        clientId: ctx.clientId,
        userId: ctx.userId,
        keyword,
        categoryId: cat.id,
        category: cat.name,
        type: cat.type,
        originalDescription: String(args.description),
      });
    }

    let updated = 0;
    if (args.applyToExisting) {
      const like = `%${keyword.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      const res = await this.db
        .update(transactions)
        .set({ categoryId: cat.id, category: cat.name, updatedAt: new Date() })
        .where(and(eq(transactions.userId, ctx.userId), eq(transactions.clientId, ctx.clientId), ilike(transactions.description, like)))
        .returning({ id: transactions.id });
      updated = res.length;
    }
    return { remembered: keyword, category: cat.name, updatedTransactions: updated };
  }

  private filters(args: ToolArgs, ctx: ToolContext) {
    const c = [eq(transactions.clientId, ctx.clientId), eq(transactions.userId, ctx.userId), eq(transactions.ignored, false)];
    if (DATE_RE.test(args.from ?? '')) c.push(gte(transactions.date, args.from));
    if (DATE_RE.test(args.to ?? '')) c.push(lte(transactions.date, args.to));
    if (args.type === 'income' || args.type === 'expense') c.push(eq(transactions.type, args.type));
    if (args.categoryId) c.push(eq(transactions.categoryId, String(args.categoryId)));
    if (args.accountId) c.push(eq(transactions.accountId, String(args.accountId)));
    return c;
  }

  private async queryTransactions(args: ToolArgs, ctx: ToolContext) {
    const conds = this.filters(args, ctx);
    if (args.search) {
      const like = `%${String(args.search).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      conds.push(ilike(transactions.description, like));
    }
    const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
    const rows = await this.db
      .select({
        date: transactions.date,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        category: sql<string>`coalesce(${categories.name}, ${transactions.category}, 'Sem categoria')`,
        account: accounts.name,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(and(...conds))
      .orderBy(desc(transactions.date))
      .limit(limit);
    return { count: rows.length, rows };
  }

  async summarize(args: ToolArgs, ctx: ToolContext) {
    const conds = this.filters({ ...args, type: args.type ?? 'expense' }, ctx);
    const group =
      args.groupBy === 'month'
        ? sql<string>`to_char(${transactions.date}, 'YYYY-MM')`
        : args.groupBy === 'day'
          ? sql<string>`to_char(${transactions.date}, 'YYYY-MM-DD')`
          : args.groupBy === 'account'
            ? sql<string>`coalesce(${accounts.name}, 'Sem conta')`
            : sql<string>`coalesce(${categories.name}, ${transactions.category}, 'Sem categoria')`;
    const rows = await this.db
      .select({
        group,
        total: sql<string>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(and(...conds))
      .groupBy(group)
      .orderBy(sql`sum(${transactions.amount}) desc`)
      .limit(60);
    const grand = rows.reduce((acc, r) => acc + Number(r.total), 0);
    return { type: args.type ?? 'expense', total: Number(grand.toFixed(2)), groups: rows.map((r) => ({ group: r.group, total: Number(r.total), count: Number(r.count) })) };
  }
}
