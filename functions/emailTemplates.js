
/**
 * Build a deep-link checkout URL that pre-fills email/name/coupon
 * and opens the MP modal flow on the landing page.
 *
 * @param {object} opts
 * @param {string} [opts.email]
 * @param {string} [opts.name]
 * @param {string} [opts.couponCode]
 * @returns {string}
 */
function buildCheckoutUrl({ email, name, whatsapp, couponCode } = {}) {
  const base = 'https://realwise.com.br';
  const params = new URLSearchParams();
  params.set('checkout', '1');
  if (email) params.set('email', email);
  if (name) params.set('name', name);
  if (whatsapp) params.set('whatsapp', whatsapp);
  if (couponCode) params.set('coupon', couponCode);
  return `${base}/?${params.toString()}`;
}
exports.buildCheckoutUrl = buildCheckoutUrl;

const SHARED_STYLES = `
  <style>
    .mw-outer { background-color: #f1f5f9 !important; }
    .mw-card  { background-color: #ffffff !important; }
    @media (prefers-color-scheme: dark) {
      .mw-outer      { background-color: #0f172a !important; }
      .mw-card       { background-color: #1e293b !important; }
      .mw-title      { color: #f1f5f9 !important; }
      .mw-body-text  { color: #cbd5e1 !important; }
      .mw-sub        { color: #94a3b8 !important; }
      .mw-footer     { color: #475569 !important; }
      .mw-info-box   { background-color: #0f2d20 !important; border-left-color: #10b981 !important; }
      .mw-info-text  { color: #cbd5e1 !important; }
      .mw-warn-box   { background-color: #1e2a1a !important; border-left-color: #eab308 !important; }
      .mw-warn-text  { color: #fef08a !important; }
      .bill-name     { color: #f1f5f9 !important; }
      .bill-sub      { color: #94a3b8 !important; }
      .bill-row td   { border-bottom-color: #334155 !important; }
      .chip-overdue  { background:#450a0a !important; color:#fca5a5 !important; }
      .chip-today    { background:#422006 !important; color:#fdba74 !important; }
      .chip-upcoming { background:#1e3a5f !important; color:#93c5fd !important; }
      .amount-overdue { color:#fca5a5 !important; }
      .total-label   { color: #94a3b8 !important; }
      .total-amount  { color: #10b981 !important; }
    }
  </style>
`;

const getBaseTemplate = ({ title, subtitle, body, cta, ctaUrl, footerNote }) => `
  ${SHARED_STYLES}
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" class="mw-outer" style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f1f5f9;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" class="mw-card" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;padding:24px;">

        <!-- Brand -->
        <tr><td style="padding:0 4px 16px;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;padding-right:10px;"><img src="https://realwise.com.br/logo.jpg" alt="Realwise" width="32" height="32" style="display:block;border-radius:8px;" /></td>
            <td style="vertical-align:middle;"><div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Realwise</div></td>
          </tr></table>
        </td></tr>

        <!-- Title -->
        <tr><td style="padding:0 4px 8px;">
          <div class="mw-title" style="color:#1e293b;font-size:22px;font-weight:700;line-height:1.3;">${title}</div>
          ${subtitle ? `<div class="mw-sub" style="color:#6b7280;font-size:13px;margin-top:6px;">${subtitle}</div>` : ''}
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:16px 4px 0;">
          ${body}
        </td></tr>

        ${cta ? `
        <!-- CTA -->
        <tr><td style="padding:24px 4px 8px;text-align:center;">
          <a href="${ctaUrl || 'https://realwise.com.br'}" style="display:inline-block;padding:13px 36px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">${cta}</a>
        </td></tr>
        ` : ''}

        <!-- WhatsApp CTA -->
        <tr><td style="padding:8px 4px 0;text-align:center;">
          <a href="https://wa.me/5541992310339" style="display:inline-block;padding:11px 28px;background:#ffffff;color:#25d366;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;border:2px solid #25d366;">
            💬 Falar com a gente no WhatsApp
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td class="mw-footer" style="padding:24px 4px 8px;text-align:center;font-size:11px;color:#9ca3af;">
          © 2026 Realwise · ${footerNote || 'Todos os direitos reservados.'}
        </td></tr>

      </table>
    </td></tr>
  </table>
`;

