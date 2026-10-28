import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { categories, settings } from '../db/schema';

export interface CategoryScope {
  clientId: string;
  userId: string;
}

type CategoryType = 'income' | 'expense';

/**
 * The app keeps the user's category names in two places: `settings.expenseCategories / incomeCategories` (what the
 * Categories screen lists and the dashboards use) and the `categories` table (what the chat, imports and the review
 * sheet use). This keeps them in step so the chat offers every category the user has.
 * Defaults mirror apps/web/src/contexts/SettingsContext.jsx (used when the user never customised the list).
 */
const DEFAULT_ENABLED = {
  pt: {
    expense: ['Moradia', 'Contas', 'Veículo', 'Alimentação', 'Mercado', 'Saúde', 'Educação', 'Lazer', 'Esporte', 'Vestuário', 'Beleza', 'Compras', 'Impostos', 'Assinaturas', 'Viagens', 'Igreja', 'Investimentos', 'Sem categoria', 'Diversos'],
    income: ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Presente', 'Sem categoria', 'Outros'],
  },
  en: {
    expense: ['Housing', 'Bills', 'Vehicle', 'Food', 'Healthcare', 'Education', 'Leisure', 'Clothing', 'Taxes', 'Subscriptions', 'Travel', 'Church', 'Investments', 'Uncategorized', 'Other'],
    income: ['Salary', 'Freelance', 'Investment', 'Refund', 'Gift', 'Uncategorized', 'Other'],
  },
} as const;

/** "No category" is represented by an empty category in the chat, not a row. */
const NO_CATEGORY = new Set(['sem categoria', 'uncategorized']);
/** Catch-all names: only one per type is kept ("Outros" from onboarding vs "Diversos" from settings). */
const CATCH_ALL = new Set(['outros', 'diversos', 'other']);

const STYLE: Record<string, { color: string; icon: string }> = {
  moradia: { color: '#6366f1', icon: '🏠' },
  contas: { color: '#0ea5e9', icon: '🧾' },
  'veículo': { color: '#0ea5e9', icon: '🚗' },
  'alimentação': { color: '#f97316', icon: '🍽️' },
  mercado: { color: '#16a34a', icon: '🛒' },
  'saúde': { color: '#ef4444', icon: '🩺' },
  'educação': { color: '#8b5cf6', icon: '🎓' },
  lazer: { color: '#ec4899', icon: '🎉' },
  esporte: { color: '#22c55e', icon: '⚽' },
  'vestuário': { color: '#a855f7', icon: '👕' },
  beleza: { color: '#f472b6', icon: '💅' },
  compras: { color: '#f59e0b', icon: '🛍️' },
  impostos: { color: '#64748b', icon: '🏛️' },
  assinaturas: { color: '#14b8a6', icon: '📺' },
  viagens: { color: '#06b6d4', icon: '✈️' },
  igreja: { color: '#a78bfa', icon: '⛪' },
  investimentos: { color: '#10b981', icon: '📈' },
  'salário': { color: '#22c55e', icon: '💼' },
  freelance: { color: '#84cc16', icon: '💻' },
  reembolso: { color: '#38bdf8', icon: '↩️' },
  presente: { color: '#fb7185', icon: '🎁' },
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const asNames = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : null;

@Injectable()
export class ChatCategoriesService {
  private readonly logger = new Logger(ChatCategoriesService.name);
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /** Adds to the `categories` table every category enabled in the user's settings that is not there yet. Idempotent. */
  ensure(scope: CategoryScope): Promise<void> {
    const key = `${scope.clientId}:${scope.userId}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    // Never blocks or fails the chat: on any error the user simply keeps the categories they already have.
    const job = this.run(scope)
      .catch((e: unknown) => this.logger.error(`category sync failed for user ${scope.userId}: ${(e as Error).message}`))
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, job);
    return job;
  }

  private async run(scope: CategoryScope): Promise<void> {
    const [s] = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.userId, scope.userId), eq(settings.clientId, scope.clientId)));
    const lang = String(s?.language ?? 'pt-BR').toLowerCase().startsWith('en') ? 'en' : 'pt';
    const wanted: Record<CategoryType, string[]> = {
      expense: asNames(s?.expenseCategories) ?? [...DEFAULT_ENABLED[lang].expense],
      income: asNames(s?.incomeCategories) ?? [...DEFAULT_ENABLED[lang].income],
    };

    const existing = await this.db
      .select({ name: categories.name, type: categories.type })
      .from(categories)
      .where(and(eq(categories.userId, scope.userId), eq(categories.clientId, scope.clientId), isNull(categories.deletedAt)));

    // A legacy row with no type counts for both income and expense.
    const typesOf = (t: string | null): CategoryType[] => (t === 'income' ? ['income'] : t === 'expense' ? ['expense'] : ['income', 'expense']);
    const have = new Set(existing.flatMap((c) => typesOf(c.type).map((t) => `${t}|${norm(c.name)}`)));
    const hasCatchAll = (type: CategoryType) => existing.some((c) => typesOf(c.type).includes(type) && CATCH_ALL.has(norm(c.name)));

    const toInsert: (typeof categories.$inferInsert)[] = [];
    for (const type of ['expense', 'income'] as const) {
      let catchAllAdded = hasCatchAll(type);
      for (const name of wanted[type]) {
        const n = norm(name);
        if (NO_CATEGORY.has(n) || have.has(`${type}|${n}`)) continue;
        if (CATCH_ALL.has(n)) {
          if (catchAllAdded) continue;
          catchAllAdded = true;
        }
        have.add(`${type}|${n}`);
        const style = STYLE[n];
        toInsert.push({ clientId: scope.clientId, userId: scope.userId, name, type, color: style?.color ?? '#94a3b8', icon: style?.icon ?? '📦' });
      }
    }
    if (toInsert.length) await this.db.insert(categories).values(toInsert);
  }

  /** The user's live category with this name (accents/case ignored) that fits the type, if any. A typeless legacy row fits both. */
  async findExisting(scope: CategoryScope, name: string, type: CategoryType) {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, scope.userId), eq(categories.clientId, scope.clientId), isNull(categories.deletedAt)));
    return rows.find((c) => norm(c.name) === norm(name) && (c.type === type || c.type === null));
  }

  /** A category created in the chat also shows up in the Categories screen and dashboards. */
  async addToSettings(scope: CategoryScope, name: string, type: CategoryType): Promise<void> {
    const [s] = await this.db
      .select()
      .from(settings)
      .where(and(eq(settings.userId, scope.userId), eq(settings.clientId, scope.clientId)));
    if (!s) return;
    const lang = String(s.language ?? 'pt-BR').toLowerCase().startsWith('en') ? 'en' : 'pt';
    const column = type === 'income' ? 'incomeCategories' : 'expenseCategories';
    const current = asNames(s[column]) ?? [...DEFAULT_ENABLED[lang][type]];
    if (current.some((c) => norm(c) === norm(name))) return;
    await this.db
      .update(settings)
      .set({ [column]: [...current, name], updatedAt: new Date() })
      .where(eq(settings.id, s.id));
  }
}
