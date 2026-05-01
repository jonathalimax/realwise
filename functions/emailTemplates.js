
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
    overdueCount > 0 ? `<span style="background:#450a0a;color:#fca5a5;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;">${overdueCount} ATRASADA${overdueCount > 1 ? 'S' : ''}</span>` : '',
    dueTodayCount > 0 ? `<span style="background:#422006;color:#fdba74;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;margin-right:6px;">${dueTodayCount} HOJE</span>` : '',
    upcomingCount > 0 ? `<span style="background:#1e3a5f;color:#93c5fd;border-radius:4px;font-size:11px;font-weight:700;padding:3px 10px;">${upcomingCount} PRÓXIMA${upcomingCount > 1 ? 'S' : ''}</span>` : '',
  ].filter(Boolean).join('');

  const renderRows = (items, dotColor, amountColor) => {
    if (!items || items.length === 0) return '';
    return items.map(item => {
      const displayAmount = getDisplayAmount(item);
      const overdueLabel = item.daysOverdue ? `· ${item.daysOverdue}d atraso` : '';
      const isCreditCard = item.category === 'credit_card';
      const cardLabel = isCreditCard && item.cardOutcomesCount > 0
        ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">💳 ${item.cardOutcomesCount} lançamento${item.cardOutcomesCount > 1 ? 's' : ''} no ciclo</div>`
        : '';
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;vertical-align:top;">
            <div style="display:flex;align-items:flex-start;gap:10px;">
              <div style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:5px;flex-shrink:0;"></div>
              <div>
                <div style="font-size:13px;font-weight:600;color:#f1f5f9;">${item.name || 'Sem nome'}</div>
                <div style="font-size:11px;color:#64748b;margin-top:1px;">Vence ${formatDate(item.dueDate)} ${overdueLabel}</div>
                ${cardLabel}
              </div>
            </div>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #1e293b;text-align:right;vertical-align:top;">
            <span style="font-size:13px;font-weight:700;color:${amountColor};">${formatCurrency(displayAmount)}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  const allRows = [
    renderRows(overdue, '#ef4444', '#fca5a5'),
    renderRows(dueToday, '#f59e0b', '#fdba74'),
    renderRows(upcoming, '#3b82f6', '#93c5fd'),
  ].join('');

  return `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:10px;overflow:hidden;">
      <!-- Header -->
      <div style="padding:24px 24px 16px;background:#0f172a;">
        <div style="color:#10b981;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Moneywise</div>
        <div style="color:#f1f5f9;font-size:20px;font-weight:700;line-height:1.3;margin-bottom:4px;">${name}, aqui estão suas contas</div>
        <div style="color:#64748b;font-size:12px;margin-bottom:14px;">${today}</div>
        <div>${chips}</div>
      </div>

      <!-- Bill rows -->
      <div style="background:#0f172a;padding:0 12px;">
        <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
          ${allRows}
        </table>
      </div>

      <!-- Total -->
      <div style="padding:14px 24px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1e293b;margin-top:12px;">
        <span style="color:#94a3b8;font-size:12px;">Total pendente</span>
        <span style="color:#10b981;font-size:18px;font-weight:800;">${formatCurrency(grandTotal)}</span>
      </div>

      <!-- CTA -->
      <div style="text-align:center;padding:0 24px 24px;">
        <a href="https://moneywise.web.app" style="display:inline-block;padding:11px 28px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;">Ver Contas no Moneywise →</a>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:16px 24px;border-top:1px solid #1e293b;font-size:11px;color:#475569;">
        © ${new Date().getFullYear()} Moneywise · Você recebe este e-mail porque tem lembretes ativos.
      </div>
    </div>
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
