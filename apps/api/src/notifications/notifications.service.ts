import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

interface BillEntry {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
}

interface BillGroups {
  overdue: BillEntry[];
  dueToday: BillEntry[];
  dueSoon: BillEntry[];
}

type RecoveryStage = 1 | 2 | 3;

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
            <div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Realwise</div>
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
  constructor(private readonly mailer: MailerService) {}

  async sendBillReminderEmail(to: string, groups: BillGroups): Promise<void> {
    const total = groups.overdue.length + groups.dueToday.length + groups.dueSoon.length;
    if (total === 0) return;

    const formatAmount = (v: string) =>
      `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const formatDate = (iso: string) => {
      const [y, m, d] = iso.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    };

    const section = (title: string, bills: BillEntry[]) => {
      if (!bills.length) return '';
      return `<h3>${title}</h3><ul>${bills
        .map(
          (b) =>
            `<li><strong>${b.name}</strong> — ${formatAmount(b.amount)}, vence ${formatDate(b.dueDate)}${b.daysOverdue ? ` (${b.daysOverdue} dias em atraso)` : ''}</li>`,
        )
        .join('')}</ul>`;
    };

    const html = `
      <p>Olá! Aqui estão suas contas pendentes:</p>
      ${section('⚠️ Em atraso', groups.overdue)}
      ${section('📅 Vence hoje', groups.dueToday)}
      ${section('🔔 Vence em breve (1–3 dias)', groups.dueSoon)}
      <p style="font-size:12px;color:#888">Realwise — gestão financeira pessoal</p>
    `;

    await this.mailer.sendMail({
      to,
      subject: `Realwise — lembrete de conta${total > 1 ? 's' : ''}`,
      html,
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
    await this.mailer.sendMail({
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
      await this.mailer.sendMail({
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
    await this.mailer.sendMail({
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
}
