import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createHash, randomUUID } from 'crypto';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { accounts, bills, categories, categorizationRules, chatFiles, imports, planner, transactions } from '../db/schema';
import type { LlmToolDefinition } from '../llm/llm.types';
import { extractPattern, merchantKey } from './pattern';
import { looksLikeInvoicePayment, matchesHolder, pairTransfers } from './transfer';
import { BANKS } from './onboarding';
import { MAX_REVIEW_ITEMS, PAYMENT_METHODS, type ChatQuestion, type ReviewGroup } from './chat.types';
import { ChatEditService, EDIT_TOOLS } from './chat-edit.service';
import { ChatBillsService } from './chat-bills.service';

export interface ToolContext {
  clientId: string;
  userId: string;
}

export interface SavedSummary {
  importId: string;
  source: string | null;
  accountName: string;
  saved: number;
  /** Rows saved as transfers between the user's own accounts (left out of income/expense). */
  transfers: number;
  duplicatesSkipped: number;
  income: number;
  expense: number;
  /** Biggest expense categories in this save (transfers excluded), for the summary card. */
  topCategories?: { name: string; total: number }[];
}

export interface ToolOutcome {
  /** JSON-serialisable result returned to the model. */
  result: unknown;
  saved?: SavedSummary;
  /** Rows saved with a doubtful category; shown to the user as a confirmation sheet. */
  review?: ReviewGroup[];
  /** Multiple-choice questions to show the user; the turn ends so they can answer. */
  questions?: ChatQuestion[];
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
      'Save extracted transactions to ONE account. Only call when you are confident which account the document belongs to; otherwise use ask_user first. Send at most 100 rows per call (call repeatedly for longer statements). ALL rows are saved immediately, including ones whose category you are unsure about (mark those confidence "low" so the user is asked to confirm them afterwards). Duplicates already in the database are skipped automatically.',
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'UUID of an existing account from the context.' },
        sourceFile: { type: 'string', description: 'Exact filename of the attachment these rows came from, if any.' },
        paymentMethod: { type: ['string', 'null'], enum: [...PAYMENT_METHODS, null], description: 'How these were paid, for every row unless a row overrides it. null if unknown.' },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: ISO_DATE,
              amount: { type: 'number', description: 'Always positive. Direction is given by type.' },
              type: { type: 'string', enum: ['income', 'expense'] },
              description: { type: 'string', description: 'Merchant/description as printed, cleaned of noise.' },
              categoryId: { type: ['string', 'null'], description: 'Your best-guess existing category UUID, or null if you have no idea.' },
              confidence: { type: 'string', enum: ['high', 'low'], description: '"low" when the category is a guess the user should confirm.' },
              suggestedCategoryIds: { type: 'array', items: { type: 'string' }, description: 'Up to 3 plausible category UUIDs, best first (for low confidence).' },
              paymentMethod: { type: ['string', 'null'], enum: [...PAYMENT_METHODS, null] },
              possibleTransfer: { type: 'boolean', description: 'true when the line is, or may be, money moving between the user\'s own/household accounts (Pix/TED/transfer to or from a person, an invoice payment of their own card). The app confirms it with the user; never guess for ordinary purchases.' },
            },
            required: ['date', 'amount', 'type', 'description'],
          },
        },
      },
      required: ['accountId', 'transactions'],
    },
  },
  {
    name: 'ask_user',
    description:
      'Show the user a sheet of multiple-choice questions and END your turn to wait for the answers. Use it when you cannot determine, with confidence, which ACCOUNT a document belongs to or how it was paid (payment method). Ask about all documents in one call (one question per document). Do not use it for categories: save the rows and mark them confidence "low" instead. Write one short friendly sentence in the same message.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['account', 'payment_method', 'choice', 'account_form'], description: 'account, payment_method and account_form options are filled in by the app; for choice you provide options. account_form opens the form to register a bank account or card (bank, name, type, holder, closing/due day).' },
              title: { type: 'string', description: 'Short question, e.g. "Qual conta é essa fatura?"' },
              subtitle: { type: 'string', description: 'What you saw that makes you unsure, e.g. "Final 4821, vence dia 10".' },
              fileName: { type: 'string', description: 'Exact filename this question is about, if any.' },
              options: { type: 'array', items: { type: 'string' }, description: 'Only for kind "choice".' },
            },
            required: ['kind', 'title'],
          },
        },
      },
      required: ['questions'],
    },
  },
  {
    name: 'set_monthly_income',
    description:
      "Set up the user's planner with their monthly NET salary (after deductions) during onboarding. Only works when the planner has no income yet; if it is already configured, tell the user to adjust it in the Planejamento screen.",
    parameters: {
      type: 'object',
      properties: { netSalary: { type: 'number', description: 'Monthly net income in BRL, positive.' } },
      required: ['netSalary'],
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
        holderName: { type: 'string', description: 'Full name of the person the account belongs to, if the document shows it (used to recognise transfers between own accounts).' },
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
    name: 'create_bill',
    description:
      'Create a bill/account payable (e.g. rent, internet, a boleto) with a due date. Use when the user mentions something they must pay later or that repeats, or when a document is a bill/boleto rather than a statement.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name, e.g. "Aluguel" or "Internet Vivo".' },
        amount: { type: 'number', description: 'Positive amount in BRL.' },
        dueDate: { type: 'string', description: 'First/next due date, YYYY-MM-DD.' },
        recurrence: { type: ['string', 'null'], enum: ['monthly', 'weekly', 'yearly', null], description: 'null for a one-off bill.' },
        categoryId: { type: ['string', 'null'] },
        description: { type: 'string' },
      },
      required: ['name', 'amount', 'dueDate'],
    },
  },
  {
    name: 'list_pending_bills',
    description:
      'List the user\'s pending bills that are overdue, due today or due within a week, with their ids and expected amounts. Call this before marking bills as paid, or when the user asks which bills they have to pay.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mark_bills_paid',
    description:
      'Mark pending bills as paid when the user says they paid them (e.g. "paguei a internet de 120"). Use billIds from list_pending_bills. Include amount only when the user gave a value different from the expected one. Reply afterwards with a short celebration and ask if they want to add anything else.',
    parameters: {
      type: 'object',
      properties: {
        bills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              billId: { type: 'string' },
              amount: { type: 'number', description: 'Amount actually paid in BRL; omit to use the expected amount.' },
            },
            required: ['billId'],
          },
        },
      },
      required: ['bills'],
    },
  },
  {
    name: 'query_transactions',
    description: 'List individual transactions, newest first, with their ids (needed to update/delete/restore them). Use for questions about specific purchases.',
    parameters: {
      type: 'object',
      properties: {
        from: ISO_DATE,
        to: ISO_DATE,
        type: { type: 'string', enum: ['income', 'expense'] },
        categoryId: { type: 'string' },
        accountId: { type: 'string' },
        search: { type: 'string', description: 'Case-insensitive text in the description.' },
        deleted: { type: 'boolean', description: 'true to list soft-deleted transactions (to restore them).' },
        onlyTransfers: { type: 'boolean', description: 'true to list ONLY transfers between the user\'s own accounts (normally they are hidden because they are not income or expense).' },
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
  ...EDIT_TOOLS,
];

@Injectable()
export class ChatToolsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly edit: ChatEditService,
    private readonly billsChat: ChatBillsService,
  ) {}

  /** Runs a previously previewed update/delete that the user explicitly confirmed. The action comes from the stored message, never from the client. */
  async executeConfirmed(action: NonNullable<ChatQuestion['action']>, ctx: ToolContext): Promise<unknown> {
    const outcome =
      action.tool === 'delete_records'
        ? await this.edit.remove(action.args, ctx, true)
        : await this.edit.update(action.args, ctx, true);
    return outcome.result;
  }

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
        case 'ask_user':
          return await this.askUser(args, ctx);
        case 'find_records':
          return await this.edit.find(args, ctx);
        case 'update_records':
          return await this.edit.update(args, ctx);
        case 'delete_records':
          return await this.edit.remove(args, ctx);
        case 'restore_records':
          return await this.edit.restore(args, ctx);
        case 'set_monthly_income':
          return { result: await this.setMonthlyIncome(args, ctx) };
        case 'create_account':
          return { result: await this.createAccount(args, ctx) };
        case 'create_category':
          return { result: await this.createCategory(args, ctx) };
        case 'create_bill':
          return { result: await this.createBill(args, ctx) };
        case 'list_pending_bills':
          return { result: await this.billsChat.listForModel(ctx) };
        case 'mark_bills_paid':
          return { result: await this.billsChat.markPaidFromModel(ctx, Array.isArray(args.bills) ? args.bills : []) };
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
      .where(and(eq(accounts.id, String(args.accountId)), eq(accounts.clientId, ctx.clientId), eq(accounts.userId, ctx.userId), isNull(accounts.deletedAt)));
    if (!account) return { result: { error: 'accountId does not match any of the user\'s accounts.' } };

    const cats = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.clientId, ctx.clientId), eq(categories.userId, ctx.userId), isNull(categories.deletedAt)));
    const catById = new Map(cats.map((c) => [c.id, c]));

    // Who counts as "ours": every registered account holder (the user, their spouse...) plus counterparties the user
    // already confirmed as transfers.
    const holderNames = (
      await this.db
        .select({ holder: accounts.holderName })
        .from(accounts)
        .where(and(eq(accounts.clientId, ctx.clientId), eq(accounts.userId, ctx.userId), isNull(accounts.deletedAt)))
    )
      .map((a) => a.holder)
      .filter((h): h is string => Boolean(h));
    const transferKeys = new Set(
      (
        await this.db
          .select({ keyword: categorizationRules.keyword })
          .from(categorizationRules)
          .where(and(eq(categorizationRules.userId, ctx.userId), eq(categorizationRules.type, 'transfer'), isNull(categorizationRules.deletedAt)))
      ).map((r) => r.keyword),
    );

    const seen = new Map<string, number>();
    const meta = new Map<string, { low: boolean; suggestions: string[]; transferAsk: boolean }>();
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
      const dedupHash = `${base}#${n}`;
      const suggestions = (Array.isArray(r.suggestedCategoryIds) ? r.suggestedCategoryIds : [])
        .map(String)
        .filter((id) => catById.has(id))
        .slice(0, 3);
      if (cat && !suggestions.includes(cat.id)) suggestions.unshift(cat.id);
      const key = merchantKey(description);
      const auto = holderNames.some((h) => matchesHolder(description, h)) || (key !== '' && transferKeys.has(key));
      const ask = !auto && (r.possibleTransfer === true || looksLikeInvoicePayment(description));
      meta.set(dedupHash, {
        low: !auto && (r.confidence === 'low' || !cat || ask),
        suggestions: suggestions.slice(0, 3),
        transferAsk: ask,
      });
      prepared.push({
        clientId: ctx.clientId,
        userId: ctx.userId,
        amount: amount.toFixed(2),
        type: r.type,
        date: r.date,
        description,
        accountId: account.id,
        // A recognised transfer is not income/expense: no category, and ignored=true so every existing total skips it.
        categoryId: auto ? null : (cat?.id ?? null),
        category: auto ? null : (cat?.name ?? null),
        isTransfer: auto,
        ignored: auto,
        paymentMethod: this.paymentMethod(r.paymentMethod ?? args.paymentMethod),
        source: 'ai-chat',
        dedupHash,
      });
    });

    if (prepared.length === 0) return { result: { error: 'All rows were invalid.', rejected } };

    const existing = await this.db
      .select({ h: transactions.dedupHash })
      .from(transactions)
      .where(and(eq(transactions.userId, ctx.userId), isNull(transactions.deletedAt), inArray(transactions.dedupHash, prepared.map((p) => p.dedupHash!))));
    const existingHashes = new Set(existing.map((e) => e.h));
    const fresh = prepared.filter((p) => !existingHashes.has(p.dedupHash!));

    let importId = '';
    let review: ReviewGroup[] = [];
    if (fresh.length > 0) {
      const [imp] = await this.db
        .insert(imports)
        .values({ clientId: ctx.clientId, userId: ctx.userId, bank: args.sourceFile ?? 'chat', status: 'complete', rowCount: fresh.length })
        .returning();
      importId = imp.id;
      const inserted = await this.db
        .insert(transactions)
        .values(fresh.map((f) => ({ ...f, importId })))
        .returning({ id: transactions.id, dedupHash: transactions.dedupHash });
      await this.bumpMatchedRules(fresh, ctx);
      if (fresh.some((f) => f.isTransfer)) await this.linkTransfers(ctx);
      review = this.buildReview(fresh, inserted, meta, account.name);
    }

    if (args.sourceFile) {
      await this.db
        .delete(chatFiles)
        .where(and(eq(chatFiles.userId, ctx.userId), eq(chatFiles.name, String(args.sourceFile))));
    }

    const transferCount = fresh.filter((f) => f.isTransfer).length;
    const sum = (t: 'income' | 'expense') =>
      fresh.filter((f) => f.type === t && !f.isTransfer).reduce((acc, f) => acc + Number(f.amount), 0);
    const byCategory = new Map<string, number>();
    for (const f of fresh) {
      if (f.type !== 'expense' || f.isTransfer) continue;
      const name = f.category ?? 'Sem categoria';
      byCategory.set(name, (byCategory.get(name) ?? 0) + Number(f.amount));
    }
    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }));
    const saved: SavedSummary | undefined = fresh.length
      ? {
          importId,
          source: args.sourceFile ?? null,
          accountName: account.name,
          saved: fresh.length,
          transfers: transferCount,
          duplicatesSkipped: prepared.length - fresh.length,
          income: Number(sum('income').toFixed(2)),
          expense: Number(sum('expense').toFixed(2)),
          topCategories,
        }
      : undefined;

    return {
      result: {
        saved: fresh.length,
        transfersBetweenOwnAccounts: transferCount,
        transfersAwaitingUserConfirmation: review.filter((g) => g.transferAsk).reduce((a, g) => a + g.count, 0),
        duplicatesSkipped: prepared.length - fresh.length,
        rejected,
        account: account.name,
      },
      saved,
      review: review.length ? review : undefined,
    };
  }

  private paymentMethod(value: unknown): string | null {
    return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value) ? value : null;
  }

  /** Groups the doubtful rows by merchant so a big statement becomes a handful of cards. */
  private buildReview(
    rows: (typeof transactions.$inferInsert)[],
    inserted: { id: string; dedupHash: string | null }[],
    meta: Map<string, { low: boolean; suggestions: string[]; transferAsk: boolean }>,
    accountName: string,
  ): ReviewGroup[] {
    const idByHash = new Map(inserted.map((i) => [i.dedupHash, i.id]));
    const groups = new Map<string, ReviewGroup>();
    for (const row of rows) {
      const m = meta.get(row.dedupHash!);
      const id = idByHash.get(row.dedupHash!);
      if (!(m?.low || m?.transferAsk) || !id) continue;
      const description = row.description ?? '';
      const key = `${row.type}:${merchantKey(description) || description.toLowerCase()}`;
      const g = groups.get(key) ?? {
        key,
        merchant: merchantKey(description) || description,
        type: row.type as 'income' | 'expense',
        count: 0,
        total: 0,
        transactionIds: [],
        items: [],
        account: accountName,
        currentCategoryId: row.categoryId ?? null,
        suggestionIds: [],
      };
      g.count += 1;
      if (m.transferAsk) g.transferAsk = true;
      g.total = Number((g.total + Number(row.amount)).toFixed(2));
      g.transactionIds.push(id);
      if (g.items.length < MAX_REVIEW_ITEMS) {
        g.items.push({ id, date: String(row.date), description, amount: Number(row.amount), paymentMethod: row.paymentMethod ?? null });
      }
      for (const s of m.suggestions) if (!g.suggestionIds.includes(s) && g.suggestionIds.length < 3) g.suggestionIds.push(s);
      groups.set(key, g);
    }
    return [...groups.values()];
  }

  /** Turns the model's question list into a sheet. Account options always come from the database, never the model. */
  private async askUser(args: ToolArgs, ctx: ToolContext): Promise<ToolOutcome> {
    const raw: ToolArgs[] = Array.isArray(args.questions) ? args.questions.slice(0, 8) : [];
    if (raw.length === 0) return { result: { error: 'questions is required.' } };
    const accs = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.clientId, ctx.clientId), eq(accounts.userId, ctx.userId), isNull(accounts.deletedAt)));
    const labels: Record<string, string> = { credit: 'Cartão de crédito', debit: 'Débito', pix: 'PIX', transfer: 'Transferência', boleto: 'Boleto', cash: 'Dinheiro', other: 'Outro' };

    const questions: ChatQuestion[] = raw.map((q, i) => {
      const kind = ['account', 'payment_method', 'choice', 'account_form'].includes(q.kind) ? (q.kind as ChatQuestion['kind']) : 'choice';
      const base = { id: `q${i + 1}`, kind, title: String(q.title ?? '').slice(0, 140), subtitle: q.subtitle ? String(q.subtitle).slice(0, 200) : undefined, fileName: q.fileName ? String(q.fileName) : undefined };
      if (kind === 'account') {
        return { ...base, allowNew: true, options: accs.map((a) => ({ value: a.id, label: a.name, hint: a.type ?? undefined })) };
      }
      if (kind === 'account_form') {
        return { ...base, options: BANKS.map((b) => ({ value: b.id, label: b.name })) };
      }
      if (kind === 'payment_method') {
        return { ...base, options: PAYMENT_METHODS.map((m) => ({ value: m, label: labels[m] })) };
      }
      const opts: unknown[] = Array.isArray(q.options) ? q.options.slice(0, 8) : [];
      return { ...base, options: opts.map((o) => ({ value: String(o), label: String(o) })) };
    });
    return {
      result: { shownToUser: questions.length, note: 'The sheet is on screen. End your turn now and wait for the answers.' },
      questions,
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
      .where(and(eq(categorizationRules.userId, ctx.userId), isNull(categorizationRules.deletedAt), inArray(categorizationRules.keyword, [...patterns.keys()])));
    const hit = rules.filter((r) => r.categoryId && patterns.get(r.keyword) === r.categoryId).map((r) => r.id);
    if (hit.length) {
      await this.db
        .update(categorizationRules)
        .set({ usedCount: sql`${categorizationRules.usedCount} + 1`, updatedAt: new Date() })
        .where(inArray(categorizationRules.id, hit));
    }
  }

  /** Pairs up the two sides of each transfer (out of one account, into another) so they are linked. */
  async linkTransfers(ctx: ToolContext): Promise<number> {
    const rows = await this.db
      .select({ id: transactions.id, type: transactions.type, accountId: transactions.accountId, amount: transactions.amount, date: transactions.date })
      .from(transactions)
      .where(
        and(
          eq(transactions.clientId, ctx.clientId),
          eq(transactions.userId, ctx.userId),
          eq(transactions.isTransfer, true),
          isNull(transactions.transferGroupId),
          isNull(transactions.deletedAt),
        ),
      );
    const pairs = pairTransfers(rows.map((r) => ({ id: r.id, type: r.type, accountId: r.accountId, amount: String(r.amount), date: String(r.date) })));
    for (const [a, b] of pairs) {
      await this.db.update(transactions).set({ transferGroupId: randomUUID() }).where(inArray(transactions.id, [a, b]));
    }
    return pairs.length;
  }

  /** Remember a counterparty as "one of ours", so future imports mark it as a transfer without asking. */
  async rememberTransferRule(description: string, ctx: ToolContext): Promise<void> {
    const keyword = merchantKey(description);
    if (keyword.length < 3) return;
    const [existing] = await this.db
      .select()
      .from(categorizationRules)
      .where(and(eq(categorizationRules.userId, ctx.userId), eq(categorizationRules.keyword, keyword)));
    if (existing) {
      await this.db
        .update(categorizationRules)
        .set({ type: 'transfer', categoryId: null, category: null, isActive: true, deletedAt: null, updatedAt: new Date() })
        .where(eq(categorizationRules.id, existing.id));
    } else {
      await this.db.insert(categorizationRules).values({
        clientId: ctx.clientId,
        userId: ctx.userId,
        keyword,
        type: 'transfer',
        originalDescription: description,
      });
    }
  }

  /** One place that creates an account, used by Elio's create_account tool and by the onboarding form. */
  async createAccountFull(
    ctx: ToolContext,
    data: {
      bankId?: string;
      customBankName?: string | null;
      cardName?: string | null;
      type: 'checking' | 'savings' | 'credit' | 'wallet';
      holderName?: string | null;
      closingDay?: number | null;
      paymentDay?: number | null;
      name?: string;
    },
  ) {
    const bank = BANKS.find((b) => b.id === data.bankId);
    const name =
      (data.name ?? '').trim() ||
      (data.cardName ?? '').trim() ||
      (data.bankId === 'other' ? (data.customBankName ?? '').trim() : (bank?.name ?? '')) ||
      'Conta';
    const credit = data.type === 'credit';
    const [acc] = await this.db
      .insert(accounts)
      .values({
        clientId: ctx.clientId,
        userId: ctx.userId,
        name: name.slice(0, 80),
        type: data.type,
        bankId: data.bankId ?? null,
        cardName: data.cardName ? data.cardName.trim().slice(0, 80) : null,
        customBankName: data.bankId === 'other' && data.customBankName ? data.customBankName.trim().slice(0, 80) : null,
        hasCredit: credit,
        closingDay: credit ? (data.closingDay ?? null) : null,
        paymentDay: credit ? (data.paymentDay ?? null) : null,
        holderName: data.holderName ? data.holderName.trim().slice(0, 120) : null,
        balance: '0',
      })
      .returning();
    return acc;
  }

  private async createAccount(args: ToolArgs, ctx: ToolContext) {
    const name = String(args.name ?? '').trim();
    if (!name) return { error: 'name is required' };
    const type = ['checking', 'savings', 'credit', 'wallet'].includes(args.type) ? args.type : 'checking';
    const acc = await this.createAccountFull(ctx, { name, type, holderName: args.holderName ? String(args.holderName) : null });
    return { accountId: acc.id, name: acc.name, type: acc.type };
  }

  /**
   * Onboarding income step. The planner keeps income as versioned per-month state, so this only writes when nothing
   * is configured yet: it must never overwrite a planner the user already set up.
   */
  private async setMonthlyIncome(args: ToolArgs, ctx: ToolContext) {
    const amount = Number(args.netSalary);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'netSalary must be a positive number.' };

    const [row] = await this.db
      .select()
      .from(planner)
      .where(and(eq(planner.clientId, ctx.clientId), eq(planner.userId, ctx.userId)));
    const state = ((row?.state ?? {}) as Record<string, unknown>) ?? {};
    const versions = Array.isArray(state.plannerVersions) ? (state.plannerVersions as Record<string, unknown>[]) : [];
    const alreadyConfigured = Number(row?.salaryGross ?? 0) > 0 || versions.some((v) => Number(v.salarioBruto) > 0);
    if (alreadyConfigured) return { error: 'The planner already has an income configured. Ask the user to change it in the Planejamento screen.' };

    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const nextState = {
      ...state,
      plannerVersions: [
        {
          from: month,
          salarioBruto: amount,
          salarioDeductions: [],
          salarioBenefits: [],
          allocation: { necessidades: 70, poupanca: 20, desejos: 10 },
          categoryBudgetsPct: {},
        },
      ],
    };
    await this.db
      .insert(planner)
      .values({ clientId: ctx.clientId, userId: ctx.userId, salaryGross: amount.toFixed(2), state: nextState })
      .onConflictDoUpdate({
        target: [planner.clientId, planner.userId],
        set: { salaryGross: amount.toFixed(2), state: nextState, updatedAt: new Date() },
      });
    return { monthlyNetIncome: amount, fromMonth: month };
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

  private async createBill(args: ToolArgs, ctx: ToolContext) {
    const name = String(args.name ?? '').trim();
    const amount = Number(args.amount);
    if (!name || !Number.isFinite(amount) || amount <= 0 || !DATE_RE.test(String(args.dueDate))) {
      return { error: 'name, a positive amount and dueDate (YYYY-MM-DD) are required.' };
    }
    let cat: typeof categories.$inferSelect | undefined;
    if (args.categoryId) {
      [cat] = await this.db
        .select()
        .from(categories)
        .where(and(eq(categories.id, String(args.categoryId)), eq(categories.clientId, ctx.clientId), eq(categories.userId, ctx.userId), isNull(categories.deletedAt)));
    }
    const [bill] = await this.db
      .insert(bills)
      .values({
        clientId: ctx.clientId,
        userId: ctx.userId,
        name,
        amount: amount.toFixed(2),
        dueDate: String(args.dueDate),
        recurrence: ['monthly', 'weekly', 'yearly'].includes(args.recurrence) ? args.recurrence : null,
        categoryId: cat?.id ?? null,
        category: cat?.name ?? null,
        description: args.description ? String(args.description) : null,
      })
      .returning();
    return { billId: bill.id, name: bill.name, dueDate: bill.dueDate, recurrence: bill.recurrence };
  }

  async setCategoryRule(args: ToolArgs, ctx: ToolContext) {
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, String(args.categoryId)), eq(categories.clientId, ctx.clientId), eq(categories.userId, ctx.userId), isNull(categories.deletedAt)));
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
          deletedAt: null,
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
    const c = [eq(transactions.clientId, ctx.clientId), eq(transactions.userId, ctx.userId), args.deleted ? isNotNull(transactions.deletedAt) : isNull(transactions.deletedAt)];
    // Transfers between own accounts are saved as ignored, so they stay out of every total unless asked for explicitly.
    if (args.onlyTransfers) c.push(eq(transactions.isTransfer, true));
    else c.push(eq(transactions.ignored, false));
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
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        category: sql<string>`coalesce(${categories.name}, ${transactions.category}, 'Sem categoria')`,
        account: accounts.name,
        isTransfer: transactions.isTransfer,
        transferGroupId: transactions.transferGroupId,
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
