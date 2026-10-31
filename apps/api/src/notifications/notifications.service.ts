import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { escapeHtml, safeHttpUrl, textToParagraphs } from './email-text';
import { buildEmail, chat, detailRows, para, rows, sectionLabel } from './email-layout';
import type { EngagementKind } from '../app-settings/app-settings.types';

interface BillEntry {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
  actionUrl?: string;
}

interface BillGroups {
  overdue: BillEntry[];
  dueToday: BillEntry[];
  dueSoon: BillEntry[];
}

interface ImportIssueNotification {
  issueId: string;
  clientId: string;
  userId: string;
  fileName: string;
  fileMime: string;
  bankType: string;
  parserUsed: string;
  errorMessage?: string | null;
  userNote?: string | null;
  userName?: string;
  userEmail?: string;
}

type RecoveryStage = 1 | 2 | 3;

function welcomeTemplate(name: string) {
  return buildEmail({
    variant: 'centered',
    icon: 'check',
    title: `Bem-vindo, ${escapeHtml(name)}!`,
    lead: 'Sua compra foi confirmada. Você recebe outro e-mail quando o acesso estiver liberado.',
    body: rows([
      ['🔐', 'Criando seu banco de dados'],
      ['🔑', 'Configurando seu acesso'],
    ]),
    footerNote: 'Você recebeu este e-mail porque se cadastrou no Realwise.',
  });
}

function accessGrantedTemplate(name: string, loginUrl = 'https://realwise.com.br/login') {
  return buildEmail({
    variant: 'centered',
    icon: 'check',
    title: `Tudo pronto, ${escapeHtml(name)}!`,
    lead: 'Seu acesso está liberado.',
    cta: 'Acessar agora',
    ctaUrl: loginUrl,
    body: rows([
      ['🏦', 'Adicione seu banco ou cartão'],
      ['📥', 'Importe seus extratos'],
      ['✏️', 'Ou lance manualmente'],
    ]),
    footerNote: 'Você recebeu este e-mail porque é cliente do Realwise.',
  });
}

function acceptMigrationTemplate(name: string, migrationUrl = 'https://realwise.com.br/login') {
  return buildEmail({
    icon: 'alarm',
    chip: { text: 'Ação necessária', tone: 'warn' },
    title: `Aceite a migração, ${escapeHtml(name)}`,
    lead: para('Aceite a migração da sua conta para manter seu acesso e seus dados sincronizados.'),
    cta: 'Aceitar migração',
    ctaUrl: migrationUrl,
    footerNote: 'Você recebeu este e-mail porque é cliente do Realwise.',
  });
}

