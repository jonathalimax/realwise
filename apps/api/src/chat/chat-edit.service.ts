/* eslint-disable @typescript-eslint/no-explicit-any --
   This service drives one generic code path over several Drizzle tables chosen at runtime from a strict
   allowlist (ENTITIES). Table/column access is dynamic by design; all values are validated before use. */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import {
  accounts,
  bills,
  budgets,
  categories,
  categorizationRules,
  chatChangeLog,
  settings,
  transactions,
} from '../db/schema';
import type { LlmToolDefinition } from '../llm/llm.types';
import type { ChatQuestion } from './chat.types';
import type { ToolContext } from './chat-tools.service';

type EntityKey = 'transaction' | 'account' | 'category' | 'bill' | 'budget' | 'rule' | 'settings';
type Row = Record<string, any>;
type ToolArgs = Record<string, any>;

type FieldDef =
  | { kind: 'string'; max?: number; nullable?: boolean }
  | { kind: 'number'; min?: number; nullable?: boolean } // numeric(12,2) columns (stored as text)
  | { kind: 'int'; min: number; max: number; nullable?: boolean }
  | { kind: 'bool' }
  | { kind: 'date' }
  | { kind: 'enum'; values: readonly string[]; nullable?: boolean }
  | { kind: 'ref'; to: 'category' | 'account'; nullable?: boolean };

