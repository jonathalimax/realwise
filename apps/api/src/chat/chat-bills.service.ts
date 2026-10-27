import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { bills, chatMessages } from '../db/schema';
import { BillsService } from '../bills/bills.service';
import { BillSuggestionsService, brtNow } from '../bill-suggestions/bill-suggestions.service';

type ChatMessageRow = typeof chatMessages.$inferSelect;
export interface BillsScope {
  clientId: string;
  userId: string;
}

export interface BillsPanelItem {
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  group: 'overdue' | 'today' | 'soon';
}

export interface BillsPanel {
  items: BillsPanelItem[];
  resolved: boolean;
  /** Filled once the user submits: what was marked paid, with the amount actually paid. */
  results?: { billId: string; name: string; paid: boolean; amount?: number }[];
}

export interface BillDecision {
  billId: string;
  paid: boolean;
  /** Amount actually paid, when different from the bill's expected amount. */
  amount?: number;
}

const OVERDUE_WINDOW_DAYS = 60;
const SOON_WINDOW_DAYS = 7;
const MAX_ITEMS = 15;
const PANEL_REUSE_HOURS = 12;

const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** Elio's bill conversations opened from emails: settle pending bills with a checklist, or accept a suggested reminder. */
@Injectable()
export class ChatBillsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly billsService: BillsService,
    private readonly suggestions: BillSuggestionsService,
  ) {}

  /** Pending bills that are overdue, due today, or due within a week: the ones worth asking about. */
  async pendingItems(scope: BillsScope, now = new Date()): Promise<BillsPanelItem[]> {
    // "Today" is the user's day in Brasília, not UTC (after 21:00 BRT the UTC date is already tomorrow).
    const local = brtNow(now);
    const from = dateOnly(new Date(local.getTime() - OVERDUE_WINDOW_DAYS * 86_400_000));
    const to = dateOnly(new Date(local.getTime() + SOON_WINDOW_DAYS * 86_400_000));
    const today = dateOnly(local);
    const rows = await this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, scope.userId),
          eq(bills.clientId, scope.clientId),
          eq(bills.status, 'pending'),
          isNull(bills.deletedAt),
          gte(bills.dueDate, from),
          lte(bills.dueDate, to),
        ),
      );
    const rank = { overdue: 0, today: 1, soon: 2 } as const;
    return rows
      .map((b): BillsPanelItem => {
        const due = String(b.dueDate).slice(0, 10);
        return {
          billId: b.id,
          name: b.name,
          amount: Number(b.amount),
          dueDate: due,
          group: due < today ? 'overdue' : due === today ? 'today' : 'soon',
        };
      })
      .sort((a, b) => rank[a.group] - rank[b.group] || a.dueDate.localeCompare(b.dueDate))
      .slice(0, MAX_ITEMS);
  }

  private async say(scope: BillsScope, content: string, billsPanel?: BillsPanel): Promise<ChatMessageRow> {
    const [message] = await this.db
      .insert(chatMessages)
      .values({ ...scope, role: 'assistant', content, billsPanel: billsPanel ?? null })
      .returning();
    return message;
  }

  /** Opened from the bills email: posts the checklist (reusing a recent unresolved one) or says everything is up to date. */
  async startBillsIntent(scope: BillsScope): Promise<{ message: ChatMessageRow }> {
    const since = new Date(Date.now() - PANEL_REUSE_HOURS * 3_600_000);
    const recent = await this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, scope.userId), eq(chatMessages.role, 'assistant'), gte(chatMessages.createdAt, since)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(20);
    const open = recent.find((m) => (m.billsPanel as BillsPanel | null) && !(m.billsPanel as BillsPanel).resolved);
    if (open) return { message: open };

    const items = await this.pendingItems(scope);
    if (items.length === 0) {
      const upToDate =
        'Boa notícia: não encontrei nenhuma conta pendente por agora. Você está em dia! 🎉\n\nSe quiser, me conte uma conta que você paga todo mês (aluguel, internet, assinatura) e eu crio um lembrete para você.';
      // Repeated opens of the same link must not stack identical messages.
      const hourAgo = new Date(Date.now() - 3_600_000);
      const same = recent.find((m) => m.content === upToDate && m.createdAt >= hourAgo);
      return { message: same ?? (await this.say(scope, upToDate)) };
    }

    const over = items.filter((i) => i.group === 'overdue').length;
    const today = items.filter((i) => i.group === 'today').length;
    const soon = items.filter((i) => i.group === 'soon').length;
    const parts = [
      over ? `${plural(over, 'atrasada', 'atrasadas')}` : '',
      today ? `${plural(today, 'vence hoje', 'vencem hoje')}` : '',
      soon ? `${plural(soon, 'vence nos próximos dias', 'vencem nos próximos dias')}` : '',
    ].filter(Boolean);
    const content =
      `Oi! Olhei suas contas e encontrei ${parts.join(', ')}.\n\n` +
      'Toque em **Marcar contas pagas** e selecione as que você já pagou. Se o valor foi diferente do previsto, é só ajustar. ' +
      'Prefere me contar por aqui? Pode escrever algo como "paguei a internet de 120".';
    return { message: await this.say(scope, content, { items, resolved: false }) };
  }

  /** The user submitted the checklist: mark the chosen bills as paid and answer with a short celebration. */
  async submitPanel(
    scope: BillsScope,
    messageId: string,
    decisions: BillDecision[],
  ): Promise<{ panelMessage: ChatMessageRow; assistantMessage: ChatMessageRow }> {
    const [message] = await this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.userId, scope.userId), eq(chatMessages.role, 'assistant')));
    const panel = message?.billsPanel as BillsPanel | null | undefined;
    if (!message || !panel) throw new NotFoundException('Bills checklist not found');
    if (panel.resolved) throw new BadRequestException('This checklist was already answered');

    const byId = new Map(panel.items.map((i) => [i.billId, i]));
    const results: NonNullable<BillsPanel['results']> = [];
    let paidTotal = 0;
    for (const d of decisions.slice(0, MAX_ITEMS)) {
      const item = byId.get(d.billId);
      if (!item) continue;
      if (!d.paid) {
        results.push({ billId: item.billId, name: item.name, paid: false });
        continue;
      }
      const amount = d.amount !== undefined && Number.isFinite(d.amount) && d.amount >= 0 ? d.amount : item.amount;
      await this.billsService.markPaid(
        item.billId,
        { paidAt: new Date().toISOString(), paidAmount: amount.toFixed(2), targetDueDate: item.dueDate },
        scope.clientId,
        scope.userId,
      );
      paidTotal += amount;
      results.push({ billId: item.billId, name: item.name, paid: true, amount });
    }

    const paid = results.filter((r) => r.paid);
    const remaining = panel.items.length - paid.length;
    const [updated] = await this.db
      .update(chatMessages)
      .set({ billsPanel: { ...panel, resolved: true, results } })
      .where(eq(chatMessages.id, message.id))
      .returning();

    let content: string;
    if (paid.length === 0) {
      content = 'Sem problemas, deixei tudo como estava. Quando pagar alguma conta, é só me avisar por aqui. 😉';
    } else {
      const list = paid.map((r) => `• ${r.name}: ${brl(r.amount ?? 0)}`).join('\n');
      content =
        `Prontinho! Marquei ${plural(paid.length, 'conta como paga', 'contas como pagas')} (${brl(paidTotal)}):\n${list}\n\n` +
        (remaining > 0
          ? `Ficaram ${plural(remaining, 'conta pendente', 'contas pendentes')}. Me avise quando pagar. `
          : 'Agora você está em dia, mandou muito bem! 🎉 ') +
        '\n\nQuer que eu cadastre mais alguma conta para você não esquecer?';
    }
    return { panelMessage: updated, assistantMessage: await this.say(scope, content) };
  }

  /** Opened from the suggestion email ("Sim, criar o lembrete"): creates the monthly bill and celebrates. */
  async startSuggestionIntent(scope: BillsScope, suggestionId: string): Promise<{ message: ChatMessageRow }> {
    const made = await this.suggestions.accept(scope, suggestionId);
    const day = made.dayOfMonth;
    const content = made.alreadyCreated
      ? `Esse lembrete já estava criado: **${made.name}**, todo dia ${day}. Está tudo certo! ✅\n\nQuer que eu cadastre mais alguma conta?`
      : `Pronto! Criei o lembrete de **${made.name}** todo dia ${day} (cerca de ${brl(made.amount)}). Eu aviso você alguns dias antes. ✅\n\n` +
        'Mandou bem, é assim que a gente não deixa conta nenhuma escapar! 🎉 Quer que eu cadastre mais alguma conta ou assinatura?';
    return { message: await this.say(scope, content) };
  }

  // -- Tools used by the chat model for free-text requests ("paguei a luz de 180") --------------------------------

  async listForModel(scope: BillsScope) {
    const items = await this.pendingItems(scope);
    return { bills: items.map((i) => ({ billId: i.billId, name: i.name, expectedAmount: i.amount, dueDate: i.dueDate, status: i.group })) };
  }

  async markPaidFromModel(scope: BillsScope, entries: { billId: string; amount?: number }[]) {
    const items = await this.pendingItems(scope);
    const byId = new Map(items.map((i) => [i.billId, i]));
    const done: { billId: string; name: string; paidAmount: number }[] = [];
    const skipped: string[] = [];
    for (const e of entries.slice(0, MAX_ITEMS)) {
      const item = byId.get(String(e.billId));
      if (!item) {
        skipped.push(String(e.billId));
        continue;
      }
      const amount = e.amount !== undefined && Number.isFinite(Number(e.amount)) && Number(e.amount) >= 0 ? Number(e.amount) : item.amount;
      await this.billsService.markPaid(
        item.billId,
        { paidAt: new Date().toISOString(), paidAmount: amount.toFixed(2), targetDueDate: item.dueDate },
        scope.clientId,
        scope.userId,
      );
      done.push({ billId: item.billId, name: item.name, paidAmount: amount });
    }
    return { marked: done, notFound: skipped };
  }
}