/**
 * Template 1: Welcome & Next Steps (sent on purchase — access not ready yet)
 */
exports.welcomeTemplate = (name) => getBaseTemplate({
  title: `Bem-vindo ao Realwise, ${name}! 🎉`,
  subtitle: 'Sua compra foi confirmada. Veja o que acontece a seguir.',
  body: `
    <div class="mw-body-text" style="font-size:14px;color:#4b5563;line-height:1.8;margin-bottom:20px;">
      Estamos configurando seu ambiente — isso pode levar algumas horas. Você receberá um novo e-mail assim que tudo estiver pronto e seu acesso liberado.
    </div>
    <div class="mw-info-box" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:8px;">O que está acontecendo agora?</div>
      <div style="font-size:13px;color:#374151;line-height:1.8;">
        <div style="margin-bottom:8px;">🔐 <strong>Criando seu banco de dados exclusivo</strong> — seus dados financeiros serão armazenados em uma infraestrutura isolada, criada única e exclusivamente para você.</div>
        <div>🔑 <strong>Configurando seu acesso</strong> — estamos preparando as credenciais de segurança para que apenas você consiga entrar.</div>
      </div>
    </div>
    <div class="mw-info-box" style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:8px;">📧 Fique atento: você receberá um e-mail do Google</div>
      <div style="font-size:13px;color:#374151;line-height:1.8;">
        <div style="margin-bottom:8px;">Para garantir que <strong>você é o único proprietário dos seus dados</strong>, enviamos um convite para que você assuma o controle total do seu banco de dados — sem que a equipe Realwise tenha acesso.</div>
        <div style="margin-bottom:8px;">O e-mail virá de <strong>cloudplatform-noreply@google.com</strong> com o assunto <em>"You've been invited to a Google Cloud project"</em>. Clique em <strong>"Accept Invitation"</strong> para confirmar a propriedade.</div>
        <div style="color:#6b7280;font-size:12px;">Verifique a caixa de spam se não receber em até 24 horas. Qualquer dúvida, basta responder a este e-mail.</div>
      </div>
    </div>
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;">
      Obrigado por confiar no Realwise. Vamos juntos nessa! 🚀<br><br>
      <strong>Equipe Realwise</strong>
    </div>
  `,
  footerNote: 'Você está recebendo este e-mail porque se cadastrou no Realwise.',
});

/**
 * Template 2: Access Granted (green light — access is live, tell them how to start)
 */
exports.accessGrantedTemplate = (name, loginUrl = 'https://realwise.com.br/login') => getBaseTemplate({
  title: `Tudo pronto, ${name}! 🟢`,
  subtitle: 'Seu acesso está liberado. Veja por onde começar.',
  body: `
    <div class="mw-info-box" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:8px;">Por onde começar?</div>
      <div style="font-size:13px;color:#374151;line-height:1.8;">
        <div style="margin-bottom:8px;">🏦 <strong>Adicione seu banco ou cartão</strong> — vá em "Bancos e Cartões" e cadastre suas contas. Isso é o primeiro passo para tudo funcionar.</div>
        <div style="margin-bottom:8px;">📥 <strong>Importe seus extratos</strong> — na aba "Importar", envie seu extrato em CSV, OFX ou PDF e suas transações aparecem automaticamente.</div>
        <div>✏️ <strong>Ou lance manualmente</strong> — prefere digitar? Sem problema, você pode registrar cada transação na hora que quiser.</div>
      </div>
    </div>
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;">Qualquer dúvida, basta responder a este e-mail.<br><br><strong>Equipe Realwise</strong></div>
  `,
  cta: 'Acessar o Sistema Agora',
  ctaUrl: loginUrl,
  footerNote: 'Você está recebendo este e-mail porque é um cliente Realwise.',
});