interface EntityDef {
  label: string;
  table: any;
  fields: Record<string, FieldDef>;
  /** Text columns matched by `find_records` search. */
  searchCols: string[];
  softDelete: boolean;
  describe: (row: Row) => string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

const brl = (v: unknown) => `R$ ${Number(v ?? 0).toFixed(2).replace('.', ',')}`;

const ENTITIES: Record<EntityKey, EntityDef> = {
  transaction: {
    label: 'transação',
    table: transactions,
    softDelete: true,
    searchCols: ['description'],
    fields: {
      amount: { kind: 'number', min: 0.01 },
      type: { kind: 'enum', values: ['income', 'expense'] },
      date: { kind: 'date' },
      description: { kind: 'string', max: 200 },
      categoryId: { kind: 'ref', to: 'category', nullable: true },
      accountId: { kind: 'ref', to: 'account', nullable: true },
      paymentMethod: { kind: 'enum', values: ['credit', 'debit', 'pix', 'transfer', 'boleto', 'cash', 'other'], nullable: true },
      ignored: { kind: 'bool' },
    },
    describe: (r) => `${r.date} · ${r.description ?? '(sem descrição)'} · ${brl(r.amount)}`,
  },
  account: {
    label: 'conta',
    table: accounts,
    softDelete: true,
    searchCols: ['name', 'cardName', 'customBankName'],
    fields: {
      name: { kind: 'string', max: 80 },
      type: { kind: 'enum', values: ['checking', 'savings', 'credit', 'investment', 'wallet'], nullable: true },
      cardName: { kind: 'string', max: 80, nullable: true },
      customBankName: { kind: 'string', max: 80, nullable: true },
      hasCredit: { kind: 'bool' },
      closingDay: { kind: 'int', min: 1, max: 31, nullable: true },
      paymentDay: { kind: 'int', min: 1, max: 31, nullable: true },
      balance: { kind: 'number', min: -1e9, nullable: true },
      color: { kind: 'string', max: 30, nullable: true },
      icon: { kind: 'string', max: 40, nullable: true },
    },
    describe: (r) => `${r.name}${r.type ? ` (${r.type})` : ''}`,
  },
  category: {
    label: 'categoria',
    table: categories,
    softDelete: true,
    searchCols: ['name'],
    fields: {
      name: { kind: 'string', max: 80 },
      type: { kind: 'enum', values: ['income', 'expense'], nullable: true },
      color: { kind: 'string', max: 30, nullable: true },
      icon: { kind: 'string', max: 40, nullable: true },
    },
    describe: (r) => `${r.name}${r.type ? ` (${r.type})` : ''}`,
  },
  bill: {
    label: 'conta a pagar',
    table: bills,
    softDelete: true,
    searchCols: ['name', 'description'],
    fields: {
      name: { kind: 'string', max: 120 },
      description: { kind: 'string', max: 200, nullable: true },
      amount: { kind: 'number', min: 0.01 },
      dueDate: { kind: 'date' },
      status: { kind: 'enum', values: ['pending', 'paid', 'overdue'] },
      recurrence: { kind: 'enum', values: ['monthly', 'weekly', 'yearly'], nullable: true },
      categoryId: { kind: 'ref', to: 'category', nullable: true },
      notificationEnabled: { kind: 'bool' },
      notificationDaysBefore: { kind: 'int', min: 0, max: 30 },
    },
    describe: (r) => `${r.name} · ${brl(r.amount)} · vence ${r.dueDate} · ${r.status}`,
  },
  budget: {
    label: 'orçamento',
    table: budgets,
    softDelete: true,
    searchCols: ['name', 'month'],
    fields: {
      name: { kind: 'string', max: 120, nullable: true },
      amount: { kind: 'number', min: 0, nullable: true },
      totalBudget: { kind: 'number', min: 0, nullable: true },
      period: { kind: 'enum', values: ['monthly', 'weekly', 'yearly'], nullable: true },
      month: { kind: 'string', max: 7, nullable: true },
      categoryId: { kind: 'ref', to: 'category', nullable: true },
    },
    describe: (r) => `${r.name ?? r.month ?? 'Orçamento'} · ${brl(r.amount ?? r.totalBudget)}`,
  },
  rule: {
    label: 'regra de categorização',
    table: categorizationRules,
    softDelete: true,
    searchCols: ['keyword', 'category'],
    fields: {
      keyword: { kind: 'string', max: 100 },
      categoryId: { kind: 'ref', to: 'category' },
      isActive: { kind: 'bool' },
    },
    describe: (r) => `"${r.keyword}" → ${r.category ?? '?'}`,
  },
  settings: {
    label: 'preferências',
    table: settings,
    softDelete: false,
    searchCols: [],
    fields: {
      currency: { kind: 'enum', values: ['BRL', 'USD', 'EUR'] },
      language: { kind: 'enum', values: ['pt-BR', 'en-US'] },
      billReminders: { kind: 'bool' },
      monthlyRollover: { kind: 'bool' },
    },
    describe: () => 'Preferências do app',
  },
};

const ALL = Object.keys(ENTITIES) as EntityKey[];
const DELETABLE = ALL.filter((k) => ENTITIES[k].softDelete);

const FIELD_HELP = Object.entries(ENTITIES)
  .map(([k, d]) => `${k}: ${Object.keys(d.fields).join(', ')}`)
  .join(' | ');

export const EDIT_TOOLS: LlmToolDefinition[] = [
  {
    name: 'find_records',
    description:
      'Look up records (with their ids and current editable values) before changing them. For transactions use query_transactions instead. Use deleted=true to find soft-deleted records you could restore.',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ALL.filter((k) => k !== 'transaction') },
        search: { type: 'string', description: 'Case-insensitive text matched against names/keywords.' },
        deleted: { type: 'boolean' },
        limit: { type: 'number', description: 'Default 30, max 100.' },
      },
      required: ['entity'],
    },
  },
  {
    name: 'update_records',
    description: `Change fields on existing records by id (e.g. a card's closing/payment day, a bill's due date or amount, a transaction's category, a category name, a preference). Editable fields per entity — ${FIELD_HELP}. Amounts are positive numbers in BRL; dates are YYYY-MM-DD; days are 1-31. Changing ONE record applies immediately; changing several records first shows the user a confirmation sheet — then end your turn. settings needs no ids. Credit-card limit is NOT stored; closing and payment day are.`,
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ALL },
        ids: { type: 'array', items: { type: 'string' }, description: 'Record UUIDs (omit for settings).' },
        changes: { type: 'object', description: 'Field → new value. Use null to clear a nullable field.' },
      },
      required: ['entity', 'changes'],
    },
  },
  {
    name: 'delete_records',
    description:
      'Delete records. This is always a SOFT delete (hidden, recoverable with restore_records, never destroyed). The user is always shown a confirmation sheet first — after calling, end your turn and wait.',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: DELETABLE },
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['entity', 'ids'],
    },
  },
  {
    name: 'restore_records',
    description: 'Bring back soft-deleted records by id (find them with deleted=true). Applies immediately.',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: DELETABLE },
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['entity', 'ids'],
    },
  },
];

