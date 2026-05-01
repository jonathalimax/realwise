
const BASE_STYLE = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
  background-color: #f4f7f6;
`;

const HEADER_STYLE = `
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 30px 20px;
  text-align: center;
  border-radius: 8px 8px 0 0;
`;

const CONTENT_STYLE = `
  background-color: #ffffff;
  padding: 30px;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
`;

const FOOTER_STYLE = `
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: #6b7280;
`;

const BUTTON_STYLE = `
  display: inline-block;
  padding: 12px 24px;
  background-color: #10b981;
  color: #ffffff;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  margin-top: 20px;
`;

const getBaseTemplate = (content) => `
  <div style="${BASE_STYLE}">
    <div style="${HEADER_STYLE}">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px;">Moneywise</h1>
    </div>
    <div style="${CONTENT_STYLE}">
      ${content}
    </div>
    <div style="${FOOTER_STYLE}">
      <p>© ${new Date().getFullYear()} Moneywise. Todos os direitos reservados.</p>
      <p>Você está recebendo este e-mail porque é um cliente Moneywise.</p>
    </div>
  </div>
`;

/**
 * Template 1: Welcome & Next Steps
 */
exports.welcomeTemplate = (name) => {
  const content = `
    <h2 style="color: #059669; margin-top: 0;">Bem-vindo ao Moneywise! 🚀</h2>
    <p>Olá, <strong>${name}</strong>!</p>
    <p>Estamos muito felizes em ter você conosco. Sua jornada para uma vida financeira mais organizada e próspera começa agora.</p>
    
    <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #065f46; font-size: 16px;">Próximos Passos:</h3>
      <ul style="padding-left: 20px; margin-bottom: 0;">
        <li><strong>Aguarde a Ativação:</strong> Nossa equipe está configurando seu acesso. Você receberá um e-mail de "Luz Verde" em instantes.</li>
        <li><strong>Prepare-se:</strong> Reúna suas faturas e extratos bancários para começar a alimentar o sistema.</li>
        <li><strong>Dúvidas?</strong> Se precisar de ajuda, basta responder a este e-mail.</li>
      </ul>
    </div>
    
    <p>Obrigado por confiar no nosso sistema!</p>
    <p>Atenciosamente,<br><strong>Equipe Moneywise</strong></p>
  `;
  return getBaseTemplate(content);
};

/**
 * Template 2: Access Granted (Green Light)
 */
exports.accessGrantedTemplate = (name, loginUrl = 'https://mymoneywise.web.app') => {
  const content = `
    <h2 style="color: #059669; margin-top: 0;">Luz Verde! Tudo pronto. 🟢</h2>
    <p>Olá, <strong>${name}</strong>!</p>
    <p>Seu acesso ao sistema <strong>Moneywise</strong> já foi liberado. Você já pode começar a gerenciar suas finanças de forma profissional.</p>
    
    <div style="text-align: center;">
      <a href="${loginUrl}" style="${BUTTON_STYLE}">Acessar o Sistema Agora</a>
    </div>
    
    <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      <p style="font-size: 14px; color: #4b5563;">
        <strong>Dica Rápida:</strong> Comece importando seu extrato bancário (OFX ou PDF) na aba "Importar" para economizar tempo no cadastro de transações.
      </p>
    </div>
    
    <p>Nos vemos lá!</p>
    <p>Atenciosamente,<br><strong>Equipe Moneywise</strong></p>
  `;
  return getBaseTemplate(content);
};

/**
 * Template 3: Bill Reminders — Dark Dashboard style
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
    } catch (e) {
      return '—';
    }
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

  const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric' });

  const chips = [
    overdueCount > 0 ? `<span class="chip-overdue" style="background:#fee2e2;color:#dc2626;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${overdueCount} ATRASADA${overdueCount > 1 ? 'S' : ''}</span>` : '',
    dueTodayCount > 0 ? `<span class="chip-today" style="background:#fef3c7;color:#d97706;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;display:inline-block;">${dueTodayCount} HOJE</span>` : '',
    upcomingCount > 0 ? `<span class="chip-upcoming" style="background:#dbeafe;color:#2563eb;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;display:inline-block;">${upcomingCount} PRÓXIMA${upcomingCount > 1 ? 'S' : ''}</span>` : '',
  ].filter(Boolean).join('');

  const renderRows = (items, dotColor, lightAmountColor, darkAmountColor, isOverdue) => {
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
          <td width="8" style="padding:10px 0 10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:4px;"></div>
          </td>
          <td class="bill-cell" style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div class="bill-name" style="font-size:13px;font-weight:600;color:#1e293b;">${item.name || 'Sem nome'}</div>
            <div class="bill-sub" style="font-size:11px;color:#6b7280;margin-top:2px;">${dateLabel}</div>
            ${cardLabel}
          </td>
          <td class="bill-cell" style="padding:10px 12px 10px 4px;border-bottom:1px solid #e5e7eb;text-align:right;vertical-align:top;white-space:nowrap;">
            <span class="amount-${isOverdue ? 'overdue' : ''}" style="font-size:13px;font-weight:700;color:${lightAmountColor};">${formatCurrency(displayAmount)}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  const allRows = [
    renderRows(overdue, '#ef4444', '#dc2626', '#fca5a5', true),
    renderRows(dueToday, '#f59e0b', '#d97706', '#fdba74', false),
    renderRows(upcoming, '#3b82f6', '#2563eb', '#93c5fd', false),
  ].join('');

  return `
    <style>
      @media (prefers-color-scheme: dark) {
        .email-title   { color: #f1f5f9 !important; }
        .email-date    { color: #64748b !important; }
        .bill-table    { background-color: #1e293b !important; }
        .bill-row td   { border-bottom-color: #334155 !important; }
        .bill-name     { color: #f1f5f9 !important; }
        .bill-sub      { color: #94a3b8 !important; }
        .bill-cell     { border-bottom-color: #334155 !important; }
        .total-row td  { border-top-color: #334155 !important; }
        .total-label   { color: #94a3b8 !important; }
        .footer-cell   { color: #475569 !important; border-top-color: #334155 !important; }
        .chip-overdue  { background:#450a0a !important; color:#fca5a5 !important; }
        .chip-today    { background:#422006 !important; color:#fdba74 !important; }
        .chip-upcoming { background:#1e3a5f !important; color:#93c5fd !important; }
        .amount-overdue { color:#fca5a5 !important; }
      }
    </style>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <tr><td align="center" style="padding:20px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header — transparent, blends with email bg -->
          <tr><td style="padding:8px 12px 16px;">
            <div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Moneywise</div>
            <div class="email-title" style="color:#1e293b;font-size:22px;font-weight:700;line-height:1.3;margin-bottom:4px;">${name}, aqui estão suas contas</div>
            <div class="email-date" style="color:#6b7280;font-size:12px;margin-bottom:14px;">${today}</div>
            <div>${chips}</div>
          </td></tr>

          <!-- Bill rows — subtle card background -->
          <tr><td style="padding:0 0 4px;">
            <table class="bill-table" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:10px;overflow:hidden;">
              ${allRows}
            </table>
          </td></tr>

          <!-- Total -->
          <tr><td>
            <table width="100%" cellpadding="0" cellspacing="0" class="total-row">
              <tr>
                <td class="total-label" style="padding:14px 12px;color:#6b7280;font-size:12px;border-top:1px solid #e2e8f0;">Total pendente</td>
                <td style="padding:14px 12px;text-align:right;border-top:1px solid #e2e8f0;">
                  <span style="color:#10b981;font-size:18px;font-weight:800;">${formatCurrency(grandTotal)}</span>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td style="padding:8px 0 20px;text-align:center;">
            <a href="https://moneywise.web.app" style="display:inline-block;padding:12px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;">Ver Contas no Moneywise →</a>
          </td></tr>

          <!-- Footer -->
          <tr><td class="footer-cell" style="padding:0 12px 20px;text-align:center;font-size:11px;color:#9ca3af;border-top:none;">
            © ${new Date().getFullYear()} Moneywise · Você recebe este e-mail porque tem lembretes ativos.
          </td></tr>

        </table>
      </td></tr>
    </table>
  `;
};

/**
 * Template 4: Accept Migration
 * Sent to a client when they need to accept their account migration to a new Firebase project.
 */
exports.acceptMigrationTemplate = (name, migrationUrl = 'https://moneywise.web.app') => {
  const content = `
    <h2 style="color: #059669; margin-top: 0;">Seu Acesso Foi Migrado 🔄</h2>
    <p>Olá, <strong>${name}</strong>!</p>
    <p>
      Realizamos uma migração do seu acesso ao <strong>Moneywise</strong> para uma infraestrutura melhorada.
      Para concluir a migração e acessar sua conta, clique no botão abaixo:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${migrationUrl}" style="${BUTTON_STYLE}">Aceitar Migração e Acessar</a>
    </div>

    <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #713f12; font-size: 14px;">
        <strong>Importante:</strong> Seus dados financeiros foram preservados integralmente.
        Caso encontre algum problema, responda a este e-mail e resolveremos imediatamente.
      </p>
    </div>

    <p>Obrigado pela confiança!</p>
    <p>Atenciosamente,<br><strong>Equipe Moneywise</strong></p>
  `;
  return getBaseTemplate(content);
};
