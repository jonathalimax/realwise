import type {
  BillRow,
  BudgetRow,
  CardRow,
  CategoryRow,
  FlowSegment,
  Insight,
  MissingStep,
  PlannerMonth,
  SummaryInput,
  SummaryPayload,
  SummaryTone,
  TrendPoint,
  TxRow,
} from './summary.types';

/**
 * Everything in the financial summary is computed here, from plain rows, with no database and no model: the numbers
 * must be exactly reproducible. (Elio may later rewrite the sentences, never the figures.)
 *
 * It follows the same rules as the Home so the two never disagree: card expenses belong to the month the card bill is
 * paid, transfers and ignored rows never count, spending with no category stays out of the needs/wants buckets.
 */

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Same buckets as the app's 50/30/20 view (web BudgetContext DEFAULT_RULE_MAPPING); anything else counts as a want.
const NEEDS = new Set(['housing', 'moradia', 'bills', 'contas', 'food', 'alimentação', 'groceries', 'mercado', 'healthcare', 'saúde', 'vehicle', 'veículo', 'taxes', 'impostos']);
const SAVINGS = new Set(['investments', 'investimentos']);
const UNCATEGORIZED = new Set(['', 'sem categoria', 'uncategorized']);

const MIN_TRANSACTIONS = 8;
const MIN_CATEGORIZED = 0.6;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
export const monthShort = (month: string) => SHORT[Number(month.slice(5, 7)) - 1] ?? month;
export const monthLabel = (month: string) => `${cap(monthName(month))} ${month.slice(0, 4)}`;

