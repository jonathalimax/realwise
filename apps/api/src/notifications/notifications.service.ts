import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { escapeHtml, safeHttpUrl, textToParagraphs } from './email-text';

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
const BRAND_LOGO_URL = 'https://realwise.com.br/logo.png';

function getBaseTemplate({
  title,
  subtitle,
  body,
  cta,
  ctaUrl,
  footerNote,
}: {
  title: string;
  subtitle?: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  footerNote?: string;
}) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f1f5f9;">
      <tr><td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;padding:24px;">
          <tr><td style="padding:0 4px 16px;">
            <img src="${BRAND_LOGO_URL}" alt="Realwise" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:12px;object-fit:contain;" />
            <div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:10px;">Realwise</div>
          </td></tr>
          <tr><td style="padding:0 4px 8px;">
            <div style="color:#1e293b;font-size:22px;font-weight:700;line-height:1.3;">${title}</div>
            ${subtitle ? `<div style="color:#6b7280;font-size:13px;margin-top:6px;">${subtitle}</div>` : ''}
          </td></tr>
          <tr><td style="padding:16px 4px 0;">${body}</td></tr>
          ${cta ? `
            <tr><td style="padding:24px 4px 8px;text-align:center;">
              <a href="${ctaUrl || 'https://realwise.com.br'}" style="display:inline-block;padding:13px 36px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">${cta}</a>
            </td></tr>
          ` : ''}
          <tr><td style="padding:8px 4px 0;text-align:center;">
            <a href="https://wa.me/5541992310339" style="display:inline-block;padding:11px 28px;background:#ffffff;color:#25d366;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;border:2px solid #25d366;">Falar com a gente no WhatsApp</a>
          </td></tr>
          <tr><td style="padding:24px 4px 8px;text-align:center;font-size:11px;color:#9ca3af;">
            © 2026 Realwise · ${footerNote || 'Todos os direitos reservados.'}
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

function welcomeTemplate(name: string) {
  return getBaseTemplate({
    title: `Bem-vindo ao Realwise, ${name}! 🎉`,
    subtitle: 'Sua compra foi confirmada. Veja o que acontece a seguir.',
    body: `
      <div style="font-size:14px;color:#4b5563;line-height:1.8;margin-bottom:20px;">
        Estamos configurando seu ambiente. Você receberá um novo e-mail assim que tudo estiver pronto e seu acesso liberado.
      </div>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:8px;">O que está acontecendo agora?</div>
        <div style="font-size:13px;color:#374151;line-height:1.8;">
          <div style="margin-bottom:8px;">🔐 <strong>Criando seu banco de dados exclusivo</strong></div>
          <div>🔑 <strong>Configurando seu acesso</strong></div>
        </div>
      </div>
    `,
    footerNote: 'Você está recebendo este e-mail porque se cadastrou no Realwise.',
  });
}

function accessGrantedTemplate(name: string, loginUrl = 'https://realwise.com.br/login') {
  return getBaseTemplate({
    title: `Tudo pronto, ${name}! 🟢`,
    subtitle: 'Seu acesso está liberado. Veja por onde começar.',
    body: `
      <div style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:8px;">Por onde começar?</div>
        <div style="font-size:13px;color:#374151;line-height:1.8;">
          <div style="margin-bottom:8px;">🏦 <strong>Adicione seu banco ou cartão</strong></div>
          <div style="margin-bottom:8px;">📥 <strong>Importe seus extratos</strong></div>
          <div>✏️ <strong>Ou lance manualmente</strong></div>
        </div>
      </div>
      <div style="font-size:13px;color:#4b5563;">Qualquer dúvida, basta responder a este e-mail.</div>
    `,
    cta: 'Acessar o Sistema Agora',
    ctaUrl: loginUrl,
    footerNote: 'Você está recebendo este e-mail porque é um cliente Realwise.',
  });
}