function buildCheckoutUrl({ email, name, couponCode }: { email?: string; name?: string; couponCode?: string } = {}) {
  const params = new URLSearchParams();
  params.set('checkout', '1');
  if (email) params.set('email', email);
  if (name) params.set('name', name);
  if (couponCode) params.set('coupon', couponCode);
  return `https://realwise.com.br/?${params.toString()}`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null;
  private readonly from = process.env.EMAIL_FROM ?? 'noreply@realwise.com.br';

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — email delivery disabled');
      this.resend = null;
      return;
    }
    this.resend = new Resend(apiKey);
  }

  private async sendMail(params: {
    to: string;
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    // Simulator users have undeliverable `.invalid` addresses: never spend a send (or log an error) on them.
    if (/\.invalid$/i.test(params.to)) return;
    if (!this.resend) return;
    const { error } = await this.resend.emails.send({
      from: params.from ?? this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.headers ? { headers: params.headers } : {}),
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
  }

  /** Address support replies are sent from (and that users answer to). */
  get supportEmail(): string {
    return process.env.SUPPORT_EMAIL ?? 'suporte@realwise.com.br';
  }

  /** Reply from the admin inbox to a support message; goes out from SUPPORT_EMAIL. Throws when delivery fails. */
  async sendSupportReply(to: string, ctx: { name?: string | null; subject?: string | null; reply: string; original: string }): Promise<void> {
    const first = (ctx.name ?? '').trim().split(' ')[0];
    const quoted = `<div class="rw-muted" style="padding:2px 0;font-size:14px;line-height:21px;color:#566072;">${escapeHtml(ctx.original.slice(0, 1000)).replace(/\n/g, '<br />')}</div>`;
    const html = buildEmail({
      icon: 'heart',
      title: first ? `Olá, ${escapeHtml(first)}` : 'Olá',
      lead: textToParagraphs(ctx.reply),
      body: sectionLabel('Sua mensagem') + quoted,
      footerNote: 'Responda este e-mail para continuar a conversa.',
      support: true,
    });
    await this.sendMail({
      to,
      subject: ctx.subject ? `Re: ${ctx.subject}` : 'Re: sua mensagem para o Realwise',
      html,
      from: `Realwise <${this.supportEmail}>`,
      replyTo: this.supportEmail,
    });
  }

  /** Brand-template HTML for a marketing campaign (also used by the admin preview). Everything user-provided is escaped. */
  renderCampaignEmail(c: { subject: string; body: string; ctaLabel?: string | null; ctaUrl?: string | null }, unsubscribeUrl: string): string {
    const ctaUrl = safeHttpUrl(c.ctaUrl);
    return buildEmail({
      icon: 'sparkle',
      title: escapeHtml(c.subject),
      lead: textToParagraphs(c.body),
      cta: ctaUrl && c.ctaLabel?.trim() ? escapeHtml(c.ctaLabel.trim()) : undefined,
      ctaUrl: ctaUrl ? escapeHtml(ctaUrl) : undefined,
      footerNote: `Não quer mais receber novidades? <a href="${escapeHtml(unsubscribeUrl)}">Cancelar inscrição</a>`,
    });
  }

  /** Sends a marketing campaign email with a one-click unsubscribe link and List-Unsubscribe headers. Throws on delivery failure. */
  async sendCampaignEmail(
    to: string,
    c: { subject: string; body: string; ctaLabel?: string | null; ctaUrl?: string | null },
    unsubscribeUrl: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: c.subject,
      html: this.renderCampaignEmail(c, unsubscribeUrl),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  }

  async sendEngagementEmail(
    to: string,
    kind: EngagementKind,
    ctx: {
      name: string;
      trialDaysRemaining: number;
      unsubscribeUserId: string;
      unsubscribeToken: string;
      now: Date;
      /** The user's client id; app links are `${web}/${clientId}/...`. */
      clientId?: string;
      /** For `winback_30` / `winback_60`: the personal single-use code created for this person. */
      promo?: { code: string; percent: number; months: number; validDays: number };
      /** For `bill_suggestion`: the recurring payment Elio noticed. */
      suggestion?: { id: string; name: string; amount: string; dayOfMonth: number; dismissUrl: string };
    },
  ): Promise<void> {
    const web = process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br';
    const api = process.env.API_BASE_URL ?? 'https://api.realwise.com.br';
    const unsub = `${api}/reminders/unsubscribe?u=${ctx.unsubscribeUserId}&t=${ctx.unsubscribeToken}`;
    const prevMonth = new Date(ctx.now.getFullYear(), ctx.now.getMonth() - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
    const app = (path: string) => (ctx.clientId ? `${web.replace(/\/$/, '')}/${ctx.clientId}${path}` : `${web.replace(/\/$/, '')}/login`);
    const sg = ctx.suggestion;
    const days = ctx.trialDaysRemaining;
    const daysText = `${days} ${days === 1 ? 'dia' : 'dias'}`;
    const trialChip = days > 0 ? { text: `Teste grátis: ${daysText}`, tone: 'brand' as const } : undefined;
    const money = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    // One platform of the "add to your home screen" e-mail: a looping cartoon, then the same three steps as text
    // (mail apps that do not play GIFs, such as desktop Outlook, still show the first frame and the steps).
    const installBlock = (icon: string, heading: string, hint: string, gif: string, alt: string, steps: string[]) =>
      `<div style="margin:0 0 28px;">
        <div class="rw-ink" style="font-size:20px;line-height:28px;font-weight:800;color:#0e1420;">${icon} ${heading}</div>
        <div class="rw-muted" style="font-size:14px;line-height:20px;color:#566072;margin-bottom:12px;">${hint}</div>
        <img src="https://realwise.com.br/email/${gif}" width="544" alt="${alt}" style="display:block;width:100%;max-width:544px;height:auto;border-radius:16px;border:0;" />
        <div class="rw-ink" style="font-size:16px;line-height:1.9;margin-top:12px;color:#0e1420;">${steps.map((t, i) => `<div>${['1️⃣', '2️⃣', '3️⃣'][i]} ${t}</div>`).join('')}</div>
      </div>`;
    // The personal win-back code: big letters, no box.
    const promoBox = () => {
      const pr = ctx.promo;
      if (!pr) return '';
      const months = `${pr.months} ${pr.months === 1 ? 'mês' : 'meses'}`;
      return `<div style="text-align:center;margin:18px 0 10px;">
        <div class="rw-brand" style="font-size:34px;line-height:42px;font-weight:800;letter-spacing:4px;color:#6d28d9;">${escapeHtml(pr.code)}</div>
        <div class="rw-muted" style="font-size:15px;line-height:22px;color:#566072;margin-top:6px;">${pr.percent}% de desconto nos primeiros ${months} · vale ${pr.validDays} dias · uso único</div>
      </div>`;
    };

    const copy = {
      welcome: {
        subject: `${ctx.name}, que bom ter você aqui 💜`,
        icon: 'sparkle',
        title: `Que bom ter você aqui, ${escapeHtml(ctx.name)}!`,
        lead: 'Eu sou o Elio, seu assistente financeiro. É só conversar.',
        chip: trialChip,
        body:
          chat([
            { from: 'me', html: 'Paguei R$ 54 no mercado' },
            { from: 'elio', html: '<strong>Anotado em Mercado.</strong><br />Ainda sobram <strong class="rw-pos" style="color:#047857;">R$ 4.324</strong> neste mês.' },
            { from: 'me', html: 'E se eu juntar R$ 500?' },
          ]) +
          rows([
            ['📄', 'Mande o extrato', 'PDF ou foto do seu banco.'],
            ['🏷️', 'Tudo categorizado', 'O Elio separa e aprende com você.'],
            ['🔔', 'Contas no radar', 'Aviso antes de vencer.'],
          ]),
        cta: 'Falar com o Elio',
        url: app('/chat'),
      },
      activation_day1: {
        subject: `${ctx.name}, o Elio está esperando você`,
        icon: 'activation',
        title: 'Seu primeiro passo leva 2 minutos',
        lead: 'Três toques e o Elio já sabe como te ajudar.',
        chip: trialChip,
        body: rows([
          ['1️⃣', 'Diga o que você quer alcançar'],
          ['2️⃣', 'Cadastre sua conta ou cartão'],
          ['3️⃣', 'Conte um gasto de hoje'],
        ]),
        cta: 'Abrir o chat',
        url: app('/chat'),
      },
      activation_day3: {
        subject: 'Menos planilha, mais clareza sobre o seu dinheiro',
        icon: 'insights',
        title: 'O que o Realwise faz por você',
        lead: 'Menos planilha, mais clareza.',
        chip: trialChip,
        body: rows([
          ['📊', 'Resumo do mês', 'Com nota de saúde financeira.'],
          ['🔔', 'Lembrete de contas', 'Antes de vencer.'],
          ['🔁', 'Transferência não vira gasto', 'Entre as suas contas.'],
          ['🥧', 'Orçamento em português claro'],
        ]),
        cta: 'Começar agora',
        url: app('/chat'),
      },
      activation_day5: {
        subject: days > 0 ? `${ctx.name}, ainda dá tempo: faltam ${daysText} do seu teste grátis` : `${ctx.name}, seu teste grátis está acabando`,
        icon: 'hourglass',
        title: 'Ainda dá tempo de ver seu mês',
        lead: days > 0 ? `Faltam ${daysText} de teste, sem cartão e sem cobrança. Mande seu extrato mais recente.` : 'Mande seu extrato mais recente e veja para onde o dinheiro foi.',
        cta: 'Ver o meu mês',
        url: app('/chat'),
      },
      install_app: {
        subject: `${ctx.name}, deixe o Realwise a um toque do seu celular 📲`,
        icon: '📲',
        title: 'Deixe o Realwise na tela do celular',
        lead: 'Em 3 toques ele vira um app, sem loja.',
        body:
          installBlock('📱', 'No iPhone', 'Abra no Safari', 'install-ios.gif', 'Animação: toque em Compartilhar, depois em Adicionar à Tela de Início, depois em Adicionar', [
            'Toque em <strong>Compartilhar</strong> (o quadradinho com a seta)',
            'Escolha <strong>Adicionar à Tela de Início</strong>',
            'Toque em <strong>Adicionar</strong>',
          ]) +
          installBlock('🤖', 'No Android', 'Abra no Chrome', 'install-android.gif', 'Animação: toque nos 3 pontinhos, depois em Instalar app, depois em Instalar', [
            'Toque nos <strong>3 pontinhos</strong> no canto de cima',
            'Escolha <strong>Instalar app</strong>',
            'Toque em <strong>Instalar</strong>',
          ]),
        cta: 'Abrir o Realwise',
        url: app('/chat'),
      },
      bill_suggestion: {
        subject: sg ? `${ctx.name}, quer um lembrete para ${sg.name}?` : 'Quer criar um lembrete?',
        icon: 'idea',
        variant: 'panel' as const,
        title: 'O Elio percebeu uma coisa',
        lead: sg
          ? para(`Você paga <strong>${escapeHtml(sg.name)}</strong> todo mês, por volta do dia <strong>${sg.dayOfMonth}</strong> (cerca de <strong>${money(sg.amount)}</strong>). Quer que eu crie um lembrete?`)
          : '',
        body: sg ? `<div style="text-align:center;font-size:14px;"><a class="rw-subtle" href="${sg.dismissUrl}" style="color:#6a7385;">Agora não, obrigado</a></div>` : '',
        cta: 'Sim, criar o lembrete',
        url: sg ? app(`/chat?suggestion=${encodeURIComponent(sg.id)}`) : app('/chat'),
      },
      trial_import: {
        subject: `${ctx.name}, falta só o seu extrato`,
        icon: 'import',
        title: 'Falta só o seu extrato',
        lead: 'Anexe o PDF ou CSV do banco no chat e o Elio organiza tudo em segundos.',
        cta: 'Abrir o chat e importar',
        url: app('/chat'),
      },
      trial_ending: {
        subject: 'Seu teste grátis termina amanhã',
        icon: 'hourglass',
        title: 'Seu teste termina amanhã',
        lead: 'Importe o extrato mais recente e veja o resumo do mês. Nada é cobrado sozinho: se não quiser continuar, seus dados ficam guardados.',
        chip: { text: 'Termina amanhã', tone: 'warn' as const },
        cta: 'Importar meu extrato',
        url: app('/chat'),
      },
      trial_expired: {
        subject: 'Seu teste acabou, mas seus dados estão guardados',
        icon: 'locked',
        title: 'Seu teste terminou',
        lead: 'Seus dados continuam guardados. Escolha um plano para voltar ao Elio e cancele quando quiser.',
        cta: 'Ver planos',
        url: `${web}/`,
      },
      monthly_import: {
        subject: `Hora de importar o extrato de ${prevMonth}`,
        icon: 'import',
        title: `Seu extrato de ${prevMonth} já saiu`,
        lead: 'Anexe o PDF ou CSV no chat e o Elio categoriza tudo em segundos.',
        cta: 'Importar agora',
        url: app('/chat'),
      },
      payment_failed: {
        subject: 'Não conseguimos renovar sua assinatura do Realwise',
        icon: 'payment',
        variant: 'panel' as const,
        chip: { text: 'Pagamento recusado', tone: 'bad' as const },
        title: 'O pagamento não foi aprovado',
        lead: para('Não conseguimos renovar sua assinatura. Atualize o cartão para continuar sem interrupção. Leva 1 minuto.'),
        cta: 'Atualizar pagamento',
        url: app('/subscription'),
      },
      payment_failed_followup: {
        subject: 'Seu acesso ao Realwise pode ser pausado em breve',
        icon: 'alarm',
        variant: 'panel' as const,
        chip: { text: 'Acesso em risco', tone: 'bad' as const },
        title: 'Seu acesso será pausado em breve',
        lead: para('Ainda não recebemos o pagamento. Atualize a forma de pagamento para manter o acesso.'),
        body: `<div class="rw-muted" style="font-size:14px;line-height:20px;color:#566072;text-align:center;">Já resolveu? É só ignorar este e-mail.</div>`,
        cta: 'Atualizar pagamento',
        url: app('/subscription'),
      },
      winback_7: {
        subject: `${ctx.name}, seus dados continuam guardados`,
        icon: 'heart',
        title: `Sentimos sua falta, ${escapeHtml(ctx.name)}`,
        lead: 'Seus dados continuam guardados. Volte quando quiser, de onde parou. Algo não funcionou? Conte para contato@realwise.com.br.',
        cta: 'Voltar ao Realwise',
        url: app('/subscription'),
      },
      winback_30: {
        subject: `${ctx.name}, um código só seu para voltar ao Realwise`,
        icon: 'gift',
        title: ctx.promo ? `${ctx.promo.percent}% de desconto para você voltar` : 'Que tal voltar?',
        lead: promoBox() + '<div style="text-align:center;">Digite o código na hora de assinar.</div>',
        cta: 'Voltar com desconto',
        url: app('/subscription'),
      },
      winback_60: {
        subject: `${ctx.name}, seu código para voltar ao Realwise expira em breve`,
        icon: 'gift',
        title: 'Último lembrete: seu código',
        lead: promoBox() + '<div style="text-align:center;">Se não fizer sentido agora, tudo bem. Seus dados continuam guardados.</div>',
        chip: { text: 'Expira em breve', tone: 'warn' as const },
        cta: 'Voltar ao Realwise',
        url: app('/subscription'),
      },
    }[kind] as {
      subject: string;
      icon: string;
      title: string;
      lead: string;
      body?: string;
      chip?: { text: string; tone: 'warn' | 'ok' | 'bad' | 'brand' };
      variant?: 'panel' | 'centered';
      cta: string;
      url: string;
    };

    const billing = kind === 'payment_failed' || kind === 'payment_failed_followup';
    const html = buildEmail({
      variant: copy.variant ?? 'centered',
      icon: copy.icon,
      title: copy.title,
      lead: copy.lead,
      body: copy.body,
      chip: copy.chip,
      cta: copy.cta,
      ctaUrl: copy.url,
      footerNote: billing
        ? 'Você recebeu este e-mail porque há uma assinatura ativa no Realwise.'
        : `Não quer mais lembretes? <a href="${unsub}">Cancelar inscrição</a>`,
    });
    await this.sendMail({ to, subject: copy.subject, html });
  }

  async sendBillReminderEmail(to: string, groups: BillGroups, ctaUrl?: string): Promise<void> {
    const total = groups.overdue.length + groups.dueToday.length + groups.dueSoon.length;
    if (total === 0) return;

    const money = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const day = (iso: string) => {
      const [, m, d] = iso.slice(0, 10).split('-');
      return `${d}/${m}`;
    };
    const sum = [...groups.overdue, ...groups.dueToday, ...groups.dueSoon].reduce((acc, b) => acc + Number(b.amount), 0);

    const section = (title: string, bills: BillEntry[], tone: 'neg' | 'warn' | undefined, note: (b: BillEntry) => string) => {
      if (!bills.length) return '';
      return `<div style="margin:0 0 22px;">${sectionLabel(title)}${detailRows(
        bills.map((b) => ({ label: escapeHtml(b.name), sub: note(b), value: money(b.amount), tone })),
      )}</div>`;
    };

    const body =
      section('Em atraso', groups.overdue, 'neg', (b) => `venceu em ${day(b.dueDate)}${b.daysOverdue ? ` · ${b.daysOverdue} dia${b.daysOverdue > 1 ? 's' : ''} de atraso` : ''}`) +
      section('Vence hoje', groups.dueToday, 'warn', () => 'vence hoje') +
      section('Vence em breve', groups.dueSoon, undefined, (b) => `vence em ${day(b.dueDate)}`);

    const chip = groups.overdue.length
      ? { text: 'Em atraso', tone: 'bad' as const }
      : groups.dueToday.length
        ? { text: 'Vence hoje', tone: 'warn' as const }
        : { text: 'Vence em breve', tone: 'brand' as const };

    const html = buildEmail({
      icon: 'bills',
      chip,
      title: total > 1 ? 'Suas contas pedem atenção' : 'Uma conta pede atenção',
      lead: para(
        total > 1
          ? `São <strong>${money(String(sum))}</strong> em ${total} contas. Já pagou alguma? Me diga quais e eu marco para você.`
          : `São <strong>${money(String(sum))}</strong>. Já pagou? Me diga e eu marco para você.`,
      ),
      body,
      cta: 'Resolver com o Elio',
      ctaUrl: ctaUrl ?? 'https://realwise.com.br',
      footerNote: 'Você recebe este lembrete porque tem contas cadastradas no Realwise.',
    });

    await this.sendMail({
      to,
      subject: total > 1 ? `Realwise — ${total} contas pedem atenção` : 'Realwise — uma conta pede atenção',
      html,
    });
  }

  /** Forwards a contact-form message to the support inbox; replying to the e-mail answers the sender. */
  async sendSupportMessageEmail(params: {
    to: string;
    fromName: string | null;
    fromEmail: string;
    subject: string | null;
    message: string;
    source: 'app' | 'login';
    userId: string | null;
  }): Promise<void> {
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const who = params.fromName
      ? `${escape(params.fromName)} &lt;${escape(params.fromEmail)}&gt;`
      : escape(params.fromEmail);
    const origin =
      params.source === 'app'
        ? `usuário logado${params.userId ? ` (${escape(params.userId)})` : ''}`
        : 'visitante (tela de login)';
    const subject = params.subject?.trim() || 'Nova mensagem de suporte';
    await this.sendMail({
      to: params.to,
      replyTo: params.fromEmail,
      subject: `[Suporte] ${subject.replace(/[\r\n]+/g, ' ').slice(0, 150)}`,
      html: buildEmail({
        icon: 'check',
        title: escape(subject),
        lead: `De ${who} · ${origin}`,
        body: `<div style="font-size:16px;line-height:25px;white-space:pre-wrap;">${escape(params.message)}</div>`,
        footerNote: 'Responda este e-mail para falar diretamente com o usuário.',
      }),
    });
  }

  /** The monthly / trial financial summary. `html` is built by the summary module; this only delivers it. */
  async sendSummaryEmail(to: string, mail: { subject: string; html: string; unsubscribeUrl: string }): Promise<void> {
    await this.sendMail({
      to,
      subject: mail.subject,
      html: mail.html,
      headers: { 'List-Unsubscribe': `<${mail.unsubscribeUrl}>` },
    });
  }

  /**
   * Heads-up to the team inbox when a subscriber cancels (or their subscription ends), with the context needed to reach
   * out. Replying to the e-mail answers the customer directly. Throws when delivery fails; callers must not let that
   * break the billing flow.
   */
  async sendCancellationAlertEmail(params: {
    kind: 'requested' | 'ended';
    userId: string;
    email: string;
    name: string | null;
    plan: string | null;
    price: string | null;
    accessUntil: Date | null;
    reason: string | null;
    comment: string | null;
    stripeUrl: string | null;
  }): Promise<void> {
    const e = escapeHtml;
    const web = (process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br').replace(/\/$/, '');
    const until = params.accessUntil ? params.accessUntil.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
    const details = [
      { label: 'Cliente', value: `${e(params.name ?? '—')}` },
      { label: 'Plano', value: e([params.plan, params.price].filter(Boolean).join(' · ') || '—') },
      { label: params.kind === 'requested' ? 'Acesso até' : 'Encerrada em', value: until },
      { label: 'Motivo', value: e(params.reason ?? 'não informado') },
      ...(params.comment ? [{ label: 'Comentário', value: e(params.comment) }] : []),
    ];
    const links = [
      `<a class="rw-link" href="${web}/admin/users/${encodeURIComponent(params.userId)}" style="color:#6d28d9;font-weight:700;">Abrir no admin</a>`,
      ...(params.stripeUrl ? [`<a class="rw-link" href="${e(params.stripeUrl)}" style="color:#6d28d9;font-weight:700;">Ver no Stripe</a>`] : []),
    ].join(' · ');
    await this.sendMail({
      to: this.supportEmail,
      replyTo: params.email,
      subject: `[Cancelamento] ${params.email.replace(/[\r\n]+/g, ' ')}`,
      html: buildEmail({
        icon: 'alarm',
        chip: { text: params.kind === 'requested' ? 'Cancelamento' : 'Encerrada', tone: 'warn' },
        title: params.kind === 'requested' ? 'Um cliente cancelou a assinatura' : 'Uma assinatura foi encerrada',
        lead: escapeHtml(params.email),
        body:
          details
            .map((d) => `<div style="margin:0 0 14px;">${sectionLabel(d.label)}<div style="font-size:17px;line-height:25px;font-weight:600;">${d.value}</div></div>`)
            .join('') + `<div style="font-size:15px;">${links}</div>`,
        footerNote: 'Responda este e-mail para falar direto com o cliente.',
      }),
    });
  }

  async sendAdminEmail(to: string, template: 'welcome' | 'access_granted' | 'accept_migration', fields: Record<string, unknown> = {}): Promise<void> {
    const name = typeof fields.name === 'string' && fields.name.trim() ? fields.name : 'Cliente';
    const loginUrl = typeof fields.loginUrl === 'string' && fields.loginUrl ? fields.loginUrl : 'https://realwise.com.br/login';
    const migrationUrl = typeof fields.migrationUrl === 'string' && fields.migrationUrl ? fields.migrationUrl : 'https://realwise.com.br/login';

    const templates = {
      welcome: {
        subject: 'Bem-vindo ao Realwise!',
        html: welcomeTemplate(name),
      },
      access_granted: {
        subject: 'Luz Verde! Seu acesso foi liberado 🟢',
        html: accessGrantedTemplate(name, loginUrl),
      },
      accept_migration: {
        subject: 'Ação necessária: Aceite sua migração de conta',
        html: acceptMigrationTemplate(name, migrationUrl),
      },
    } as const;

    const selected = templates[template];
    await this.sendMail({
      to,
      subject: selected.subject,
      html: selected.html,
    });
  }

  async sendAbandonedCheckoutEmail(
    to: string,
    name: string,
    stage: RecoveryStage,
    couponCode?: string,
    discountPercent?: number,
    expiresAt?: Date,
  ): Promise<void> {
    const displayName = name || to.split('@')[0];
    if (stage === 1) {
      await this.sendMail({
        to,
        subject: `${displayName}, você esqueceu algo 👀`,
        html: buildEmail({
          variant: 'centered',
          icon: 'cart',
          title: `Você deixou algo no carrinho, ${escapeHtml(displayName)}`,
          lead: 'Complete o checkout e comece a organizar suas finanças hoje.',
          cta: 'Continuar checkout',
          ctaUrl: buildCheckoutUrl({ email: to, name }),
          footerNote: 'Você recebeu este e-mail porque iniciou um cadastro no Realwise.',
          support: true,
        }),
      });
      return;
    }

    if (!couponCode || !discountPercent) return;
    const expiresStr = expiresAt
      ? expiresAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'em breve';
    const isLastChance = stage === 3;
    await this.sendMail({
      to,
      subject: isLastChance
        ? `⏰ Última chance: cupom ${couponCode.toUpperCase()} expira hoje`
        : `🎁 Seu cupom especial: ${couponCode.toUpperCase()} — ${discountPercent}% off`,
      html: buildEmail({
        variant: 'centered',
        icon: isLastChance ? 'alarm' : 'coupon',
        chip: isLastChance ? { text: 'Expira hoje', tone: 'bad' } : undefined,
        title: isLastChance ? 'Última chance: seu cupom expira hoje' : `${discountPercent}% de desconto para você, ${escapeHtml(displayName)}`,
        lead: `<div style="text-align:center;margin:0 0 6px;">
            <div class="${isLastChance ? 'rw-neg' : 'rw-brand'}" style="font-size:36px;line-height:44px;font-weight:800;letter-spacing:4px;font-family:'Courier New',monospace;color:${isLastChance ? '#be123c' : '#6d28d9'};">${couponCode.toUpperCase()}</div>
            <div style="font-size:15px;line-height:22px;margin-top:6px;">${isLastChance ? `Expira ${expiresStr}` : `Vale até ${expiresStr}`}</div>
          </div>`,
        cta: isLastChance ? 'Finalizar agora' : 'Usar cupom e finalizar',
        ctaUrl: buildCheckoutUrl({ email: to, name, couponCode }),
        footerNote: 'Você recebeu este e-mail porque iniciou um cadastro no Realwise.',
        support: true,
      }),
    });
  }

  async sendImportIssueEmail(issue: ImportIssueNotification): Promise<void> {
    const recipient = process.env.IMPORT_ISSUES_EMAIL_TO || process.env.MAIL_FROM;
    if (!recipient) return;

    const details = [
      ['Issue ID', issue.issueId],
      ['Client ID', issue.clientId],
      ['User ID', issue.userId],
      ['Arquivo', issue.fileName],
      ['MIME', issue.fileMime],
      ['Banco', issue.bankType],
      ['Parser', issue.parserUsed],
      ['Nome', issue.userName || '-'],
      ['Email', issue.userEmail || '-'],
      ['Erro', issue.errorMessage || '-'],
      ['Observacao', issue.userNote || '-'],
    ];

    const body = details
      .map(([label, value]) => `<div style="margin:0 0 12px;">${sectionLabel(label)}<div style="font-size:16px;line-height:24px;word-break:break-word;">${escapeHtml(String(value))}</div></div>`)
      .join('');

    await this.sendMail({
      to: recipient,
      subject: `Realwise import issue: ${issue.fileName}`,
      html: buildEmail({
        icon: 'import',
        chip: { text: 'Importação', tone: 'warn' },
        title: 'Novo report de importação',
        lead: 'Um usuário reportou um problema ao importar um arquivo.',
        body,
        footerNote: 'Notificacao automatica do fluxo de importacao do Realwise.',
      }),
    });
  }
}