/**
 * Template 3: Abandoned Checkout — 4h reminder
 */
exports.checkoutReminderTemplate = (name, cartUrl = 'https://realwise.com.br') => getBaseTemplate({
  title: `Você deixou algo no carrinho, ${name}!`,
  subtitle: 'Ainda dá tempo de garantir seu acesso ao Realwise.',
  body: `
    <div class="mw-warn-box" style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div class="mw-warn-text" style="font-size:13px;color:#713f12;line-height:1.7;">
        ⏰ <strong>Sua sessão ainda está ativa.</strong> Complete o checkout agora e comece a organizar suas finanças hoje mesmo.
      </div>
    </div>
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;">
      Com o Realwise você centraliza contas, cartões, investimentos e metas em um só lugar.<br><br>
      Clique no botão abaixo para continuar de onde parou.
    </div>
  `,
  cta: 'Continuar Checkout',
  ctaUrl: cartUrl,
  footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
});

/**
 * Template 4: Abandoned Checkout — 24h coupon offer
 */
exports.checkoutCouponTemplate = (name, couponCode, discountPercent = 10, expiresAt, cartUrl = 'https://realwise.com.br') => {
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '24 horas';
  return getBaseTemplate({
    title: `Seu cupom especial chegou, ${name}! 🎁`,
    subtitle: `${discountPercent}% de desconto exclusivo para você. Válido por 24 horas.`,
    body: `
      <div style="text-align:center;margin:20px 0;">
        <div style="display:inline-block;border:2px dashed #10b981;border-radius:8px;padding:16px 32px;background:#ecfdf5;">
          <div style="font-size:11px;font-weight:700;color:#065f46;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Seu Cupom</div>
          <div style="font-size:28px;font-weight:800;color:#10b981;letter-spacing:4px;font-family:monospace;">${couponCode.toUpperCase()}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px;">Expira em ${expiresStr}</div>
        </div>
      </div>
      <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;text-align:center;">
        Use este código no checkout e ganhe <strong>${discountPercent}% de desconto</strong>.<br>
        Este cupom é exclusivo para o e-mail com que você se cadastrou.
      </div>
    `,
    cta: 'Usar Cupom e Finalizar',
    ctaUrl: cartUrl,
    footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
  });
};

/**
 * Template 5: Abandoned Checkout — 48h last chance
 */
exports.checkoutLastChanceTemplate = (name, couponCode, expiresAt, cartUrl = 'https://realwise.com.br') => {
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'em breve';
  return getBaseTemplate({
    title: `Última chance: cupom expira às ${expiresStr} ⏰`,
    subtitle: 'Não perca seu desconto exclusivo. Esta é a última vez que vamos lembrar.',
    body: `
      <div style="text-align:center;margin:20px 0;">
        <div style="display:inline-block;border:2px dashed #ef4444;border-radius:8px;padding:16px 32px;background:#fef2f2;">
          <div style="font-size:11px;font-weight:700;color:#991b1b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Seu Cupom</div>
          <div style="font-size:28px;font-weight:800;color:#ef4444;letter-spacing:4px;font-family:monospace;">${couponCode.toUpperCase()}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:6px;">⚠️ Expira ${expiresStr}</div>
        </div>
      </div>
      <div class="mw-body-text" style="font-size:13px;color:#4b5563;line-height:1.7;text-align:center;">
        Este é o último aviso. Após o vencimento, o cupom expira definitivamente.<br>
        O Realwise continua disponível — só não a este preço.
      </div>
    `,
    cta: 'Finalizar Compra Agora',
    ctaUrl: cartUrl,
    footerNote: 'Você está recebendo este e-mail porque iniciou um cadastro no Realwise.',
  });
};

/**
 * Template 6: Bill Reminders — adaptive dark/light, supports dueSoon group
 */
