import { Injectable } from '@nestjs/common';
import { AdminAnalyticsService } from '../admin-analytics/admin-analytics.service';
import { LlmService } from '../llm/llm.service';
import type { LlmMessage, LlmToolDefinition } from '../llm/llm.types';
import type { SandboxScope } from './simulator.service';

export interface OpsChart {
  title: string;
  type: 'line' | 'bar';
  unit: 'count' | 'usd';
  data: { date: string; value: number }[];
}

export interface OpsTurn {
  reply: string;
  charts: OpsChart[];
}

const MAX_ROUNDS = 5;

const CHART_METRICS = {
  signups: { title: 'Novos cadastros por dia', unit: 'count', key: 'count', type: 'bar' },
  activeUsers: { title: 'Usuários ativos por dia', unit: 'count', key: 'count', type: 'line' },
  aiCostUsd: { title: 'Custo de IA por dia (US$)', unit: 'usd', key: 'costUsd', type: 'line' },
} as const;
type ChartMetric = keyof typeof CHART_METRICS;

const TOOLS: LlmToolDefinition[] = [
  {
    name: 'get_overview',
    description:
      'Business numbers for the last N days: users (total, new, active, by state), funnel and conversion, revenue (MRR/ARR in BRL cents, subscriptions, cancelations), finance (revenue vs AI cost, fees, net, margin), AI usage and cost (USD) by model, usage and health. Call it before answering any question about values or metrics.',
    parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365, description: 'Window in days, default 30.' } } },
  },
  {
    name: 'get_top_ai_users',
    description: 'Users ranked by AI cost, chat messages or imports in the last N days (email, cost in USD, messages, imports). Use for "who costs the most" questions.',
    parameters: {
      type: 'object',
      properties: {
        sort: { type: 'string', enum: ['cost', 'messages', 'imports'] },
        days: { type: 'integer', minimum: 1, maximum: 365 },
        limit: { type: 'integer', minimum: 1, maximum: 20 },
      },
    },
  },
  {
    name: 'show_chart',
    description: 'Draw a daily chart for the user. The app fetches the real data itself; you only choose the metric and window. Say one sentence about what it shows.',
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: Object.keys(CHART_METRICS) },
        days: { type: 'integer', minimum: 7, maximum: 365 },
      },
      required: ['metric'],
    },
  },
];

const SYSTEM = `Você é o analista de operação do RealWise (app brasileiro de finanças pessoais com o assistente Elio), conversando com o dono do negócio dentro do painel admin.
- Responda sempre em português do Brasil, direto e sem enrolação: o número primeiro, depois no máximo 2 observações úteis ou uma sugestão concreta.
- NUNCA invente números. Para qualquer valor, métrica ou comparação, chame get_overview (ou get_top_ai_users) antes de responder. Se o dado não existir, diga isso.
- Valores de receita vêm em centavos de real (divida por 100 e formate como R$ 1.234,56). Custos de IA vêm em dólares (US$).
- Quando um gráfico ajudar, chame show_chart em vez de descrever a série em texto.
- Você só lê dados: não altera nada, não envia e-mails, não mexe em assinaturas.
- Formatação: parágrafos curtos, listas com "-", **negrito** só nos números-chave. Sem tabelas nem títulos.
- Sobre rentabilidade: use finance (receita líquida de taxas e custo de IA). Seja honesto quando a amostra for pequena (poucos assinantes).`;

/** Read-only business analyst for the owner: the same model plumbing as the chat, but with analytics tools only. */
@Injectable()
export class OpsAssistantService {
  constructor(
    private readonly llm: LlmService,
    private readonly analytics: AdminAnalyticsService,
  ) {}

  async ask(history: { role: 'user' | 'assistant'; content: string }[], scope: SandboxScope): Promise<OpsTurn> {
    const messages: LlmMessage[] = [
      { role: 'system', content: `${SYSTEM}\nHoje é ${new Date().toISOString().slice(0, 10)}.` },
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }) as LlmMessage),
    ];
    const charts: OpsChart[] = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const result = await this.llm.generate({ purpose: 'insights', tier: 'light', messages, tools: TOOLS, maxTokens: 2000 }, scope);
      if (result.toolCalls.length === 0) return { reply: result.text.trim() || 'Não consegui responder agora.', charts };

      messages.push({ role: 'assistant', content: result.text || null, tool_calls: result.toolCalls });
      for (const call of result.toolCalls) {
        const out = await this.run(call.function.name, call.function.arguments, charts);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out) });
      }
    }
    return { reply: 'Precisei de passos demais para responder. Pode reformular a pergunta?', charts };
  }

  private async run(name: string, rawArgs: string, charts: OpsChart[]): Promise<unknown> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(rawArgs || '{}') as Record<string, unknown>;
    } catch {
      return { error: 'Invalid arguments.' };
    }
    const days = String(Math.min(365, Math.max(1, Math.round(Number(args.days) || 30))));
    try {
      if (name === 'get_overview') {
        const { series: _series, ...rest } = await this.analytics.overview({ days });
        void _series;
        return rest;
      }
      if (name === 'get_top_ai_users') {
        const sort = ['cost', 'messages', 'imports'].includes(String(args.sort)) ? String(args.sort) : 'cost';
        return await this.analytics.usersUsage({ days, sort, limit: String(Math.min(20, Math.max(1, Number(args.limit) || 10))) });
      }
      if (name === 'show_chart') {
        const metric = String(args.metric) as ChartMetric;
        const def = CHART_METRICS[metric];
        if (!def) return { error: 'Unknown metric.' };
        const { series } = await this.analytics.overview({ days });
        const rows = series[metric] as Record<string, unknown>[];
        const data = rows.map((r) => ({ date: String(r.date), value: Number(r[def.key] ?? 0) }));
        charts.push({ title: def.title, type: def.type, unit: def.unit, data });
        const total = data.reduce((s, d) => s + d.value, 0);
        return { shownToUser: def.title, points: data.length, total: Math.round(total * 100) / 100 };
      }
    } catch (e) {
      return { error: (e as Error).message };
    }
    return { error: 'Unknown tool.' };
  }
}
