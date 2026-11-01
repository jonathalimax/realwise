import type { EngagementKind } from '../app-settings/app-settings.types';
import { computeSummary } from '../summary/summary-metrics';
import { buildSummaryEmail } from '../summary/summary-email';
import type { TxRow } from '../summary/summary.types';
import type { NotificationsService } from './notifications.service';

export interface EmailPreview {
  id: string;
  group: string;
  label: string;
  /** Who receives it: the customer, or the team inbox. */
  audience: 'user' | 'team';
  /** Plain-language trigger and timing, kept next to the code that decides it (reminder-rules.ts, schedulers, controllers). */
  when: string;
  subject: string;
  html: string;
}

interface Entry extends Omit<EmailPreview, 'subject' | 'html'> {
  run: (n: NotificationsService) => Promise<void>;
}

const TO = 'maria@exemplo.com.br';

const engagement = (kind: EngagementKind, label: string, when: string, extra: Record<string, unknown> = {}): Entry => ({
  id: kind,
  group: 'Lembretes e ciclo de vida',
  label,
  audience: 'user',
  when,
  run: (n) =>
    n.sendEngagementEmail(TO, kind, {
      name: 'Maria',
      trialDaysRemaining: 3,
      unsubscribeUserId: '00000000-0000-0000-0000-000000000000',
      unsubscribeToken: 'exemplo',
      now: new Date(),
      ...extra,
    }),
});

function sampleTransactions(): TxRow[] {
  const tx = (date: string, type: 'income' | 'expense', amount: number, category: string | null): TxRow => ({
    date, type, amount, category, bankId: 'nubank', paymentMethod: null, investmentId: null, goalId: null,
  });
  return [
    tx('2026-08-05', 'income', 6500, 'Salário'), tx('2026-08-12', 'expense', 2100, 'Moradia'), tx('2026-08-20', 'expense', 1400, 'Mercado'),
    tx('2026-09-05', 'income', 6500, 'Salário'), tx('2026-09-12', 'expense', 2100, 'Moradia'), tx('2026-09-22', 'expense', 1650, 'Mercado'),
    tx('2026-10-05', 'income', 6500, 'Salário'), tx('2026-10-10', 'expense', 2100, 'Moradia'), tx('2026-10-14', 'expense', 1500, 'Mercado'),
    tx('2026-10-18', 'expense', 620, 'Restaurantes'), tx('2026-10-21', 'expense', 380, 'Transporte'), tx('2026-10-27', 'expense', 240, 'Lazer'),
  ];
}

