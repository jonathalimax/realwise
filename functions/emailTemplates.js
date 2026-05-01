
const SHARED_STYLES = `
  <style>
    @media (prefers-color-scheme: dark) {
      .mw-title      { color: #f1f5f9 !important; }
      .mw-body-text  { color: #cbd5e1 !important; }
      .mw-sub        { color: #94a3b8 !important; }
      .mw-footer     { color: #475569 !important; }
      .mw-info-box   { background-color: #1e293b !important; border-left-color: #10b981 !important; }
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
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Brand -->
        <tr><td style="padding:0 4px 16px;">
          <div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Moneywise</div>
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
          <a href="${ctaUrl || 'https://moneywise.web.app'}" style="display:inline-block;padding:13px 36px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">${cta}</a>
        </td></tr>
        ` : ''}

        <!-- Footer -->
        <tr><td class="mw-footer" style="padding:24px 4px 8px;text-align:center;font-size:11px;color:#9ca3af;">
          © ${new Date().getFullYear()} Moneywise · ${footerNote || 'Todos os direitos reservados.'}
        </td></tr>

      </table>
    </td></tr>
  </table>
`;

/**
 * Template 1: Welcome & Next Steps
 */
exports.welcomeTemplate = (name) => getBaseTemplate({
  title: `Bem-vindo ao Moneywise, ${name}! 🚀`,
  subtitle: 'Sua jornada para uma vida financeira mais organizada começa agora.',
  body: `
    <div class="mw-info-box" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:8px;">Próximos Passos</div>
      <div class="mw-info-text" style="font-size:13px;color:#374151;line-height:1.7;">
        <div style="margin-bottom:6px;">⏳ <strong>Aguarde a Ativação</strong> — nossa equipe está configurando seu acesso e você receberá um e-mail em instantes.</div>
        <div style="margin-bottom:6px;">📄 <strong>Prepare-se</strong> — reúna suas faturas e extratos bancários.</div>
        <div>💬 <strong>Dúvidas?</strong> Basta responder a este e-mail.</div>
      </div>
    </div>
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;">Obrigado por confiar no Moneywise!<br><br>Equipe Moneywise</div>
  `,
  footerNote: 'Você está recebendo este e-mail porque se cadastrou no Moneywise.',
});

/**
 * Template 2: Access Granted (Green Light)
 */
exports.accessGrantedTemplate = (name, loginUrl = 'https://mymoneywise.web.app') => getBaseTemplate({
  title: `Luz Verde, ${name}! Tudo pronto. 🟢`,
  subtitle: 'Seu acesso ao Moneywise foi liberado. Você já pode começar.',
  body: `
    <div class="mw-info-box" style="background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 6px 6px 0;padding:16px 20px;">
      <div class="mw-info-text" style="font-size:13px;color:#374151;line-height:1.7;">
        💡 <strong>Dica rápida:</strong> Comece importando seu extrato bancário (OFX ou PDF) na aba "Importar" para economizar tempo no cadastro de transações.
      </div>
    </div>
  `,
  cta: 'Acessar o Sistema Agora',
  ctaUrl: loginUrl,
  footerNote: 'Você está recebendo este e-mail porque é um cliente Moneywise.',
});

/**
 * Template 3: Bill Reminders — adaptive dark/light
 */
exports.billReminderTemplate = (name, { overdue, dueToday, upcoming }) => {
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

  const getDisplayAmount = (item) => {
    const isCreditCard = item.category === 'credit_card';
    return isCreditCard && item.cardOutcomesAmount != null ? item.cardOutcomesAmount : item.amount;
  };

  const grandTotal = [...(overdue || []), ...(dueToday || []), ...(upcoming || [])].reduce((sum, b) => {
    const amt = parseFloat(getDisplayAmount(b));
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const overdueCount = (overdue || []).length;
  const dueTodayCount = (dueToday || []).length;
  const upcomingCount = (upcoming || []).length;

  const chips = [
    overdueCount > 0 ? `<span class="chip-overdue" style="background:#fee2e2;color:#dc2626;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${overdueCount} ATRASADA${overdueCount > 1 ? 'S' : ''}</span>` : '',
    dueTodayCount > 0 ? `<span class="chip-today" style="background:#fef3c7;color:#d97706;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${dueTodayCount} HOJE</span>` : '',
    upcomingCount > 0 ? `<span class="chip-upcoming" style="background:#dbeafe;color:#2563eb;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;display:inline-block;">${upcomingCount} PRÓXIMA${upcomingCount > 1 ? 'S' : ''}</span>` : '',
  ].filter(Boolean).join('');

  const renderRows = (items, dotColor, lightAmountColor, isOverdue) => {
    if (!items || items.length === 0) return '';
    return items.map(item => {
      const displayAmount = getDisplayAmount(item);
      const dateLabel = isOverdue && item.daysOverdue
        ? `Venceu ${formatDate(item.dueDate)} · <span style="color:#ef4444;">${item.daysOverdue}d atraso</span>`
        : `Vence ${formatDate(item.dueDate)}`;
      const isCreditCard = item.category === 'credit_card';
      const cardLabel = isCreditCard && item.cardOutcomesCount > 0
        ? `<div class="bill-sub" style="font-size:10px;color:#6b7280;margin-top:2px;">💳 ${item.cardOutcomesCount} lançamento${item.cardOutcomesCount > 1 ? 's' : ''} no ciclo</div>`
        : '';
      return `
        <tr class="bill-row">
          <td width="16" style="padding:12px 0 12px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:4px;"></div>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div class="bill-name" style="font-size:13px;font-weight:600;color:#1e293b;">${item.name || 'Sem nome'}</div>
            <div class="bill-sub" style="font-size:11px;color:#6b7280;margin-top:2px;">${dateLabel}</div>
            ${cardLabel}
          </td>
          <td style="padding:12px 4px 12px 8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:top;white-space:nowrap;">
            <span class="amount-${isOverdue ? 'overdue' : ''}" style="font-size:13px;font-weight:700;color:${lightAmountColor};">${formatCurrency(displayAmount)}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  const allRows = [
    renderRows(overdue, '#ef4444', '#dc2626', true),
    renderRows(dueToday, '#f59e0b', '#d97706', false),
    renderRows(upcoming, '#3b82f6', '#2563eb', false),
  ].join('');

  return `
    ${SHARED_STYLES}
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <tr><td align="center" style="padding:24px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Brand -->
          <tr><td style="padding:0 4px 16px;">
            <div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Moneywise</div>
          </td></tr>

          <!-- Title + chips -->
          <tr><td style="padding:0 4px 20px;">
            <div class="mw-title" style="color:#1e293b;font-size:22px;font-weight:700;line-height:1.3;margin-bottom:12px;">${name}, aqui estão suas contas</div>
            <div>${chips}</div>
          </td></tr>

          <!-- Bill rows — no card background -->
          <tr><td style="padding:0 4px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${allRows}
            </table>
          </td></tr>

          <!-- Total — prominent block -->
          <tr><td style="padding:20px 4px 8px;">
            <div class="total-label" style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total pendente</div>
            <div class="total-amount" style="font-size:32px;font-weight:800;color:#10b981;line-height:1;">${formatCurrency(grandTotal)}</div>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding:20px 4px 8px;text-align:center;">
            <a href="https://moneywise.web.app" style="display:inline-block;padding:13px 36px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">Ver Contas no Moneywise →</a>
          </td></tr>

          <!-- Footer -->
          <tr><td class="mw-footer" style="padding:24px 4px 8px;text-align:center;font-size:11px;color:#9ca3af;">
            © ${new Date().getFullYear()} Moneywise · Você recebe este e-mail porque tem lembretes ativos.
          </td></tr>

        </table>
      </td></tr>
    </table>
  `;
};

/**
 * Template 4: Accept Migration
 */
exports.acceptMigrationTemplate = (name, migrationUrl = 'https://moneywise.web.app') => getBaseTemplate({
  title: `Seu acesso foi migrado, ${name} 🔄`,
  subtitle: 'Realizamos uma migração para uma infraestrutura melhorada.',
  body: `
    <div class="mw-body-text" style="font-size:13px;color:#4b5563;margin-bottom:16px;line-height:1.7;">
      Para concluir a migração e acessar sua conta, clique no botão abaixo. Seus dados financeiros foram preservados integralmente.
    </div>
    <div class="mw-warn-box" style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 6px 6px 0;padding:14px 18px;">
      <div class="mw-warn-text" style="font-size:13px;color:#713f12;line-height:1.6;">
        ⚠️ <strong>Importante:</strong> Caso encontre algum problema após a migração, basta responder a este e-mail e resolveremos imediatamente.
      </div>
    </div>
  `,
  cta: 'Aceitar Migração e Acessar',
  ctaUrl: migrationUrl,
  footerNote: 'Você está recebendo este e-mail porque é um cliente Moneywise.',
});
