import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { bills, categories, planner, transactions, userMemories } from '../db/schema';
import { brtNow } from '../bill-suggestions/bill-suggestions.service';

export interface MemoryScope {
  clientId: string;
  userId: string;
}

export type MemoryKind = 'goal' | 'preference' | 'context';
export const MEMORY_KINDS: MemoryKind[] = ['goal', 'preference', 'context'];
export const MAX_MEMORIES = 40;
export const MAX_MEMORY_LENGTH = 240;

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PlannerVersion {
  from?: string;
  salarioBruto?: number;
  salarioDeductions?: { type?: string; amount?: number }[];
  categoryBudgetsPct?: Record<string, number>;
}

/**
 * What Elio remembers about a user: lasting facts the user stated (saved through the remember_fact tool or typed in
 * the memory screen) plus a compact, always-fresh snapshot of the current month.
 */
@Injectable()
export class ChatMemoryService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  list(scope: MemoryScope) {
    return this.db
      .select()
      .from(userMemories)
      .where(and(eq(userMemories.clientId, scope.clientId), eq(userMemories.userId, scope.userId)))
      .orderBy(asc(userMemories.createdAt));
  }

  async add(scope: MemoryScope, content: string, kind: string, source: 'chat' | 'user') {
    const text = content.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_LENGTH);
    if (text.length < 3) throw new BadRequestException('Texto muito curto.');
    const safeKind = (MEMORY_KINDS as string[]).includes(kind) ? kind : 'context';
    const existing = await this.list(scope);
    const dupe = existing.find((m) => norm(m.content) === norm(text));
    if (dupe) return dupe;
    if (existing.length >= MAX_MEMORIES) throw new BadRequestException(`Limite de ${MAX_MEMORIES} itens atingido. Apague algum para salvar outro.`);
    const [row] = await this.db.insert(userMemories).values({ ...scope, content: text, kind: safeKind, source }).returning();
    return row;
  }

  async update(scope: MemoryScope, id: string, patch: { content?: string; kind?: string }) {
    const set: Partial<typeof userMemories.$inferInsert> = { updatedAt: new Date() };
    if (patch.content !== undefined) {
      const text = patch.content.replace(/\s+/g, ' ').trim().slice(0, MAX_MEMORY_LENGTH);
      if (text.length < 3) throw new BadRequestException('Texto muito curto.');
      set.content = text;
    }
    if (patch.kind !== undefined && (MEMORY_KINDS as string[]).includes(patch.kind)) set.kind = patch.kind;
    const [row] = await this.db
      .update(userMemories)
      .set(set)
      .where(and(eq(userMemories.id, id), eq(userMemories.clientId, scope.clientId), eq(userMemories.userId, scope.userId)))
      .returning();
    if (!row) throw new NotFoundException('Item não encontrado');
    return row;
  }

  async remove(scope: MemoryScope, id: string): Promise<void> {
    const rows = await this.db
      .delete(userMemories)
      .where(and(eq(userMemories.id, id), eq(userMemories.clientId, scope.clientId), eq(userMemories.userId, scope.userId)))
      .returning({ id: userMemories.id });
    if (!rows.length) throw new NotFoundException('Item não encontrado');
  }

  /** Stable block for the (cached) system prompt: changes only when the user's facts change. */
  async factsBlock(scope: MemoryScope): Promise<string> {
    const rows = await this.list(scope);
    if (!rows.length) return '(nothing saved yet)';
    return rows.map((m) => `- ${m.id} | ${m.kind} | ${m.content}`).join('\n');
  }

  // ── tool handlers ──────────────────────────────────────────────────────────

  async rememberFromModel(scope: MemoryScope, args: { text?: unknown; kind?: unknown }) {
    try {
      const row = await this.add(scope, String(args.text ?? ''), String(args.kind ?? 'context'), 'chat');
      return { saved: true, id: row.id, text: row.content };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not save.' };
    }
  }

  async forgetFromModel(scope: MemoryScope, args: { id?: unknown }) {
    try {
      await this.remove(scope, String(args.id ?? ''));
      return { forgotten: true };
    } catch {
      return { error: 'No remembered item with that id.' };
    }
  }

  // ── monthly snapshot ───────────────────────────────────────────────────────

  /** Compact picture of the current month (income, spending vs plan per category, bills due). Recomputed every turn. */
  async monthSnapshot(scope: MemoryScope): Promise<string> {
    const now = brtNow();
    const today = now.toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const from = `${month}-01`;
    const base = [
      eq(transactions.clientId, scope.clientId),
      eq(transactions.userId, scope.userId),
      isNull(transactions.deletedAt),
      eq(transactions.ignored, false),
      gte(transactions.date, from),
      lte(transactions.date, today),
    ];

    const [totals, spendByCat, plannerRow, dueBills] = await Promise.all([
      this.db
        .select({ type: transactions.type, total: sql<string>`sum(${transactions.amount})` })
        .from(transactions)
        .where(and(...base))
        .groupBy(transactions.type),
      this.db
        .select({
          name: sql<string>`coalesce(${categories.name}, ${transactions.category}, 'Sem categoria')`,
          total: sql<string>`sum(${transactions.amount})`,
        })
        .from(transactions)
        .leftJoin(categories, eq(categories.id, transactions.categoryId))
        .where(and(...base, eq(transactions.type, 'expense')))
        .groupBy(sql`1`)
        .orderBy(sql`sum(${transactions.amount}) desc`)
        .limit(25),
      this.db.select().from(planner).where(and(eq(planner.clientId, scope.clientId), eq(planner.userId, scope.userId))),
      this.db
        .select({ name: bills.name, amount: bills.amount, dueDate: bills.dueDate })
        .from(bills)
        .where(
          and(
            eq(bills.clientId, scope.clientId),
            eq(bills.userId, scope.userId),
            isNull(bills.deletedAt),
            inArray(bills.status, ['pending', 'overdue']),
            lte(bills.dueDate, new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10)),
          ),
        )
        .orderBy(asc(bills.dueDate))
        .limit(8),
    ]);

    const income = Number(totals.find((t) => t.type === 'income')?.total ?? 0);
    const expense = Number(totals.find((t) => t.type === 'expense')?.total ?? 0);

    const versions = ((plannerRow[0]?.state as { plannerVersions?: PlannerVersion[] } | null)?.plannerVersions ?? []) as PlannerVersion[];
    const version = versions.find((v) => v.from === month);
    const gross = Number(version?.salarioBruto ?? 0);
    const deducted = (version?.salarioDeductions ?? []).reduce((s, d) => s + (d.type === 'pct' ? (gross * Number(d.amount ?? 0)) / 100 : Number(d.amount ?? 0)), 0);
    const net = gross > 0 ? gross - deducted : 0;
    const pct = version?.categoryBudgetsPct ?? {};

    const lines: string[] = [`Month so far (${month}, up to ${today}; transfers between own accounts excluded):`];
    lines.push(`- Planned net income: ${net > 0 ? brl(net) : 'not set'} | income logged: ${brl(income)} | expenses logged: ${brl(expense)}`);

    const spendMap = new Map(spendByCat.map((r) => [r.name, Number(r.total)]));
    const rows: string[] = [];
    const seen = new Set<string>();
    for (const [name, spent] of spendMap) {
      const p = Number(pct[name] ?? 0);
      const limit = net > 0 && p > 0 ? (net * p) / 100 : 0;
      seen.add(name);
      if (rows.length < 8 || (limit > 0 && spent > limit)) {
        rows.push(`${name} ${brl(spent)}${limit > 0 ? ` of ${brl(limit)} (${Math.round((spent / limit) * 100)}%)` : ''}`);
      }
    }
    for (const [name, p] of Object.entries(pct)) {
      if (!seen.has(name) && Number(p) > 0 && net > 0 && rows.length < 12) rows.push(`${name} R$ 0,00 of ${brl((net * Number(p)) / 100)} (0%)`);
    }
    lines.push(rows.length ? `- Spending by category (spent of planned limit): ${rows.join('; ')}` : '- No expenses logged yet this month.');

    if (dueBills.length) {
      lines.push(
        `- Bills pending (next 14 days or overdue): ${dueBills
          .map((b) => `${b.name} ${brl(Number(b.amount))} due ${String(b.dueDate).slice(5).split('-').reverse().join('/')}${String(b.dueDate) < today ? ' OVERDUE' : ''}`)
          .join('; ')}`,
      );
    } else {
      lines.push('- No bills pending in the next 14 days.');
    }
    return lines.join('\n');
  }
}
