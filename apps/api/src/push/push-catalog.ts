import type { PushPayload } from './push.service';

/**
 * Every push Realwise sends, in one place: who gets it, when, and the copy. The services that own the moment
 * (bill reminders, e-mail reminders, summaries, the weekly recap) call these builders instead of writing text inline.
 */
export const PUSH_CATALOG = [
  { kind: 'bills_daily', when: 'Todo dia às 9h (Brasília), junto do e-mail de contas', audience: 'Quem tem contas atrasadas, vencendo hoje ou nos próximos 3 dias' },
  { kind: 'statement_ready', when: 'Assim que o Elio termina de ler um extrato enviado no chat', audience: 'Quem enviou o extrato (sem pausar lembretes)' },
  { kind: 'categorize_pending', when: 'Lembrete diário das 10h quando há movimentos sem categoria', audience: 'Quem tem movimentos importados esperando categoria' },
  { kind: 'bill_suggestion', when: 'Lembrete das 10h quando o Elio percebe uma conta que se repete', audience: 'Quem tem uma sugestão de conta recorrente aberta' },
  { kind: 'summary_monthly', when: 'No começo do mês, quando o resumo do mês anterior fica pronto', audience: 'Quem teve movimentos no mês' },
  { kind: 'summary_trial_end', when: 'Entre 1 e 2 dias antes do fim do teste', audience: 'Quem está no teste e já registrou movimentos' },
  { kind: 'weekly_recap', when: 'Domingo às 18h (Brasília)', audience: 'Quem teve gastos na semana (novo)' },
] as const;

export type PushKind = (typeof PUSH_CATALOG)[number]['kind'];

const brl = (value: number | string) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface BillGroups {
  overdue: { name: string; amount: string }[];
  dueToday: { name: string; amount: string }[];
  dueSoon: { name: string; amount: string }[];
}

export function billsDailyPush(groups: BillGroups): PushPayload {
  const { overdue, dueToday, dueSoon } = groups;
  const total = overdue.length + dueToday.length + dueSoon.length;
  let title: string;
  if (overdue.length) title = `${plural(overdue.length, 'conta atrasada', 'contas atrasadas')}`;
  else if (dueToday.length) title = `${plural(dueToday.length, 'conta vence', 'contas vencem')} hoje`;
  else title = `${plural(dueSoon.length, 'conta vence', 'contas vencem')} nos próximos dias`;
  const first = [...overdue, ...dueToday, ...dueSoon][0];
  const body =
    total === 1
      ? `${first.name} · ${brl(first.amount)}. Toque para resolver com o Elio.`
      : `${first.name} e mais ${total - 1}. Toque para resolver com o Elio.`;
  return { title, body, url: '/chat?intent=bills', tag: 'bills_daily' };
}

export function statementReadyPush(pendingCount: number): PushPayload {
  return {
    title: 'Seu extrato está pronto',
    body: pendingCount > 0 ? `${plural(pendingCount, 'movimento espera', 'movimentos esperam')} uma categoria.` : 'Tudo categorizado. Dê uma olhada.',
    url: pendingCount > 0 ? '/transactions' : '/dashboard',
    tag: 'statement_ready',
  };
}

export function categorizePendingPush(pendingCount: number): PushPayload {
  return {
    title: 'Falta pouco para fechar seu mês',
    body: `${plural(pendingCount, 'movimento está', 'movimentos estão')} sem categoria. Leva um minuto.`,
    url: '/transactions',
    tag: 'categorize_pending',
  };
}

export function billSuggestionPush(name: string): PushPayload {
  return { title: 'Essa conta se repete?', body: `O Elio notou "${name}" todo mês. Quer que ela vire uma conta a pagar?`, url: '/bills', tag: 'bill_suggestion' };
}

export function summaryMonthlyPush(url: string): PushPayload {
  return { title: 'Seu resumo do mês está pronto', body: 'Veja para onde foi seu dinheiro e o que o Elio achou.', url, tag: 'summary_monthly' };
}

export function summaryTrialEndPush(url: string): PushPayload {
  return { title: 'Veja o que o Elio encontrou', body: 'Seu teste está acabando. Este é o resumo do que já organizamos.', url, tag: 'summary_trial_end' };
}

export function weeklyRecapPush(spent: number, previous: number): PushPayload {
  let trend = '';
  if (previous > 0) {
    const delta = Math.round(((spent - previous) / previous) * 100);
    if (delta <= -5) trend = ` ${Math.abs(delta)}% menos que na semana passada.`;
    else if (delta >= 5) trend = ` ${delta}% mais que na semana passada.`;
    else trend = ' Parecido com a semana passada.';
  }
  return { title: 'Sua semana em números', body: `Você gastou ${brl(spent)}.${trend}`, url: '/transactions', tag: 'weekly_recap' };
}