export function addMonths(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Whole reais, Brazilian grouping: "R$ 1.520". */
export const reais = (n: number) => `R$\u00A0${Math.round(n).toLocaleString('pt-BR')}`;

/**
 * The month a card purchase is paid, from the card's closing and payment days. Same rule as the web's
 * `getPaymentMonth`: bought before the closing day it lands on this month's bill, otherwise next month's, and a
 * payment day on or before the closing day pushes the payment one more month.
 */
export function paymentMonthOf(date: string, closingDay: number, paymentDay: number): string {
  const month = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  const invoice = day < closingDay ? month : addMonths(month, 1);
  return paymentDay <= closingDay ? addMonths(invoice, 1) : invoice;
}

function monthKeyOf(t: TxRow, cards: CardRow[]): string {
  const purchase = t.date.slice(0, 7);
  if (t.type === 'income' || t.investmentId) return purchase;
  const card = t.bankId ? cards.find((c) => c.id === t.bankId || c.bankId === t.bankId) : undefined;
  if (!card || !card.hasCredit || !card.closingDay || !card.paymentDay) return purchase;
  if (t.paymentMethod && t.paymentMethod !== 'credit') return purchase;
  return paymentMonthOf(t.date, card.closingDay, card.paymentDay);
}

const ruleOf = (category: string): 'needs' | 'wants' | 'savings' => {
  const key = category.trim().toLowerCase();
  if (NEEDS.has(key)) return 'needs';
  if (SAVINGS.has(key)) return 'savings';
  return 'wants';
};

interface MonthAgg {
  income: number;
  expense: number;
  invested: number;
  count: number;
  byCat: Map<string, number>;
  uncategorized: number;
  needs: number;
  wants: number;
  savingsRule: number;
  goalIncome: number;
  creditExpenses: number;
}

const emptyAgg = (): MonthAgg => ({
  income: 0, expense: 0, invested: 0, count: 0, byCat: new Map(), uncategorized: 0, needs: 0, wants: 0, savingsRule: 0, goalIncome: 0, creditExpenses: 0,
});

function aggregate(rows: TxRow[], cards: CardRow[]): Map<string, MonthAgg> {
  const months = new Map<string, MonthAgg>();
  for (const t of rows) {
    const key = monthKeyOf(t, cards);
    const agg = months.get(key) ?? emptyAgg();
    months.set(key, agg);
    agg.count += 1;
    if (t.type === 'income') {
      agg.income += t.amount;
      if (t.goalId) agg.goalIncome += t.amount;
      continue;
    }
    agg.expense += t.amount;
    const name = (t.category ?? '').trim();
    const rule = ruleOf(name);
    if (t.paymentMethod === 'credit' || (t.paymentMethod == null && t.bankId && cards.some((c) => (c.id === t.bankId || c.bankId === t.bankId) && c.hasCredit))) {
      agg.creditExpenses += 1;
    }
    if (t.investmentId || rule === 'savings') {
      agg.invested += t.amount;
      if (rule === 'savings') agg.savingsRule += t.amount;
      continue;
    }
    if (UNCATEGORIZED.has(name.toLowerCase())) {
      agg.uncategorized += t.amount;
      continue;
    }
    agg.byCat.set(name, (agg.byCat.get(name) ?? 0) + t.amount);
    if (rule === 'needs') agg.needs += t.amount;
    else agg.wants += t.amount;
  }
  return months;
}

const spentOf = (a: MonthAgg) => a.expense - a.invested;
const hasData = (a: MonthAgg | undefined): a is MonthAgg => Boolean(a && a.income + a.expense > 0);

// ───────────────────────────── score ─────────────────────────────

interface ScoreParts {
  saving: number;
  budget: number | null;
  bills: number;
  trend: number;
  quality: number;
}

function billScore(bills: BillRow[], month: string, today: string): { points: number; due: number; paid: number } {
  const due = bills.filter((b) => b.dueDate.slice(0, 7) === month && b.dueDate.slice(0, 10) <= today);
  if (due.length === 0) return { points: 11, due: 0, paid: 0 }; // nothing was due: neutral, slightly positive
  const paid = due.filter((b) => b.status === 'paid').length;
  return { points: (paid / due.length) * 15, due: due.length, paid };
}

function budgetAdherence(agg: MonthAgg, planner: PlannerMonth | null): number | null {
  if (!planner || planner.net <= 0) return null;
  const parts = [
    { used: agg.needs, planned: (planner.net * planner.allocation.necessidades) / 100 },
    { used: agg.wants, planned: (planner.net * planner.allocation.desejos) / 100 },
  ].filter((p) => p.planned > 0);
  if (parts.length === 0) return null;
  const each = parts.map((p) => clamp(1 - Math.max(0, p.used / p.planned - 1) * 2, 0, 1));
  return each.reduce((s, v) => s + v, 0) / each.length;
}

function scoreMonth(
  month: string,
  months: Map<string, MonthAgg>,
  bills: BillRow[],
  planner: PlannerMonth | null,
  today: string,
  partial: boolean,
): { score: number; parts: ScoreParts } | null {
  const agg = months.get(month);
  if (!hasData(agg) || agg.income <= 0) return null;
  const spent = spentOf(agg);
  const savingRate = (agg.income - spent) / agg.income;

  const history = [1, 2, 3].map((i) => months.get(addMonths(month, -i))).filter(hasData).map(spentOf).filter((v) => v > 0);
  let trend = 9; // no history, or a month still in progress: neutral
  if (!partial && history.length > 0 && spent > 0) {
    const ratio = spent / (history.reduce((s, v) => s + v, 0) / history.length);
    trend = ratio <= 0.9 ? 15 : ratio <= 1 ? 12 : ratio <= 1.1 ? 8 : ratio <= 1.25 ? 4 : 0;
  }

  const categorized = spent > 0 ? 1 - agg.uncategorized / spent : 1;
  const adherence = budgetAdherence(agg, planner);
  const parts: ScoreParts = {
    saving: clamp(savingRate / 0.2, 0, 1) * 35,
    budget: adherence === null ? null : adherence * 25,
    bills: billScore(bills, month, today).points,
    trend,
    quality: clamp(categorized / 0.9, 0, 1) * 10,
  };
  const max = 35 + (parts.budget === null ? 0 : 25) + 15 + 15 + 10;
  const total = parts.saving + (parts.budget ?? 0) + parts.bills + parts.trend + parts.quality;
  return { score: Math.round((total / max) * 100), parts };
}

const scoreLabel = (s: number) => (s >= 80 ? 'muito boa' : s >= 65 ? 'boa' : s >= 50 ? 'equilibrada' : 'precisa de atenção');
const toneForScore = (s: number): SummaryTone => (s >= 70 ? 'proud' : s >= 50 ? 'steady' : 'improve');

// ───────────────────────────── pieces ─────────────────────────────

function flowOf(agg: MonthAgg, income: number): { segments: FlowSegment[]; totalPct: number; overflow: boolean } {
  const spent = spentOf(agg);
  const cats = [...agg.byCat.entries()].sort((a, b) => b[1] - a[1]);
  const tones: FlowSegment['tone'][] = ['slate', 'violet', 'sky', 'pink'];
  const segments: FlowSegment[] = [];
  const pct = (v: number) => (income > 0 ? round2((v / income) * 100) : 0);
  let shown = 0;
  cats.slice(0, 3).forEach(([name, amount], i) => {
    segments.push({ key: name, label: name, amount: round2(amount), pct: pct(amount), tone: tones[i] });
    shown += amount;
  });
  const others = spent - shown;
  if (others > 0.5) segments.push({ key: 'others', label: 'Outros', amount: round2(others), pct: pct(others), tone: 'pink' });
  if (agg.invested > 0) segments.push({ key: 'saved', label: 'Guardou', amount: round2(agg.invested), pct: pct(agg.invested), tone: 'saved' });
  const left = income - spent - agg.invested;
  if (left > 0.5) segments.push({ key: 'left', label: 'Sobrou', amount: round2(left), pct: pct(left), tone: 'left' });
  const totalPct = round2(segments.reduce((s, x) => s + x.pct, 0));
  return { segments, totalPct, overflow: totalPct > 100.5 };
}

function budgetOf(agg: MonthAgg, planner: PlannerMonth | null): BudgetRow[] | null {
  if (!planner || planner.net <= 0) return null;
  const row = (key: BudgetRow['key'], label: string, pctOfIncome: number, used: number): BudgetRow => {
    const planned = (planner.net * pctOfIncome) / 100;
    const usedPct = planned > 0 ? round2((used / planned) * 100) : 0;
    if (key === 'savings') {
      return used >= planned ? { key, label, state: 'goal', amount: round2(used - planned), usedPct } : { key, label, state: 'missing', amount: round2(planned - used), usedPct };
    }
    return used > planned ? { key, label, state: 'over', amount: round2(used - planned), usedPct } : { key, label, state: 'left', amount: round2(planned - used), usedPct };
  };
  return [
    row('needs', 'Necessidades', planner.allocation.necessidades, agg.needs),
    row('wants', 'Desejos', planner.allocation.desejos, agg.wants),
    row('savings', 'Poupança', planner.allocation.poupanca, agg.savingsRule + agg.goalIncome),
  ];
}

function categoriesOf(cur: MonthAgg, prev: MonthAgg | undefined, compare: boolean): CategoryRow[] {
  return [...cur.byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => {
      const before = compare ? prev?.byCat.get(name) ?? 0 : 0;
      return { name, amount: round2(amount), deltaPct: before > 0 ? Math.round(((amount - before) / before) * 100) : null };
    });
}

function insightsOf(args: {
  cur: MonthAgg;
  prev: MonthAgg | undefined;
  month: string;
  today: string;
  bills: BillRow[];
  income: number;
  spent: number;
  left: number;
  streak: number;
  spentChangePct: number | null;
  savingRate: number | null;
  goalPct: number;
  compare: boolean;
}): { wins: Insight[]; fixes: Insight[] } {
  const { cur, prev, month, today, bills, income, spent, left, streak, spentChangePct, savingRate, goalPct, compare } = args;
  const prevName = monthName(addMonths(month, -1));
  const wins: Insight[] = [];
  const fixes: Insight[] = [];

  if (streak >= 2) wins.push({ title: `${streak} meses seguidos no azul`, detail: 'Suas receitas ficaram acima das despesas em cada um deles.' });

  if (compare && prev) {
    const moves = [...cur.byCat.entries()].map(([name, amount]) => ({ name, amount, before: prev.byCat.get(name) ?? 0 })).filter((m) => m.before > 0);
    const dropped = moves.map((m) => ({ ...m, diff: m.before - m.amount, pct: Math.round(((m.before - m.amount) / m.before) * 100) })).filter((m) => m.pct >= 15 && m.diff >= 80).sort((a, b) => b.diff - a.diff)[0];
    if (dropped) wins.push({ title: `${dropped.name} caiu ${dropped.pct}%`, detail: `Foram ${reais(dropped.diff)} a menos que em ${prevName}.` });

    const rose = moves.map((m) => ({ ...m, diff: m.amount - m.before, pct: Math.round(((m.amount - m.before) / m.before) * 100) })).filter((m) => m.pct >= 25 && m.diff >= 150).sort((a, b) => b.diff - a.diff)[0];
    if (rose) {
      fixes.push({
        title: `${rose.name} subiu ${rose.pct}%`,
        detail: `${reais(rose.amount)} contra ${reais(rose.before)} em ${prevName}. Voltar ao nível anterior já ajuda.`,
        frees: Math.round(rose.diff),
      });
    }
  }

  const due = bills.filter((b) => b.dueDate.slice(0, 7) === month && b.dueDate.slice(0, 10) <= today);
  if (due.length > 0 && due.every((b) => b.status === 'paid')) {
    wins.push({ title: 'Todas as contas pagas em dia', detail: `${due.length} de ${due.length}, sem juros nem multa.` });
  }

  if (savingRate !== null && savingRate * 100 >= Math.max(goalPct, 1) && cur.invested + Math.max(0, left) > 0 && income > 0) {
    wins.push({ title: 'Meta de poupança batida', detail: `Você guardou ${Math.round(savingRate * 100)}% da renda; a meta era ${Math.round(goalPct)}%.` });
  }
  if (spentChangePct !== null && spentChangePct <= -5 && !wins.some((w) => /caiu/.test(w.title))) {
    wins.push({ title: `Você gastou ${Math.abs(spentChangePct)}% menos`, detail: `Em comparação com ${prevName}.` });
  }

  const overdue = bills.filter((b) => b.status !== 'paid' && b.dueDate.slice(0, 10) < today);
  if (overdue.length > 0) {
    const total = overdue.reduce((s, b) => s + b.amount, 0);
    fixes.unshift({
      title: `${overdue.length} ${overdue.length === 1 ? 'conta atrasada' : 'contas atrasadas'}, ${reais(total)}`,
      detail: 'Pagar esta semana evita juros e multa que crescem a cada dia.',
      urgent: true,
      href: '/bills?status=overdue',
    });
  }

  if (spent > 0 && cur.uncategorized / spent >= 0.1) {
    fixes.push({ title: `${reais(cur.uncategorized)} sem categoria`, detail: 'O Elio classifica para você em cerca de um minuto, e o resumo fica mais preciso.', href: '/chat' });
  }
  return { wins: wins.slice(0, 3), fixes: fixes.slice(0, 3) };
}

// ───────────────────────────── main ─────────────────────────────

export function computeSummary(input: SummaryInput & { plannerPrev?: PlannerMonth | null }): SummaryPayload {
  if (input.kind === 'trial_end' && input.trialWindow) return computeTrialSummary(input);

  const { month, today, firstName, bills, planner, partial, cards } = input;
  const months = aggregate(input.transactions, cards);
  const cur = months.get(month) ?? emptyAgg();
  const prevMonth = addMonths(month, -1);
  const prev = months.get(prevMonth);
  const compare = !partial;

  const income = round2(cur.income);
  const spent = round2(spentOf(cur));
  const invested = round2(cur.invested);
  const left = round2(income - spent - invested);
  const savingRate = income > 0 ? round2((income - spent) / income) : null;
  const prevSpent = prev ? spentOf(prev) : 0;
  const spentChangePct = compare && prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;
  const categorizedPct = spent > 0 ? round2(1 - cur.uncategorized / spent) : 1;

  // Trend and streak over the last six months.
  const trend: TrendPoint[] = [];
  const streakMonths: { month: string; label: string; blue: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(month, -i);
    const a = months.get(m);
    trend.push({ month: m, label: monthShort(m), income: round2(a?.income ?? 0), spent: round2(a ? spentOf(a) : 0) });
    streakMonths.push({ month: m, label: monthShort(m), blue: Boolean(a && a.income > 0 && spentOf(a) + a.invested <= a.income) });
  }
  let monthsInBlue = 0;
  for (let i = streakMonths.length - 1; i >= 0 && streakMonths[i].blue; i--) monthsInBlue++;

  // Is there enough clean data for a fair verdict?
  const missing: MissingStep[] = [];
  if (income <= 0) {
    missing.push({ key: 'income', title: 'Registrar sua renda', detail: `Não encontramos nenhuma entrada em ${monthName(month)}. Conte ao Elio quanto você recebeu.`, ctaLabel: 'Falar com o Elio', ctaPath: '/chat' });
  }
  if (cards.some((c) => c.hasCredit) && cur.creditExpenses === 0) {
    missing.push({ key: 'statement', title: 'Enviar o extrato do cartão', detail: `Não encontramos a fatura de ${monthName(month)}. É nela que mora a maior parte dos gastos.`, ctaLabel: 'Enviar o extrato para o Elio', ctaPath: '/chat' });
  }
  if (spent > 0 && categorizedPct < MIN_CATEGORIZED) {
    missing.push({ key: 'categories', title: 'Categorizar os gastos', detail: `Só ${Math.round(categorizedPct * 100)}% dos gastos têm categoria. O Elio faz isso em cerca de um minuto.`, ctaLabel: 'Pedir ao Elio para categorizar', ctaPath: `/chat?q=${encodeURIComponent(`Categorize as minhas despesas sem categoria de ${monthName(month)}.`)}` });
  }
  const incomplete = missing.length > 0 || cur.count < MIN_TRANSACTIONS;

  const base = {
    version: 1 as const,
    kind: input.kind,
    period: { month, label: monthLabel(month), monthName: monthName(month), partial, prevMonthName: compare ? monthName(prevMonth) : null },
    firstName,
    totals: { income, spent, invested, left, savingRate, spentChangePct },
    flow: flowOf(cur, income),
    categories: categoriesOf(cur, prev, compare),
    trend,
    budget: budgetOf(cur, planner),
    streak: { monthsInBlue, months: streakMonths },
    quality: { categorizedPct, transactionCount: cur.count, uncategorizedAmount: round2(cur.uncategorized) },
    trial: null,
  };

  const name = firstName ? `, ${firstName}` : '';
  const mn = monthName(month);

  if (incomplete) {
    const why = missing[0]?.key === 'categories' ? `só ${Math.round(categorizedPct * 100)}% dos seus gastos têm categoria` : missing[0]?.key === 'income' ? 'ainda não há entradas registradas' : 'há poucas movimentações registradas';
    const steps = Math.max(1, missing.length);
    return {
      ...base,
      tone: 'incomplete',
      headline: `Falta pouco${name}.`,
      subline: `Ainda não dá para dizer como foi seu ${mn} com justiça: ${why}. ${steps === 1 ? 'Falta um passo rápido' : `Faltam ${steps} passos rápidos`}.`,
      score: null,
      scoreLabel: null,
      scoreDelta: null,
      wins: [],
      fixes: [],
      share: null,
      missing: missing.length ? missing : [{ key: 'statement', title: 'Registrar mais movimentações', detail: `Só encontramos ${cur.count} lançamentos em ${mn}. Envie o extrato para o Elio ler.`, ctaLabel: 'Enviar o extrato para o Elio', ctaPath: '/chat' }],
      nextStep: { eyebrow: 'PRÓXIMO PASSO', text: 'Complete seu mês e receba a nota de saúde financeira, os gráficos e o que ajustar.', ctaLabel: 'Falar com o Elio', ctaPath: '/chat' },
    };
  }

  const scored = scoreMonth(month, months, bills, planner, today, partial);
  const score = scored?.score ?? 0;
  const prevScored = compare ? scoreMonth(prevMonth, months, bills, input.plannerPrev ?? null, today, false) : null;
  const scoreDelta = prevScored ? score - prevScored.score : null;
  const tone = toneForScore(score);
  const goalPct = planner?.allocation.poupanca ?? 15;
  const { wins, fixes } = insightsOf({ cur, prev, month, today, bills, income, spent, left, streak: monthsInBlue, spentChangePct, savingRate, goalPct, compare });

  const prevName = monthName(prevMonth);
  const lessThanPrev = spentChangePct !== null && spentChangePct <= -3;
  const keptText = invested > 0 ? `guardou ${reais(invested)}` : left > 0 ? `ficou com ${reais(left)} sobrando` : 'fechou no zero a zero';
  let headline: string;
  let subline: string;
  if (tone === 'proud') {
    headline = `Que mês${name}.`;
    subline = lessThanPrev ? `Você gastou ${Math.abs(spentChangePct as number)}% menos que em ${prevName} e ${keptText}.` : `Você fechou ${mn} no azul e ${keptText}.`;
  } else if (tone === 'steady') {
    headline = `${cap(mn)} foi equilibrado${name}.`;
    subline = left >= 0 ? `Você fechou no azul e ${keptText}. Há espaço para guardar um pouco mais.` : `Os gastos ficaram próximos da renda. Pequenos ajustes já mudam o resultado.`;
  } else if (left < 0) {
    headline = `${cap(mn)} apertou${name}.`;
    subline = `Saíram ${reais(-left)} a mais do que entraram. Dá para consertar, e já separamos por onde começar.`;
  } else {
    headline = `${cap(mn)} pede atenção${name}.`;
    subline = spentChangePct !== null && spentChangePct > 0 ? `Você fechou no azul, mas os gastos subiram ${spentChangePct}% em relação a ${prevName}.` : 'Você fechou no azul, mas há pontos que merecem cuidado.';
  }
  if (partial) subline = `Até hoje em ${mn}: ${subline.charAt(0).toLowerCase()}${subline.slice(1)}`;

  const frees = fixes.reduce((s, f) => s + (f.frees ?? 0), 0);
  let nextStep: SummaryPayload['nextStep'];
  if (tone === 'improve' && left < 0) {
    const gap = -left;
    nextStep = {
      eyebrow: `PARA ${monthName(addMonths(month, 1)).toUpperCase()}`,
      text: frees > 0 ? `Os ajustes acima liberam ${reais(frees)}${frees >= gap ? ' e fecham a diferença' : ` e cobrem boa parte dos ${reais(gap)}`}. O Elio monta o plano do mês com você em 2 minutos.` : `Para fechar o mês no azul faltam ${reais(gap)}. O Elio ajuda a achar onde cortar, em 2 minutos.`,
      ctaLabel: 'Montar meu plano com o Elio',
      ctaPath: `/chat?q=${encodeURIComponent(`Me ajude a montar um plano para fechar ${monthName(addMonths(month, 1))} no azul.`)}`,
    };
  } else if (left > 0) {
    const suggest = Math.max(50, Math.round((left * 0.55) / 50) * 50);
    nextStep = {
      eyebrow: `PARA ${monthName(addMonths(month, 1)).toUpperCase()}`,
      text: `Sobraram ${reais(left)} sem destino. Mandar ${reais(Math.min(suggest, left))} para a reserva de emergência é um ótimo próximo passo.`,
      ctaLabel: 'Falar com o Elio',
      ctaPath: '/chat',
    };
  } else {
    nextStep = { eyebrow: `PARA ${monthName(addMonths(month, 1)).toUpperCase()}`, text: 'O Elio ajuda você a definir limites por categoria e a começar o próximo mês com um plano.', ctaLabel: 'Falar com o Elio', ctaPath: '/chat' };
  }

  const share =
    (tone === 'proud' || tone === 'steady') && savingRate !== null && savingRate > 0
      ? { value: `${Math.round(savingRate * 100)}%`, caption: `da renda guardada em ${mn}`, footer: monthsInBlue >= 2 ? `${monthsInBlue} meses seguidos no azul` : null }
      : null;

  return { ...base, tone, headline, subline, score, scoreLabel: scoreLabel(score), scoreDelta, wins, fixes, share, missing: [], nextStep };
}

/** What Elio found during the trial: shown just before it ends, as the reason to subscribe. No score: too little history. */
function computeTrialSummary(input: SummaryInput): SummaryPayload {
  const { month, today, firstName, bills, cards } = input;
  const win = input.trialWindow as { from: string; to: string };
  const inWindow = input.transactions.filter((t) => t.date >= win.from && t.date <= win.to);
  const months = aggregate(inWindow, cards);
  const all = emptyAgg();
  const spentByCat = new Map<string, number>();
  for (const a of months.values()) {
    all.income += a.income;
    all.expense += a.expense;
    all.invested += a.invested;
    all.count += a.count;
    all.uncategorized += a.uncategorized;
    for (const [k, v] of a.byCat) spentByCat.set(k, (spentByCat.get(k) ?? 0) + v);
  }
  all.byCat = spentByCat;
  const income = round2(all.income);
  const spent = round2(spentOf(all));
  const days = Math.max(1, Math.round((Date.parse(win.to) - Date.parse(win.from)) / 86400000) + 1);
  const overdue = bills.filter((b) => b.status !== 'paid' && b.dueDate.slice(0, 10) < today);
  const fixes: Insight[] = [];
  if (overdue.length > 0) fixes.push({ title: `${overdue.length} ${overdue.length === 1 ? 'conta atrasada' : 'contas atrasadas'}, ${reais(overdue.reduce((s, b) => s + b.amount, 0))}`, detail: 'O Elio avisa antes do vencimento para isso não acontecer.', urgent: true, href: '/bills?status=overdue' });
  const top = [...spentByCat.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) fixes.push({ title: `${top[0]} é seu maior gasto`, detail: `${reais(top[1])} nestes ${days} dias. Com um limite por categoria, o Elio avisa antes de passar.` });
  if (spent > 0 && all.uncategorized / spent >= 0.1) fixes.push({ title: `${reais(all.uncategorized)} ainda sem categoria`, detail: 'Com o plano ativo, o Elio continua aprendendo suas categorias.' });
  const name = firstName ? `, ${firstName}` : '';
  return {
    version: 1,
    kind: 'trial_end',
    tone: 'trial',
    period: { month, label: monthLabel(month), monthName: monthName(month), partial: true, prevMonthName: null, windowLabel: `seus ${days} dias` },
    firstName,
    headline: `Seus ${days} dias com o Elio${name}.`,
    subline:
      all.count > 0 && spent > 0
        ? `Em ${days} dias você registrou ${all.count} ${all.count === 1 ? 'movimentação' : 'movimentações'} e já sabe para onde foram ${reais(spent)}.`
        : 'Você ainda registrou poucas movimentações. Com um extrato, o Elio mostra para onde foi seu dinheiro em minutos.',
    score: null,
    scoreLabel: null,
    scoreDelta: null,
    totals: { income, spent, invested: round2(all.invested), left: round2(income - spent - all.invested), savingRate: income > 0 ? round2((income - spent) / income) : null, spentChangePct: null },
    flow: flowOf(all, income),
    categories: categoriesOf(all, undefined, false),
    trend: [],
    budget: null,
    streak: { monthsInBlue: 0, months: [] },
    wins: [],
    fixes: fixes.slice(0, 3),
    nextStep: { eyebrow: 'CONTINUE DE ONDE PAROU', text: 'Seus dados continuam guardados. Assine para manter o Elio organizando seu dinheiro todo mês, com o resumo, os lembretes e o plano.', ctaLabel: 'Ver planos', ctaPath: '/billing' },
    share: null,
    quality: { categorizedPct: spent > 0 ? round2(1 - all.uncategorized / spent) : 1, transactionCount: all.count, uncategorizedAmount: round2(all.uncategorized) },
    missing: [],
    trial: { days, transactionCount: all.count },
  };
}