const ENTRIES: Entry[] = [
  engagement('welcome', 'Boas-vindas', 'Logo depois de criar a conta (uma única vez), no próximo ciclo do envio horário.'),
  engagement('activation_day1', 'Ativação: dia 1', 'No teste grátis, 24h depois do cadastro, se a pessoa ainda não adicionou nada.'),
  engagement('activation_day3', 'Ativação: dia 3', 'No teste grátis, 72h depois do cadastro, se ainda não adicionou nada.'),
  engagement('activation_day5', 'Ativação: dia 5', 'No teste grátis, 120h depois do cadastro, se ainda não adicionou nada.'),
  engagement('install_app', 'Instalar o app', 'Para quem já adicionou algo: uma vez, de terça a quinta (horário de Brasília), 48h depois do início do teste.'),
  engagement('trial_import', 'Importar no teste', 'Durante o teste grátis, para quem ainda não importou o extrato.'),
  engagement('trial_ending', 'Teste acabando', 'No teste grátis, quando faltam 24h ou menos para acabar.'),
  engagement('trial_expired', 'Teste acabou', 'Até 72h depois do fim do teste, se a pessoa não assinou.'),
  engagement('monthly_import', 'Importação mensal', 'Assinantes, a partir do dia 5, se nenhuma transação entrou no mês.'),
  engagement('bill_suggestion', 'Sugestão de conta fixa', 'Quando o Elio percebe um pagamento recorrente que ainda não é uma conta cadastrada.', {
    suggestion: { id: 'exemplo', name: 'Netflix', amount: '55.90', dayOfMonth: 12, dismissUrl: 'https://realwise.com.br' },
  }),
  engagement('statement_ready', 'Extrato pronto', 'No instante em que o Elio termina de ler o extrato e a pessoa já saiu do chat. Um por importação.', { pendingCount: 3 }),
  engagement('categorize_pending', 'Falta categorizar', '24h depois da importação, se a pessoa não voltou ao chat e ainda há transações sem categoria. Um por importação.', { pendingCount: 3 }),
  engagement('payment_failed', 'Pagamento recusado', 'Quando a cobrança da assinatura falha.'),
  engagement('payment_failed_followup', 'Pagamento recusado: lembrete', '48h ou mais depois da falha, quando o prazo de carência está acabando.'),
  engagement('winback_7', 'Volta: 7 dias', 'Entre 7 e 30 dias depois de a pessoa sair. Uma vez.'),
  engagement('winback_30', 'Volta: 30 dias, com cupom', 'Entre 30 e 60 dias depois de sair, com cupom pessoal de uso único. Uma vez.', {
    promo: { code: 'VOLTA30-EXEMPLO', percent: 30, months: 3, validDays: 7 },
  }),
  engagement('winback_60', 'Volta: 60 dias, com cupom', 'Entre 60 e 120 dias depois de sair, com cupom pessoal. Uma vez; depois disso, silêncio.', {
    promo: { code: 'VOLTA60-EXEMPLO', percent: 40, months: 3, validDays: 7 },
  }),
  {
    id: 'bills', group: 'Lembretes e ciclo de vida', label: 'Contas a pagar', audience: 'user',
    when: 'Diariamente, na hora configurada em Admin > E-mails, quando há conta atrasada, vencendo hoje ou nos próximos dias.',
    run: (n) => {
      const today = new Date().toISOString().slice(0, 10);
      return n.sendBillReminderEmail(TO, {
        overdue: [{ id: '1', name: 'Internet', amount: '120.50', dueDate: today, daysOverdue: 2 }],
        dueToday: [{ id: '2', name: 'Cartão de crédito', amount: '890.00', dueDate: today }],
        dueSoon: [{ id: '3', name: 'Aluguel', amount: '2100.00', dueDate: today }],
      });
    },
  },
  {
    id: 'summary_monthly', group: 'Resumo', label: 'Resumo do mês', audience: 'user',
    when: 'Dias 1 a 3 de cada mês às 09:30 (Brasília), uma vez por pessoa. Também sai quando o teste está acabando.',
    run: (n) => {
      const payload = computeSummary({
        kind: 'monthly', month: '2026-10', today: '2026-11-01', firstName: 'Maria', transactions: sampleTransactions(),
        cards: [], bills: [], planner: null, partial: false,
      });
      const mail = buildSummaryEmail(payload, 'https://realwise.com.br/resumo', 'https://realwise.com.br/cancelar-resumo');
      return n.sendSummaryEmail(TO, { ...mail, unsubscribeUrl: 'https://realwise.com.br/cancelar-resumo' });
    },
  },
  {
    id: 'abandoned_1', group: 'Checkout', label: 'Checkout abandonado: 1º aviso', audience: 'user',
    when: 'Enviado pelo admin (Usuários) para quem começou a assinar e não terminou.',
    run: (n) => n.sendAbandonedCheckoutEmail(TO, 'Maria', 1),
  },
  {
    id: 'abandoned_2', group: 'Checkout', label: 'Checkout abandonado: 2º aviso, com cupom', audience: 'user',
    when: 'Segundo contato da série de recuperação, com cupom de desconto.',
    run: (n) => n.sendAbandonedCheckoutEmail(TO, 'Maria', 2, 'VOLTA10', 10, new Date(Date.now() + 3 * 86400000)),
  },
  {
    id: 'abandoned_3', group: 'Checkout', label: 'Checkout abandonado: último aviso', audience: 'user',
    when: 'Terceiro e último contato da série de recuperação.',
    run: (n) => n.sendAbandonedCheckoutEmail(TO, 'Maria', 3, 'VOLTA15', 15, new Date(Date.now() + 86400000)),
  },
  {
    id: 'admin_welcome', group: 'Enviados pelo admin', label: 'Boas-vindas manual', audience: 'user',
    when: 'Quando o admin envia o modelo "welcome" manualmente.',
    run: (n) => n.sendAdminEmail(TO, 'welcome', { name: 'Maria' }),
  },
  {
    id: 'admin_access_granted', group: 'Enviados pelo admin', label: 'Acesso liberado', audience: 'user',
    when: 'Quando o pagamento é confirmado (Stripe) ou o admin libera o acesso manualmente.',
    run: (n) => n.sendAdminEmail(TO, 'access_granted', { name: 'Maria' }),
  },
  {
    id: 'admin_accept_migration', group: 'Enviados pelo admin', label: 'Convite de migração', audience: 'user',
    when: 'Quando o admin convida alguém de outra plataforma a aceitar a migração.',
    run: (n) => n.sendAdminEmail(TO, 'accept_migration', { name: 'Maria' }),
  },
  {
    id: 'campaign', group: 'Enviados pelo admin', label: 'Campanha', audience: 'user',
    when: 'Quando o admin agenda ou dispara uma campanha em Admin > Campanhas (o conteúdo é o que ele escrever).',
    run: (n) =>
      n.sendCampaignEmail(
        TO,
        { subject: 'Novidade no Realwise', body: 'Olá, Maria!\n\nEste é um exemplo de campanha escrita no admin.', ctaLabel: 'Abrir o Realwise', ctaUrl: 'https://realwise.com.br' },
        'https://realwise.com.br/cancelar',
      ),
  },
  {
    id: 'support_reply', group: 'Suporte', label: 'Resposta do suporte', audience: 'user',
    when: 'Quando o admin responde uma mensagem em Admin > Suporte.',
    run: (n) =>
      n.sendSupportReply(TO, { name: 'Maria', subject: 'Dúvida sobre parcelas', reply: 'Oi, Maria! Já ajustamos as parcelas da sua conta.', original: 'Minha parcela 1/12 não aparece nos próximos meses.' }),
  },
  {
    id: 'support_message', group: 'Suporte', label: 'Nova mensagem de suporte', audience: 'team',
    when: 'Quando alguém escreve pelo app ou pela tela de login. Vai para a caixa do suporte.',
    run: (n) =>
      n.sendSupportMessageEmail({ to: n.supportEmail, fromName: 'Maria', fromEmail: TO, subject: 'Dúvida sobre parcelas', message: 'Minha parcela 1/12 não aparece nos próximos meses.', source: 'app', userId: '00000000-0000-0000-0000-000000000000' }),
  },
  {
    id: 'cancellation_requested', group: 'Alertas para a equipe', label: 'Cancelamento pedido', audience: 'team',
    when: 'Quando um assinante cancela (o acesso continua até o fim do período).',
    run: (n) =>
      n.sendCancellationAlertEmail({ kind: 'requested', userId: '00000000-0000-0000-0000-000000000000', email: TO, name: 'Maria', plan: 'Mensal', price: 'R$ 19,90', accessUntil: new Date(Date.now() + 12 * 86400000), stripeUrl: 'https://dashboard.stripe.com', reason: 'Muito caro', comment: 'Voltarei quando puder.' }),
  },
  {
    id: 'cancellation_ended', group: 'Alertas para a equipe', label: 'Assinatura encerrada', audience: 'team',
    when: 'Quando o período pago termina e a assinatura é encerrada.',
    run: (n) =>
      n.sendCancellationAlertEmail({ kind: 'ended', userId: '00000000-0000-0000-0000-000000000000', email: TO, name: 'Maria', plan: 'Mensal', price: 'R$ 19,90', accessUntil: new Date(), stripeUrl: 'https://dashboard.stripe.com', reason: null, comment: null }),
  },
  {
    id: 'import_issue', group: 'Alertas para a equipe', label: 'Problema na importação', audience: 'team',
    when: 'Quando um extrato não pôde ser lido e a pessoa reporta o problema.',
    run: (n) =>
      n.sendImportIssueEmail({ issueId: 'exemplo-1', clientId: 'exemplo', userId: '00000000-0000-0000-0000-000000000000', fileName: 'extrato-outubro.pdf', fileMime: 'application/pdf', bankType: 'nubank', parserUsed: 'llm', errorMessage: 'Não encontrei transações no arquivo.', userNote: 'O PDF abre normalmente.', userName: 'Maria', userEmail: TO }),
  },
];

/** Renders every e-mail the product sends with sample data, through the real templates. Nothing is delivered. */
export async function buildEmailPreviews(n: NotificationsService): Promise<EmailPreview[]> {
  const out: EmailPreview[] = [];
  for (const { run, ...meta } of ENTRIES) {
    try {
      const [mail] = await n.capture(() => run(n));
      if (mail) out.push({ ...meta, subject: mail.subject, html: mail.html });
    } catch (e) {
      console.error(`[email-previews] ${meta.id} failed`, e);
    }
  }
  return out;
}
