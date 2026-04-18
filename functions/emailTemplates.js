
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
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px;">Lima's Finance</h1>
    </div>
    <div style="${CONTENT_STYLE}">
      ${content}
    </div>
    <div style="${FOOTER_STYLE}">
      <p>© ${new Date().getFullYear()} Lima's Finance. Todos os direitos reservados.</p>
      <p>Você está recebendo este e-mail porque é um cliente Lima's Finance.</p>
    </div>
  </div>
`;

/**
 * Template 1: Welcome & Next Steps
 */
exports.welcomeTemplate = (name) => {
  const content = `
    <h2 style="color: #059669; margin-top: 0;">Bem-vindo ao Lima's Finance! 🚀</h2>
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
    <p>Atenciosamente,<br><strong>Equipe Lima's Finance</strong></p>
  `;
  return getBaseTemplate(content);
};

/**
 * Template 2: Access Granted (Green Light)
 */
exports.accessGrantedTemplate = (name, loginUrl = 'https://limasfinance.web.app') => {
  const content = `
    <h2 style="color: #059669; margin-top: 0;">Luz Verde! Tudo pronto. 🟢</h2>
    <p>Olá, <strong>${name}</strong>!</p>
    <p>Seu acesso ao sistema <strong>Lima's Finance</strong> já foi liberado. Você já pode começar a gerenciar suas finanças de forma profissional.</p>
    
    <div style="text-align: center;">
      <a href="${loginUrl}" style="${BUTTON_STYLE}">Acessar o Sistema Agora</a>
    </div>
    
    <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      <p style="font-size: 14px; color: #4b5563;">
        <strong>Dica Rápida:</strong> Comece importando seu extrato bancário (OFX ou PDF) na aba "Importar" para economizar tempo no cadastro de transações.
      </p>
    </div>
    
    <p>Nos vemos lá!</p>
    <p>Atenciosamente,<br><strong>Equipe Lima's Finance</strong></p>
  `;
  return getBaseTemplate(content);
};

/**
 * Template 3: Bill Reminders (Summary)
 */
exports.billReminderTemplate = (name, { overdue, dueToday, upcoming }) => {
  const formatCurrency = (val) => `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
  
  const renderList = (items, title, color) => {
    if (!items || items.length === 0) return '';
    return `
      <h3 style="color: ${color}; font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${title}</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        ${items.map(item => `
          <tr>
            <td style="padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f9fafb;">${item.name || 'Sem nome'}</td>
            <td style="padding: 8px 0; font-size: 14px; text-align: right; font-weight: bold; border-bottom: 1px solid #f9fafb;">${formatCurrency(item.amount)}</td>
          </tr>
        `).join('')}
      </table>
    `;
  };

  const content = `
    <h2 style="color: #059669; margin-top: 0;">Resumo de Contas Pendentes 💳</h2>
    <p>Olá, <strong>${name}</strong>! Aqui está o resumo das suas obrigações financeiras:</p>
    
    ${renderList(overdue, '⚠️ ATRASADAS (Urgente)', '#dc2626')}
    ${renderList(dueToday, '📅 VENCENDO HOJE', '#d97706')}
    ${renderList(upcoming, '🕓 PRÓXIMOS DIAS', '#2563eb')}
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://limasfinance.web.app/bills" style="${BUTTON_STYLE}">Ver Todas as Contas</a>
    </div>
    
    <p style="margin-top: 30px; font-size: 13px; color: #6b7280; text-align: center;">
      Mantenha suas contas em dia para evitar juros e manter sua saúde financeira.
    </p>
  `;
  return getBaseTemplate(content);
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