export interface EditOutcome {
  result: unknown;
  questions?: ChatQuestion[];
}

@Injectable()
export class ChatEditService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private get q(): any {
    return this.db as any;
  }

  private parseIds(raw: unknown): string[] | { error: string } {
    const ids = Array.isArray(raw) ? [...new Set(raw.map(String))] : [];
    if (ids.length === 0) return { error: 'ids is required.' };
    if (ids.length > MAX_IDS) return { error: `At most ${MAX_IDS} ids per call.` };
    if (!ids.every((i) => UUID_RE.test(i))) return { error: 'ids must be record UUIDs from find_records / query_transactions.' };
    return ids;
  }

  private entity(raw: unknown): EntityDef & { key: EntityKey } | null {
    const key = String(raw) as EntityKey;
    return ENTITIES[key] ? { ...ENTITIES[key], key } : null;
  }

  private async rows(def: EntityDef, ids: string[] | null, ctx: ToolContext, mode: 'live' | 'deleted' = 'live'): Promise<Row[]> {
    const t = def.table;
    const conds = [eq(t.clientId, ctx.clientId), eq(t.userId, ctx.userId)];
    if (ids) conds.push(inArray(t.id, ids));
    if (def.softDelete) conds.push(mode === 'live' ? isNull(t.deletedAt) : isNotNull(t.deletedAt));
    return this.q.select().from(t).where(and(...conds));
  }

  // ───────────────────────────── find ─────────────────────────────
  async find(args: ToolArgs, ctx: ToolContext): Promise<EditOutcome> {
    const def = this.entity(args.entity);
    if (!def || def.key === 'transaction') return { result: { error: 'Unknown entity. For transactions use query_transactions.' } };
    const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
    let rows = await this.rows(def, null, ctx, args.deleted ? 'deleted' : 'live');
    const term = String(args.search ?? '').trim().toLowerCase();
    if (term) {
      rows = rows.filter((r) => def.searchCols.some((c) => String(r[c] ?? '').toLowerCase().includes(term)));
    }
    return {
      result: {
        count: rows.length,
        rows: rows.slice(0, limit).map((r) => ({ id: r.id, summary: def.describe(r), ...this.pick(r, Object.keys(def.fields)) })),
      },
    };
  }

  private pick(row: Row, keys: string[]): Row {
    return Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
  }

  // ───────────────────────────── validation ─────────────────────────────
  /** Validates `changes` against the entity's allowlist and returns column values to write. */
  private async validate(
    def: EntityDef & { key: EntityKey },
    changes: ToolArgs,
    ctx: ToolContext,
  ): Promise<{ values: Row } | { error: string }> {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length === 0) {
      return { error: 'changes must be a non-empty object.' };
    }
    const values: Row = {};
    for (const [field, raw] of Object.entries(changes)) {
      const f = def.fields[field];
      if (!f) return { error: `"${field}" is not editable. Editable fields: ${Object.keys(def.fields).join(', ')}.` };
      if (raw === null) {
        if (!('nullable' in f) || !f.nullable) return { error: `"${field}" cannot be cleared.` };
        values[field] = null;
        continue;
      }
      switch (f.kind) {
        case 'string': {
          const v = String(raw).trim();
          if (!v) return { error: `"${field}" cannot be empty.` };
          values[field] = v.slice(0, f.max ?? 200);
          break;
        }
        case 'number': {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < (f.min ?? 0)) return { error: `"${field}" must be a number ≥ ${f.min ?? 0}.` };
          values[field] = n.toFixed(2);
          break;
        }
        case 'int': {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < f.min || n > f.max) return { error: `"${field}" must be a whole number between ${f.min} and ${f.max}.` };
          values[field] = n;
          break;
        }
        case 'bool': {
          if (typeof raw === 'boolean') values[field] = raw;
          else if (raw === 'true' || raw === 'false') values[field] = raw === 'true';
          else return { error: `"${field}" must be true or false.` };
          break;
        }
        case 'date': {
          if (!DATE_RE.test(String(raw))) return { error: `"${field}" must be YYYY-MM-DD.` };
          values[field] = String(raw);
          break;
        }
        case 'enum': {
          if (!f.values.includes(String(raw))) return { error: `"${field}" must be one of: ${f.values.join(', ')}.` };
          values[field] = String(raw);
          break;
        }
        case 'ref': {
          const target = f.to === 'category' ? ENTITIES.category : ENTITIES.account;
          const id = String(raw);
          if (!UUID_RE.test(id)) return { error: `"${field}" must be a UUID.` };
          const [found] = await this.rows(target, [id], ctx);
          if (!found) return { error: `"${field}" does not match any of the user's ${f.to === 'category' ? 'categories' : 'accounts'}.` };
          values[field] = id;
          if (field === 'categoryId') {
            values.category = found.name;
            if (def.key === 'rule') values.type = found.type;
          }
          break;
        }
      }
    }
    if ('categoryId' in values && values.categoryId === null) values.category = null;
    return { values };
  }

  // ───────────────────────────── update ─────────────────────────────
  async update(args: ToolArgs, ctx: ToolContext, confirmed = false): Promise<EditOutcome> {
    const def = this.entity(args.entity);
    if (!def) return { result: { error: `Unknown entity. Use one of: ${ALL.join(', ')}.` } };

    let ids: string[];
    if (def.key === 'settings') {
      const [row] = await this.rows(def, null, ctx);
      if (!row) return { result: { error: 'No preferences found for this user.' } };
      ids = [row.id];
    } else {
      const parsed = this.parseIds(args.ids);
      if (!Array.isArray(parsed)) return { result: parsed };
      ids = parsed;
    }

    const validated = await this.validate(def, args.changes, ctx);
    if ('error' in validated) return { result: validated };

    const rows = await this.rows(def, ids, ctx);
    if (rows.length === 0) return { result: { error: 'No matching records (they may be deleted or belong to someone else).' } };

    if (rows.length > 1 && !confirmed) {
      const fields = Object.keys(args.changes).join(', ');
      return this.proposal({
        title: `Alterar ${rows.length} ${def.label}s?`,
        subtitle: `Campos: ${fields}`,
        rows: rows.map((r) => def.describe(r)),
        danger: false,
        action: { tool: 'update_records', args: { entity: def.key, ids: rows.map((r) => r.id), changes: args.changes } },
      });
    }

    const changed: { id: string; summary: string; from: Row; to: Row }[] = [];
    for (const row of rows) {
      const values: Row = { ...validated.values };
      if (def.key === 'bill' && 'status' in values) {
        if (values.status === 'paid') {
          const now = new Date();
          Object.assign(values, { paidAt: now, paidDate: now, paidAmount: values.amount ?? row.amount });
        } else {
          Object.assign(values, { paidAt: null, paidDate: null, paidAmount: null });
        }
      }
      const before = this.pick(row, Object.keys(values));
      await this.q.update(def.table).set({ ...values, updatedAt: new Date() }).where(and(eq(def.table.id, row.id), eq(def.table.userId, ctx.userId), eq(def.table.clientId, ctx.clientId)));
      await this.log(ctx, def.key, row.id, 'update', before, values);
      changed.push({ id: row.id, summary: def.describe(row), from: before, to: values });
    }
    return { result: { updated: changed.length, changes: changed.map((c) => ({ record: c.summary, from: c.from, to: c.to })) } };
  }

  // ───────────────────────────── delete / restore ─────────────────────────────
  async remove(args: ToolArgs, ctx: ToolContext, confirmed = false): Promise<EditOutcome> {
    const def = this.entity(args.entity);
    if (!def || !def.softDelete) return { result: { error: `Cannot delete. Deletable entities: ${DELETABLE.join(', ')}.` } };
    const parsed = this.parseIds(args.ids);
    if (!Array.isArray(parsed)) return { result: parsed };

    const rows = await this.rows(def, parsed, ctx);
    if (rows.length === 0) return { result: { error: 'No matching records (already deleted, or not the user\'s).' } };

    if (!confirmed) {
      const notes: string[] = [];
      if (def.key === 'account') {
        const linked = await this.q.select({ id: transactions.id }).from(transactions).where(and(inArray(transactions.accountId, rows.map((r) => r.id)), isNull(transactions.deletedAt)));
        if (linked.length) notes.push(`${linked.length} transações ligadas a esta conta continuam salvas.`);
      }
      if (def.key === 'category') notes.push('Transações com esta categoria continuam salvas, sem categoria visível.');
      return this.proposal({
        title: `Excluir ${rows.length} ${def.label}${rows.length > 1 ? 's' : ''}?`,
        subtitle: ['Fica oculto e pode ser restaurado depois.', ...notes].join(' '),
        rows: rows.map((r) => def.describe(r)),
        danger: true,
        action: { tool: 'delete_records', args: { entity: def.key, ids: rows.map((r) => r.id) } },
      });
    }

    const now = new Date();
    for (const row of rows) {
      await this.q.update(def.table).set({ deletedAt: now, updatedAt: now }).where(and(eq(def.table.id, row.id), eq(def.table.userId, ctx.userId), eq(def.table.clientId, ctx.clientId)));
      await this.log(ctx, def.key, row.id, 'delete', this.pick(row, ['deletedAt']), { deletedAt: now.toISOString() });
    }
    return { result: { softDeleted: rows.length, records: rows.map((r) => def.describe(r)), restorable: true } };
  }

  async restore(args: ToolArgs, ctx: ToolContext): Promise<EditOutcome> {
    const def = this.entity(args.entity);
    if (!def || !def.softDelete) return { result: { error: `Cannot restore. Entities: ${DELETABLE.join(', ')}.` } };
    const parsed = this.parseIds(args.ids);
    if (!Array.isArray(parsed)) return { result: parsed };
    const rows = await this.rows(def, parsed, ctx, 'deleted');
    if (rows.length === 0) return { result: { error: 'No deleted records match those ids.' } };
    for (const row of rows) {
      await this.q.update(def.table).set({ deletedAt: null, updatedAt: new Date() }).where(and(eq(def.table.id, row.id), eq(def.table.userId, ctx.userId), eq(def.table.clientId, ctx.clientId)));
      await this.log(ctx, def.key, row.id, 'restore', { deletedAt: row.deletedAt }, { deletedAt: null });
    }
    return { result: { restored: rows.length, records: rows.map((r) => def.describe(r)) } };
  }

  // ───────────────────────────── helpers ─────────────────────────────
  /** Parks the operation on a confirm question; it runs only when the user answers "yes" (see ChatService). */
  private proposal(p: { title: string; subtitle: string; rows: string[]; danger: boolean; action: NonNullable<ChatQuestion['action']> }): EditOutcome {
    const shown = p.rows.slice(0, 8);
    if (p.rows.length > shown.length) shown.push(`… e mais ${p.rows.length - shown.length}`);
    return {
      result: { awaitingUserConfirmation: true, note: 'A confirmation sheet is on screen. Nothing has changed yet. End your turn now.' },
      questions: [
        {
          id: 'q1',
          kind: 'confirm',
          title: p.title,
          subtitle: p.subtitle,
          preview: shown,
          danger: p.danger,
          options: [
            { value: 'yes', label: p.danger ? 'Sim, excluir' : 'Sim, alterar' },
            { value: 'no', label: 'Cancelar' },
          ],
          action: p.action,
        },
      ],
    };
  }

  private async log(ctx: ToolContext, entity: EntityKey, recordId: string, action: 'update' | 'delete' | 'restore', before: Row, after: Row) {
    await this.q.insert(chatChangeLog).values({ clientId: ctx.clientId, userId: ctx.userId, entity, recordId, action, before, after });
  }
}