function acceptMigrationTemplate(name: string, migrationUrl = 'https://realwise.com.br/login') {
  return getBaseTemplate({
    title: `Ação necessária, ${name}`,
    subtitle: 'Aceite sua migração de conta para continuar.',
    body: `
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:8px;">Migração pendente</div>
        <div style="font-size:13px;color:#374151;line-height:1.8;">
          <div>Revise e confirme a migração para manter seu acesso e seus dados sincronizados.</div>
        </div>
      </div>
      <div style="font-size:13px;color:#4b5563;">Se tiver dúvidas, responda este e-mail.</div>
    `,
    cta: 'Aceitar Migração',
    ctaUrl: migrationUrl,
    footerNote: 'Você está recebendo este e-mail porque é um cliente Realwise.',
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
    const quoted = `<div style="border-left:3px solid #e5e7eb;padding:4px 12px;margin-top:8px;font-size:12px;color:#9ca3af;line-height:1.6;">${escapeHtml(ctx.original.slice(0, 1000)).replace(/\n/g, '<br />')}</div>`;
    const html = getBaseTemplate({
      title: first ? `Olá, ${escapeHtml(first)}` : 'Olá',
      body: textToParagraphs(ctx.reply) + `<div style="font-size:12px;color:#9ca3af;margin-top:18px;">Sua mensagem:</div>${quoted}`,
      footerNote: 'Responda este e-mail para continuar a conversa.',
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
    return getBaseTemplate({
      title: escapeHtml(c.subject),
      body: textToParagraphs(c.body),
      cta: ctaUrl && c.ctaLabel?.trim() ? escapeHtml(c.ctaLabel.trim()) : undefined,
      ctaUrl: ctaUrl ? escapeHtml(ctaUrl) : undefined,
      footerNote: `Não quer mais receber novidades? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;">Cancelar inscrição</a>`,
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
    kind: 'trial_import' | 'trial_ending' | 'trial_expired' | 'monthly_import' | 'bill_suggestion',
    ctx: {
      name: string;
      trialDaysRemaining: number;
      unsubscribeUserId: string;
      unsubscribeToken: string;
      now: Date;
      /** The user's client id; app links are `${web}/${clientId}/...`. */
      clientId?: string;
      /** For `bill_suggestion`: the recurring payment Elio noticed. */
      suggestion?: { id: string; name: string; amount: string; dayOfMonth: number; dismissUrl: string };
    },
  ): Promise<void> {
    const web = process.env.FRONTEND_BASE_URL ?? 'https://realwise.com.br';
    const api = process.env.API_BASE_URL ?? 'https://api.realwise.com.br';
    const unsub = `${api}/reminders/unsubscribe?u=${ctx.unsubscribeUserId}&t=${ctx.unsubscribeToken}`;
    const prevMonth = new Date(ctx.now.getFullYear(), ctx.now.getMonth() - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
    const p = (t: string) => `<div style="font-size:14px;color:#4b5563;line-height:1.8;margin-bottom:14px;">${t}</div>`;
    const app = (path: string) => (ctx.clientId ? `${web.replace(/\/$/, '')}/${ctx.clientId}${path}` : `${web.replace(/\/$/, '')}/login`);
    const sg = ctx.suggestion;
    const money = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const copy = {
      bill_suggestion: {
        subject: sg ? `${ctx.name}, quer um lembrete para ${sg.name}?` : 'Quer criar um lembrete?',
        title: 'O Elio percebeu uma coisa 👀',
        body: sg
          ? p(`Notei que você paga <strong>${escapeHtml(sg.name)}</strong> todo mês, por volta do dia <strong>${sg.dayOfMonth}</strong> (cerca de <strong>${money(sg.amount)}</strong>).`) +
            p('Quer que eu crie um lembrete para você não esquecer? É só tocar no botão e eu cuido do resto.') +
            `<div style="text-align:center;font-size:12px;margin-top:6px;"><a href="${sg.dismissUrl}" style="color:#9ca3af;">Agora não, obrigado</a></div>`
          : '',
        cta: 'Sim, criar o lembrete',
        url: sg ? app(`/chat?suggestion=${encodeURIComponent(sg.id)}`) : app('/chat'),
      },
      trial_import: {
        subject: `${ctx.name}, falta só o seu extrato`,
        title: `Falta só um passo, ${escapeHtml(ctx.name)} 👋`,
        body: p('Você ainda não mandou nenhum extrato. É rápido: abra o chat, anexe o PDF ou CSV do seu banco e o Elio organiza tudo em segundos.') + p('Seu teste é grátis, sem cartão e sem cobrança.'),
        cta: 'Abrir o chat e importar',
        url: app('/chat'),
      },
      trial_ending: {
        subject: 'Seu teste grátis termina amanhã',
        title: 'Seu teste termina amanhã',
        body: p('Aproveite as últimas horas: importe o extrato mais recente e veja o resumo do mês.') + p('Nada será cobrado automaticamente. Se quiser continuar depois, é só escolher um plano; se não, seus dados ficam guardados.'),
        cta: 'Importar meu extrato',
        url: app('/chat'),
      },
      trial_expired: {
        subject: 'Seu teste acabou, mas seus dados estão guardados',
        title: 'Seu teste terminou',
        body: p('Seus dados continuam guardados. Para voltar a usar o Elio, escolha um plano a partir de R$ 8,99 por mês. Cancele quando quiser.'),
        cta: 'Ver planos',
        url: `${web}/`,
      },
      monthly_import: {
        subject: `Hora de importar o extrato de ${prevMonth}`,
        title: `Seu extrato de ${prevMonth} já saiu`,
        body: p('Leva menos de um minuto: anexe o PDF ou CSV no chat e o Elio categoriza tudo, detecta transferências entre suas contas e atualiza seu resumo.'),
        cta: 'Importar agora',
        url: app('/chat'),
      },
    }[kind];

    const html = getBaseTemplate({
      title: copy.title,
      body: copy.body,
      cta: copy.cta,
      ctaUrl: copy.url,
      footerNote: `Não quer mais lembretes? <a href="${unsub}" style="color:#9ca3af;">Cancelar inscrição</a>`,
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

    const section = (title: string, color: string, bills: BillEntry[], note: (b: BillEntry) => string) => {
      if (!bills.length) return '';
      return `
        <div style="margin:0 0 18px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${color};margin-bottom:6px;">${title}</div>
          ${bills
            .map(
              (b) => `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #f1f5f9;"><tr>
              <td style="padding:9px 0;font-size:14px;color:#1e293b;"><strong>${escapeHtml(b.name)}</strong><br /><span style="font-size:12px;color:#94a3b8;">${note(b)}</span></td>
              <td style="padding:9px 0;font-size:14px;font-weight:700;color:#1e293b;text-align:right;white-space:nowrap;">${money(b.amount)}</td>
            </tr></table>`,
            )
            .join('')}
        </div>`;
    };

    const body = `
      <div style="font-size:14px;color:#4b5563;line-height:1.8;margin-bottom:16px;">
        Separei as contas que precisam da sua atenção. Já pagou alguma? Toque no botão abaixo e me conte quais (e os valores, se mudaram): eu marco tudo para você.
      </div>
      ${section('⚠️ Em atraso', '#e11d48', groups.overdue, (b) => `venceu em ${day(b.dueDate)}${b.daysOverdue ? ` · ${b.daysOverdue} dia${b.daysOverdue > 1 ? 's' : ''} de atraso` : ''}`)}
      ${section('📅 Vence hoje', '#d97706', groups.dueToday, () => 'vence hoje')}
      ${section('🔔 Vence em breve', '#2563eb', groups.dueSoon, (b) => `vence em ${day(b.dueDate)}`)}
      <div style="font-size:13px;color:#64748b;margin-top:4px;">${total} conta${total > 1 ? 's' : ''} · total de <strong>${money(String(sum))}</strong></div>
    `;

    const html = getBaseTemplate({
      title: total > 1 ? 'Suas contas pedem atenção' : 'Uma conta pede atenção',
      subtitle: 'Resolva tudo em um minuto, direto no chat com o Elio.',
      body,
      cta: 'Resolver minhas contas com o Elio',
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
      html: getBaseTemplate({
        title: escape(subject),
        subtitle: `De ${who} · ${origin}`,
        body: `<div style="font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${escape(params.message)}</div>`,
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
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${value}</td></tr>`;
    const rows = [
      row('Cliente', `${e(params.name ?? '—')} &lt;${e(params.email)}&gt;`),
      row('Plano', e([params.plan, params.price].filter(Boolean).join(' · ') || '—'),),
      row(params.kind === 'requested' ? 'Acesso até' : 'Encerrada em', until),
      row('Motivo', e(params.reason ?? 'não informado')),
      ...(params.comment ? [row('Comentário', e(params.comment))] : []),
    ].join('');
    const links = [
      `<a href="${web}/admin/users/${encodeURIComponent(params.userId)}" style="color:#7c3aed;">Abrir no admin</a>`,
      ...(params.stripeUrl ? [`<a href="${e(params.stripeUrl)}" style="color:#7c3aed;">Ver no Stripe</a>`] : []),
    ].join(' · ');
    await this.sendMail({
      to: this.supportEmail,
      replyTo: params.email,
      subject: `[Cancelamento] ${params.email.replace(/[\r\n]+/g, ' ')}`,
      html: getBaseTemplate({
        title: params.kind === 'requested' ? 'Um cliente cancelou a assinatura' : 'Uma assinatura foi encerrada',
        subtitle: params.email,
        body: `<table role="presentation" style="border-collapse:collapse;">${rows}</table><p style="margin-top:16px;font-size:14px;">${links}</p>`,
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
        html: getBaseTemplate({
          title: `Você deixou algo no carrinho, ${displayName}!`,
          subtitle: 'Ainda dá tempo de garantir seu acesso ao Realwise.',
          body: `
            <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
              <div style="font-size:13px;color:#713f12;line-height:1.7;">
                Sua sessão ainda está ativa. Complete o checkout agora e comece a organizar suas finanças hoje mesmo.
              </div>
            </div>
            <div style="font-size:13px;color:#4b5563;line-height:1.7;">
              Clique no botão abaixo para continuar de onde parou.
            </div>
          `,
          cta: 'Continuar Checkout',
          ctaUrl: buildCheckoutUrl({ email: to, name }),
          footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
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
      html: getBaseTemplate({
        title: isLastChance
          ? `Última chance: cupom expira às ${expiresStr} ⏰`
          : `Seu cupom especial chegou, ${displayName}! 🎁`,
        subtitle: isLastChance
          ? 'Não perca seu desconto exclusivo. Esta é a última vez que vamos lembrar.'
          : `${discountPercent}% de desconto exclusivo para você. Válido por 24 horas.`,
        body: `
          <div style="text-align:center;margin:20px 0;">
            <div style="display:inline-block;border:2px dashed ${isLastChance ? '#ef4444' : '#10b981'};border-radius:8px;padding:16px 32px;${isLastChance ? 'background:#fef2f2;' : 'background:#ecfdf5;'}">
              <div style="font-size:11px;font-weight:700;${isLastChance ? 'color:#991b1b;' : 'color:#065f46;'}letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Seu Cupom</div>
              <div style="font-size:28px;font-weight:800;${isLastChance ? 'color:#ef4444;' : 'color:#10b981;'}letter-spacing:4px;font-family:monospace;">${couponCode.toUpperCase()}</div>
              <div style="font-size:11px;color:#6b7280;margin-top:6px;">${isLastChance ? `⚠️ Expira ${expiresStr}` : `Expira em ${expiresStr}`}</div>
            </div>
          </div>
          <div style="font-size:13px;color:#4b5563;line-height:1.7;text-align:center;">
            ${isLastChance
              ? 'Este é o último aviso. Após o vencimento, o cupom expira definitivamente.'
              : `Use este código no checkout e ganhe <strong>${discountPercent}% de desconto</strong>.`}
          </div>
        `,
        cta: isLastChance ? 'Finalizar Compra Agora' : 'Usar Cupom e Finalizar',
        ctaUrl: buildCheckoutUrl({ email: to, name, couponCode }),
        footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
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

    const body = `
      <div style="font-size:14px;color:#4b5563;line-height:1.8;margin-bottom:20px;">
        Um usuario reportou um problema na importacao de arquivo.
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${details
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:700;color:#1f2937;width:140px;">${label}</td>
                <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#4b5563;">${String(value)}</td>
              </tr>
            `,
          )
          .join('')}
      </table>
    `;

    await this.sendMail({
      to: recipient,
      subject: `Realwise import issue: ${issue.fileName}`,
      html: getBaseTemplate({
        title: 'Novo report de importacao',
        subtitle: 'Detalhes do problema reportado pelo usuario.',
        body,
        footerNote: 'Notificacao automatica do fluxo de importacao do Realwise.',
      }),
    });
  }
}