exports.billReminderTemplate = (name, { overdue, dueToday, dueSoon, upcoming }, ctaUrl = 'https://realwise.com.br') => {
  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '—';
    return `R$ ${num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' });
    } catch (e) { return '—'; }
  };

  const billAmt = (b) => { const v = b.cardOutcomesAmount != null ? b.cardOutcomesAmount : (b.amount || 0); return parseFloat(v) || 0; };
  const grandTotal = [...(overdue || []), ...(dueToday || []), ...(dueSoon || []), ...(upcoming || [])].reduce((sum, b) => sum + billAmt(b), 0);

  const overdueCount = (overdue || []).length;
  const dueTodayCount = (dueToday || []).length;
  const dueSoonCount = (dueSoon || []).length;
  const upcomingCount = (upcoming || []).length;

  const chips = [
    overdueCount > 0 ? `<span class="chip-overdue" style="background:#fee2e2;color:#dc2626;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${overdueCount} ATRASADA${overdueCount > 1 ? 'S' : ''}</span>` : '',
    dueTodayCount > 0 ? `<span class="chip-today" style="background:#fef3c7;color:#d97706;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${dueTodayCount} HOJE</span>` : '',
    dueSoonCount > 0 ? `<span class="chip-upcoming" style="background:#dbeafe;color:#2563eb;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${dueSoonCount} PRÓXIMA${dueSoonCount > 1 ? 'S' : ''}</span>` : '',
    upcomingCount > 0 ? `<span style="background:#f3f4f6;color:#6b7280;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;display:inline-block;">${upcomingCount} FUTURA${upcomingCount > 1 ? 'S' : ''}</span>` : '',
  ].filter(Boolean).join('');

  const renderRows = (items, dotColor, lightAmountColor, isOverdue) => {
    if (!items || items.length === 0) return '';
    return items.map(item => {
      const dateLabel = isOverdue && item.daysOverdue
        ? `Venceu ${formatDate(item.dueDate)} · <span style="color:#ef4444;">${item.daysOverdue}d atraso</span>`
        : `Vence ${formatDate(item.dueDate)}`;
      const markPaidBtn = item.markPaidUrl
        ? `<a href="${item.markPaidUrl}" style="display:inline-block;margin-top:6px;padding:4px 12px;background:#10b981;color:#fff;text-decoration:none;border-radius:4px;font-size:11px;font-weight:700;">✓ Marcar como pago</a>`
        : '';
      return `
        <tr class="bill-row">
          <td width="16" style="padding:12px 0 12px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:4px;"></div>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div class="bill-name" style="font-size:13px;font-weight:600;color:#1e293b;">${item.name || 'Sem nome'}</div>
            <div class="bill-sub" style="font-size:11px;color:#6b7280;margin-top:2px;">${dateLabel}</div>
            ${markPaidBtn}
          </td>
          <td style="padding:12px 4px 12px 8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:top;white-space:nowrap;">
            <span class="amount-${isOverdue ? 'overdue' : ''}" style="font-size:13px;font-weight:700;color:${lightAmountColor};">${formatCurrency(billAmt(item))}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  const allRows = [
    renderRows(overdue, '#ef4444', '#dc2626', true),
    renderRows(dueToday, '#f59e0b', '#d97706', false),
    renderRows(dueSoon || [], '#3b82f6', '#2563eb', false),
    renderRows(upcoming || [], '#6b7280', '#9ca3af', false),
  ].join('');

  return `
    ${SHARED_STYLES}
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" class="mw-outer" style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f1f5f9;">
      <tr><td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" class="mw-card" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;padding:24px;">

          <!-- Brand -->
          <tr><td style="padding:0 4px 16px;">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;padding-right:10px;"><img src="https://realwise.com.br/logo.jpg" alt="Realwise" width="32" height="32" style="display:block;border-radius:8px;" /></td>
              <td style="vertical-align:middle;"><div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Realwise</div></td>
            </tr></table>
          </td></tr>

          <!-- Title + chips -->
          <tr><td style="padding:0 4px 20px;">
            <div class="mw-title" style="color:#1e293b;font-size:22px;font-weight:700;line-height:1.3;margin-bottom:12px;">${name}, aqui estão suas contas</div>
            <div>${chips}</div>
          </td></tr>

          <!-- Bill rows -->
          <tr><td style="padding:0 4px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${allRows}
            </table>
          </td></tr>

          <!-- Total -->
          <tr><td style="padding:20px 4px 8px;">
            <div class="total-label" style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total pendente</div>
            <div class="total-amount" style="font-size:32px;font-weight:800;color:#10b981;line-height:1;">${formatCurrency(grandTotal)}</div>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding:20px 4px 8px;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;padding:13px 36px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">Ver Contas no Realwise →</a>
          </td></tr>

          <!-- WhatsApp CTA -->
          <tr><td style="padding:8px 4px 0;text-align:center;">
            <a href="https://wa.me/5541992310339" style="display:inline-block;padding:11px 28px;background:#ffffff;color:#25d366;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;border:2px solid #25d366;">
              💬 Falar com a gente no WhatsApp
            </a>
          </td></tr>

          <!-- Footer -->
          <tr><td class="mw-footer" style="padding:24px 4px 8px;text-align:center;font-size:11px;color:#9ca3af;">
            © 2026 Realwise · Você recebe este e-mail porque tem lembretes ativos.
          </td></tr>

        </table>
      </td></tr>
    </table>
  `;
};

/**
 * Template 7: Accept Migration
 */
exports.acceptMigrationTemplate = (name, migrationUrl = 'https://realwise.com.br/login') => getBaseTemplate({
  title: `Sua conta foi migrada com sucesso, ${name} 🔄`,
  subtitle: 'Realizamos uma migração para uma infraestrutura melhorada. Seus dados estão intactos.',
  body: `
    <div class="mw-info-box" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div class="mw-info-text" style="font-size:13px;color:#374151;line-height:1.7;">
        ✅ <strong>Nenhuma ação necessária da sua parte.</strong> Todos os seus dados financeiros foram preservados integralmente. Basta acessar normalmente.
      </div>
    </div>
    <div class="mw-warn-box" style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 6px 6px 0;padding:14px 18px;">
      <div class="mw-warn-text" style="font-size:13px;color:#713f12;line-height:1.6;">
        ⚠️ <strong>Algum problema?</strong> Basta responder a este e-mail e resolveremos imediatamente.
      </div>
    </div>
  `,
  cta: 'Acessar o Sistema →',
  ctaUrl: migrationUrl,
  footerNote: 'Você está recebendo este e-mail porque é um cliente Realwise.',
});

/**
 * Template 8: New Lead Notification (admin internal)
 */
exports.newLeadTemplate = ({ name, email, whatsapp, createdAt }) => {
  const formattedDate = createdAt
    ? new Date(createdAt.toDate?.() || createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const whatsappDisplay = whatsapp || 'não informado';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px}
    .container{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .header{background:#10b981;padding:20px 24px}.header h1{color:#fff;margin:0;font-size:18px;font-weight:600}
    .body{padding:24px}.field{margin-bottom:12px}
    .field-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:2px}
    .field-value{font-size:15px;color:#1e293b;font-weight:500}
    .footer{padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0}
    .admin-link{color:#10b981;text-decoration:none;font-size:13px;font-weight:500}
  </style></head><body><div class="container">
    <div class="header"><h1>🎯 Novo lead no Realwise</h1></div>
    <div class="body">
      <div class="field"><div class="field-label">Nome</div><div class="field-value">${name || '—'}</div></div>
      <div class="field"><div class="field-label">Email</div><div class="field-value">${email || '—'}</div></div>
      <div class="field"><div class="field-label">WhatsApp</div><div class="field-value">${whatsappDisplay}</div></div>
      <div class="field"><div class="field-label">Data/hora (Brasília)</div><div class="field-value">${formattedDate}</div></div>
    </div>
    <div class="footer"><a href="https://realwise.com.br/admin" class="admin-link">Ver no painel admin →</a></div>
  </div></body></html>`;
};
