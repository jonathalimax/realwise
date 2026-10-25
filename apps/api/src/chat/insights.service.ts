import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { createHash } from 'crypto';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { aiInsights } from '../db/schema';
import { LlmService } from '../llm/llm.service';
import { ChatToolsService, type ToolContext } from './chat-tools.service';

export interface InsightItem {
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'neutral';
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class InsightsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly llm: LlmService,
    private readonly tools: ChatToolsService,
  ) {}

  /** Insight cards for a month. Cached per user+month and only regenerated when the totals change. */
  async forMonth(ctx: ToolContext, month: string): Promise<{ items: InsightItem[] }> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !this.llm.isAvailable()) return { items: [] };

    const current = monthRange(month);
    const prevMonth = previousMonth(month);
    const prev = monthRange(prevMonth);
    const [expCat, incCat, prevExpCat, prevIncome] = await Promise.all([
      this.tools.summarize({ ...current, type: 'expense', groupBy: 'category' }, ctx),
      this.tools.summarize({ ...current, type: 'income', groupBy: 'category' }, ctx),
      this.tools.summarize({ ...prev, type: 'expense', groupBy: 'category' }, ctx),
      this.tools.summarize({ ...prev, type: 'income', groupBy: 'month' }, ctx),
    ]);

    const snapshot = {
      month,
      expense: { total: expCat.total, byCategory: expCat.groups.slice(0, 8) },
      income: { total: incCat.total, byCategory: incCat.groups.slice(0, 5) },
      previousMonth: {
        month: prevMonth,
        expense: { total: prevExpCat.total, byCategory: prevExpCat.groups.slice(0, 8) },
        income: prevIncome.total,
      },
    };
    if (snapshot.expense.total === 0 && snapshot.income.total === 0) return { items: [] };

    const sourceHash = createHash('sha1').update(JSON.stringify(snapshot)).digest('hex');
    const [cached] = await this.db
      .select()
      .from(aiInsights)
      .where(and(eq(aiInsights.userId, ctx.userId), eq(aiInsights.month, month)));
    if (cached && cached.sourceHash === sourceHash) return { items: cached.items as InsightItem[] };

    const result = await this.llm.generate(
      {
        purpose: 'insights',
        maxTokens: 1200,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You write short personal-finance insight cards for a Brazilian user (reply in Brazilian Portuguese, BRL as R$ 1.234,56). ' +
              'Use ONLY the numbers in the JSON; never invent data. Return ONLY a JSON array of 3 or 4 objects ' +
              '{"title": string (max 6 words), "body": string (max 160 chars, with a concrete number and, when useful, one actionable suggestion), ' +
              '"tone": "positive"|"warning"|"neutral"}. Cover: month-over-month change, the biggest or fastest-growing category, ' +
              'and where the user could realistically save or improve income. Not licensed financial advice; keep it general.',
          },
          { role: 'user', content: JSON.stringify(snapshot) },
        ],
      },
      ctx,
    );

    const items = this.parse(result.text);
    if (items.length === 0) return { items: [] };

    await this.db
      .insert(aiInsights)
      .values({ ...ctx, month, items, sourceHash })
      .onConflictDoUpdate({
        target: [aiInsights.userId, aiInsights.month],
        set: { items, sourceHash, createdAt: new Date() },
      });
    return { items };
  }

  private parse(text: string): InsightItem[] {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) return [];
    try {
      const raw = JSON.parse(text.slice(start, end + 1)) as unknown[];
      return raw
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) => ({
          title: String(r.title ?? '').slice(0, 80),
          body: String(r.body ?? '').slice(0, 300),
          tone: (['positive', 'warning', 'neutral'].includes(String(r.tone)) ? r.tone : 'neutral') as InsightItem['tone'],
        }))
        .filter((i) => i.title && i.body)
        .slice(0, 4);
    } catch {
      return [];
    }
  }
}
