import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { escapeHtml, safeHttpUrl, textToParagraphs } from './email-text';
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
const BRAND_LOGO_URL = 'https://realwise.com.br/logo.png';

const HERO_BASE = 'https://realwise.com.br/email';

/** Body paragraph: big enough to read on a phone without zooming. */
const para = (text: string) => `<div style="font-size:17px;color:#475569;line-height:1.55;margin:0 0 12px;">${text}</div>`;

/** Highlights as big emoji + bold line, one per row, with no boxes around them. */
const rows = (items: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;">${items
    .map(
      ([icon, text]) =>
        `<tr><td width="46" valign="middle" style="padding:7px 0;font-size:28px;line-height:1;">${icon}</td><td valign="middle" style="padding:7px 0;font-size:18px;line-height:1.35;font-weight:700;color:#1e293b;">${text}</td></tr>`,
    )
    .join('')}</table>`;

/**
 * The one layout every e-mail uses: a single column with no card and no background of its own (so dark mode does not
 * draw a box inside the mail app's own box), a big headline, an optional full-width banner (`hero` = file name under
 * /email/hero-<name>.jpg) and a big button. Keep body copy to a line or two.
 */
function getBaseTemplate({
  title,
  subtitle,
  body,
  cta,
  ctaUrl,
  footerNote,
  support = false,
  hero,
}: {
  title: string;
  subtitle?: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  footerNote?: string;
  /** Adds the WhatsApp support button. Only for e-mails where the person may be stuck (support replies, checkout trouble): never as a way to chat with Elio. */
  support?: boolean;
  hero?: string;
}) {
  const whatsapp = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '') || '5541992310339';
  // Same width and shape for every button so the primary and the support one line up.
  const buttonBase = 'display:block;box-sizing:border-box;width:100%;max-width:360px;margin:0 auto;padding:17px 12px;text-align:center;text-decoration:none;border-radius:14px;font-size:17px;font-weight:800;';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <tr><td align="center" style="padding:0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr><td style="padding:12px 20px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td><img src="${BRAND_LOGO_URL}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:9px;object-fit:contain;" /></td>
              <td style="padding-left:10px;color:#10b981;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Realwise</td>
            </tr></table>
          </td></tr>
          ${hero ? `<tr><td><img src="${HERO_BASE}/hero-${hero}.jpg" width="600" alt="" style="display:block;width:100%;height:auto;border:0;" /></td></tr>` : ''}
          <tr><td style="padding:22px 20px 0;">
            <div style="color:#0f172a;font-size:30px;font-weight:800;line-height:1.15;letter-spacing:-0.5px;">${title}</div>
            ${subtitle ? `<div style="color:#475569;font-size:18px;line-height:1.4;margin-top:8px;">${subtitle}</div>` : ''}
          </td></tr>
          <tr><td style="padding:14px 20px 0;">${body}</td></tr>
          ${cta ? `
            <tr><td style="padding:14px 20px 6px;">
              <a href="${ctaUrl || 'https://realwise.com.br'}" style="${buttonBase}background:#059669;color:#ffffff;">${cta}</a>
            </td></tr>
          ` : ''}
          ${support ? `
            <tr><td style="padding:10px 20px 0;">
              <a href="https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Realwise.')}" style="${buttonBase}background:#ffffff;color:#16a34a;border:2px solid #25d366;">Falar com o suporte</a>
            </td></tr>
          ` : ''}
          <tr><td style="padding:26px 20px 24px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.5;">
            ${footerNote || 'Realwise'}
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

function welcomeTemplate(name: string) {
  return getBaseTemplate({
    hero: 'check',
    title: `Bem-vindo ao Realwise, ${name}!`,
    body:
      para('Sua compra foi confirmada. Estamos preparando tudo e você recebe outro e-mail quando o acesso estiver liberado.') +
      rows([
        ['🔐', 'Criando seu banco de dados'],
        ['🔑', 'Configurando seu acesso'],
      ]),
    footerNote: 'Você recebeu este e-mail porque se cadastrou no Realwise.',
  });
}

function accessGrantedTemplate(name: string, loginUrl = 'https://realwise.com.br/login') {
  return getBaseTemplate({
    hero: 'check',
    title: `Tudo pronto, ${name}! 🟢`,
    subtitle: 'Seu acesso está liberado.',
    body: rows([
      ['🏦', 'Adicione seu banco ou cartão'],
      ['📥', 'Importe seus extratos'],
      ['✏️', 'Ou lance manualmente'],
    ]),
    cta: 'Acessar agora',
    ctaUrl: loginUrl,
    footerNote: 'Você recebeu este e-mail porque é cliente do Realwise.',
  });
}

function acceptMigrationTemplate(name: string, migrationUrl = 'https://realwise.com.br/login') {
  return getBaseTemplate({
    title: `Ação necessária, ${name}`,
    body: para('Aceite a migração da sua conta para manter seu acesso e seus dados sincronizados.'),
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
    const quoted = `<div style="border-left:3px solid #e5e7eb;padding:4px 12px;margin-top:8px;font-size:12px;color:#9ca3af;line-height:1.6;">${escapeHtml(ctx.original.slice(0, 1000)).replace(/\n/g, '<br />')}</div>`;
    const html = getBaseTemplate({
      title: first ? `Olá, ${escapeHtml(first)}` : 'Olá',
      body: textToParagraphs(ctx.reply) + `<div style="font-size:12px;color:#9ca3af;margin-top:18px;">Sua mensagem:</div>${quoted}`,
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
    const p = para;
    const app = (path: string) => (ctx.clientId ? `${web.replace(/\/$/, '')}/${ctx.clientId}${path}` : `${web.replace(/\/$/, '')}/login`);
    const sg = ctx.suggestion;
    const days = ctx.trialDaysRemaining;
    const daysText = `${days} ${days === 1 ? 'dia' : 'dias'}`;
    const trialLine = days > 0 ? p(`🎁 <strong>${daysText} de teste grátis</strong>, sem cartão.`) : '';
    const money = (v: string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    // One platform of the "add to your home screen" e-mail: a looping cartoon, then the same three steps as text
    // (mail apps that do not play GIFs, such as desktop Outlook, still show the first frame and the steps).
    const installBlock = (icon: string, heading: string, hint: string, gif: string, alt: string, steps: string[]) =>
      `<div style="margin:0 0 24px;">
        <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:2px;">${icon} ${heading}</div>
        <div style="font-size:14px;color:#64748b;margin-bottom:10px;">${hint}</div>
        <img src="https://realwise.com.br/email/${gif}" width="568" alt="${alt}" style="display:block;width:100%;max-width:568px;height:auto;border-radius:14px;border:0;" />
        <div style="font-size:16px;color:#334155;line-height:1.9;margin-top:10px;">${steps.map((t, i) => `<div>${['1️⃣', '2️⃣', '3️⃣'][i]} ${t}</div>`).join('')}</div>
      </div>`;
    // The personal win-back code: big letters, no box.
    const promoBox = () => {
      const pr = ctx.promo;
      if (!pr) return '';
      const months = `${pr.months} ${pr.months === 1 ? 'mês' : 'meses'}`;
      return `<div style="text-align:center;margin:4px 0 16px;">
        <div style="font-size:34px;font-weight:800;letter-spacing:4px;color:#6d28d9;">${escapeHtml(pr.code)}</div>
        <div style="font-size:15px;color:#64748b;margin-top:6px;">${pr.percent}% de desconto nos primeiros ${months} · vale ${pr.validDays} dias · uso único</div>
      </div>`;
    };

    const copy = {
      welcome: {
        subject: `${ctx.name}, que bom ter você aqui 💜`,
        hero: 'welcome',
        title: `Que bom ter você aqui, ${escapeHtml(ctx.name)}!`,
        body:
          p('Eu sou o Elio, seu assistente financeiro. É só conversar:') +
          rows([
            ['💬', 'Anoto seus gastos por conversa'],
            ['📄', 'Leio seu extrato e organizo tudo'],
            ['🔔', 'Aviso suas contas antes de vencer'],
            ['📊', 'Mostro seu resumo todo mês'],
          ]) +
          trialLine,
        cta: 'Continuar no chat',
        url: app('/chat'),
      },
      activation_day1: {
        subject: `${ctx.name}, o Elio está esperando você`,
        hero: 'activation',
        title: 'Seu primeiro passo leva 2 minutos',
        body:
          rows([
            ['1️⃣', 'Diga ao Elio o que você quer alcançar'],
            ['2️⃣', 'Cadastre sua conta ou cartão'],
            ['3️⃣', 'Conte um gasto de hoje'],
          ]) + trialLine,
        cta: 'Abrir o chat',
        url: app('/chat'),
      },
      activation_day3: {
        subject: 'Menos planilha, mais clareza sobre o seu dinheiro',
        hero: 'insights',
        title: 'O que o Realwise faz por você',
        body:
          rows([
            ['📊', 'Resumo do mês com nota de saúde financeira'],
            ['🔔', 'Lembrete de contas antes de vencer'],
            ['🔁', 'Transferência entre contas não vira gasto'],
            ['🥧', 'Orçamento em português claro'],
          ]) + trialLine,
        cta: 'Começar agora',
        url: app('/chat'),
      },
      activation_day5: {
        subject: days > 0 ? `${ctx.name}, ainda dá tempo: faltam ${daysText} do seu teste grátis` : `${ctx.name}, seu teste grátis está acabando`,
        hero: 'hourglass',
        title: 'Ainda dá tempo de ver seu mês',
        body:
          (days > 0 ? p(`Faltam <strong>${daysText}</strong> de teste, sem cartão e sem cobrança.`) : '') +
          p('Mande seu extrato mais recente e veja para onde o dinheiro foi.'),
        cta: 'Ver o meu mês',
        url: app('/chat'),
      },
      install_app: {
        subject: `${ctx.name}, deixe o Realwise a um toque do seu celular 📲`,
        title: 'Deixe o Realwise na tela do seu celular',
        body:
          p('Em 3 toques o Realwise vira um app, sem loja de aplicativos.') +
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
        hero: 'idea',
        title: 'O Elio percebeu uma coisa 👀',
        body: sg
          ? p(`Você paga <strong>${escapeHtml(sg.name)}</strong> todo mês, por volta do dia <strong>${sg.dayOfMonth}</strong> (cerca de <strong>${money(sg.amount)}</strong>).`) +
            p('Quer que eu crie um lembrete?') +
            `<div style="text-align:center;font-size:13px;margin-top:6px;"><a href="${sg.dismissUrl}" style="color:#94a3b8;">Agora não, obrigado</a></div>`
          : '',
        cta: 'Sim, criar o lembrete',
        url: sg ? app(`/chat?suggestion=${encodeURIComponent(sg.id)}`) : app('/chat'),
      },
      trial_import: {
        subject: `${ctx.name}, falta só o seu extrato`,
        hero: 'import',
        title: 'Falta só o seu extrato',
        body: p('Anexe o PDF ou CSV do banco no chat e o Elio organiza tudo em segundos.'),
        cta: 'Abrir o chat e importar',
        url: app('/chat'),
      },
      trial_ending: {
        subject: 'Seu teste grátis termina amanhã',
        hero: 'hourglass',
        title: 'Seu teste termina amanhã',
        body:
          p('Importe o extrato mais recente e veja o resumo do mês.') +
          p('Nada é cobrado sozinho. Se quiser continuar, escolha um plano; se não, seus dados ficam guardados.'),
        cta: 'Importar meu extrato',
        url: app('/chat'),
      },
      trial_expired: {
        subject: 'Seu teste acabou, mas seus dados estão guardados',
        hero: 'locked',
        title: 'Seu teste terminou',
        body: p('Seus dados continuam guardados. Escolha um plano para voltar ao Elio e cancele quando quiser.'),
        cta: 'Ver planos',
        url: `${web}/`,
      },
      monthly_import: {
        subject: `Hora de importar o extrato de ${prevMonth}`,
        hero: 'import',
        title: `Seu extrato de ${prevMonth} já saiu`,
        body: p('Anexe o PDF ou CSV no chat e o Elio categoriza tudo em segundos.'),
        cta: 'Importar agora',
        url: app('/chat'),
      },
      payment_failed: {
        subject: 'Não conseguimos renovar sua assinatura do Realwise',
        hero: 'payment',
        title: 'O pagamento não foi aprovado',
        body: p('Não conseguimos renovar sua assinatura. Atualize o cartão para continuar sem interrupção. Leva 1 minuto.'),
        cta: 'Atualizar pagamento',
        url: app('/subscription'),
      },
      payment_failed_followup: {
        subject: 'Seu acesso ao Realwise pode ser pausado em breve',
        hero: 'alarm',
        title: 'Seu acesso será pausado em breve',
        body:
          p('Ainda não recebemos o pagamento. Atualize a forma de pagamento para manter o acesso.') +
          `<div style="font-size:14px;color:#94a3b8;margin:0 0 12px;">Já resolveu? É só ignorar este e-mail.</div>`,
        cta: 'Atualizar pagamento',
        url: app('/subscription'),
      },
      winback_7: {
        subject: `${ctx.name}, seus dados continuam guardados`,
        hero: 'heart',
        title: `Sentimos sua falta, ${escapeHtml(ctx.name)}`,
        body:
          p('Seus dados continuam guardados. Volte quando quiser, de onde parou.') +
          p('Algo não funcionou? Conte para <strong>contato@realwise.com.br</strong>.'),
        cta: 'Voltar ao Realwise',
        url: app('/subscription'),
      },
      winback_30: {
        subject: `${ctx.name}, um código só seu para voltar ao Realwise`,
        hero: 'gift',
        title: ctx.promo ? `${ctx.promo.percent}% de desconto para você voltar` : 'Que tal voltar?',
        body: promoBox() + p('Digite o código na hora de assinar.'),
        cta: 'Voltar com desconto',
        url: app('/subscription'),
      },
      winback_60: {
        subject: `${ctx.name}, seu código para voltar ao Realwise expira em breve`,
        hero: 'gift',
        title: 'Último lembrete: seu código',
        body: promoBox() + p('Se não fizer sentido agora, tudo bem. Seus dados continuam guardados. 💜'),
        cta: 'Voltar ao Realwise',
        url: app('/subscription'),
      },
    }[kind];

    const billing = kind === 'payment_failed' || kind === 'payment_failed_followup';
    const html = getBaseTemplate({
      hero: 'hero' in copy ? copy.hero : undefined,
      title: copy.title,
      body: copy.body,
      cta: copy.cta,
      ctaUrl: copy.url,
      footerNote: billing
        ? 'Você recebeu este e-mail porque há uma assinatura ativa no Realwise.'
        : `Não quer mais lembretes? <a href="${unsub}" style="color:#9ca3af;">Cancelar inscrição</a>`,
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
          <div style="font-size:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${color};margin-bottom:4px;">${title}</div>
          ${bills
            .map(
              (b) => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0;"><tr>
              <td style="padding:11px 0;font-size:18px;color:#0f172a;"><strong>${escapeHtml(b.name)}</strong><br /><span style="font-size:14px;color:#64748b;">${note(b)}</span></td>
              <td style="padding:11px 0;font-size:20px;font-weight:800;color:#0f172a;text-align:right;white-space:nowrap;">${money(b.amount)}</td>
            </tr></table>`,
            )
            .join('')}
        </div>`;
    };

    const body = `
      ${para('Já pagou alguma? Toque no botão e me diga quais: eu marco para você.')}
      ${section('⚠️ Em atraso', '#e11d48', groups.overdue, (b) => `venceu em ${day(b.dueDate)}${b.daysOverdue ? ` · ${b.daysOverdue} dia${b.daysOverdue > 1 ? 's' : ''} de atraso` : ''}`)}
      ${section('📅 Vence hoje', '#d97706', groups.dueToday, () => 'vence hoje')}
      ${section('🔔 Vence em breve', '#2563eb', groups.dueSoon, (b) => `vence em ${day(b.dueDate)}`)}
      ${total > 1 ? `<div style="font-size:18px;color:#475569;margin-top:2px;">Total: <strong style="color:#0f172a;">${money(String(sum))}</strong></div>` : ''}
    `;

    const html = getBaseTemplate({
      hero: 'bills',
      title: total > 1 ? 'Suas contas pedem atenção' : 'Uma conta pede atenção',
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
          hero: 'cart',
          title: `Você deixou algo no carrinho, ${displayName}`,
          body: para('Complete o checkout e comece a organizar suas finanças hoje.'),
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
      html: getBaseTemplate({
        hero: isLastChance ? 'alarm' : 'coupon',
        title: isLastChance ? 'Última chance: seu cupom expira hoje' : `${discountPercent}% de desconto para você, ${displayName}`,
        body: `
          <div style="text-align:center;margin:4px 0 14px;">
            <div style="font-size:36px;font-weight:800;letter-spacing:4px;font-family:monospace;color:${isLastChance ? '#ef4444' : '#10b981'};">${couponCode.toUpperCase()}</div>
            <div style="font-size:15px;color:#64748b;margin-top:6px;">${isLastChance ? `Expira ${expiresStr}` : `Vale até ${expiresStr}`}</div>
          </div>
          ${para(isLastChance ? 'Depois disso o cupom expira de vez.' : 'Use este código no checkout.')}
        `,
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
