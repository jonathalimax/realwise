/** Content for chat-led onboarding: the categories a new user starts with, the bank list, and the scripted welcome. */

export interface DefaultCategory {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Moradia', type: 'expense', color: '#6366f1', icon: '🏠' },
  { name: 'Mercado', type: 'expense', color: '#16a34a', icon: '🛒' },
  { name: 'Alimentação fora', type: 'expense', color: '#f97316', icon: '🍽️' },
  { name: 'Transporte', type: 'expense', color: '#0ea5e9', icon: '🚗' },
  { name: 'Saúde', type: 'expense', color: '#ef4444', icon: '🩺' },
  { name: 'Educação', type: 'expense', color: '#8b5cf6', icon: '🎓' },
  { name: 'Lazer', type: 'expense', color: '#ec4899', icon: '🎉' },
  { name: 'Assinaturas', type: 'expense', color: '#14b8a6', icon: '📺' },
  { name: 'Compras', type: 'expense', color: '#f59e0b', icon: '🛍️' },
  { name: 'Impostos e taxas', type: 'expense', color: '#64748b', icon: '🧾' },
  { name: 'Outros', type: 'expense', color: '#94a3b8', icon: '📦' },
  { name: 'Salário', type: 'income', color: '#22c55e', icon: '💼' },
  { name: 'Rendimentos', type: 'income', color: '#10b981', icon: '📈' },
  { name: 'Outros', type: 'income', color: '#84cc16', icon: '💰' },
];

/** Same ids as the web app's bank list (apps/web/src/contexts/CardsContext.jsx), so icons and names resolve there. */
export const BANKS: { id: string; name: string }[] = [
  { id: 'nubank', name: 'Nubank' },
  { id: 'itau', name: 'Itaú' },
  { id: 'bradesco', name: 'Bradesco' },
  { id: 'santander', name: 'Santander' },
  { id: 'bb', name: 'Banco do Brasil' },
  { id: 'caixa', name: 'Caixa' },
  { id: 'inter', name: 'Inter' },
  { id: 'c6', name: 'C6 Bank' },
  { id: 'btg', name: 'BTG Pactual' },
  { id: 'xp', name: 'XP' },
  { id: 'picpay', name: 'PicPay' },
  { id: 'mercadopago', name: 'Mercado Pago' },
  { id: 'neon', name: 'Neon' },
  { id: 'next', name: 'Next' },
  { id: 'original', name: 'Banco Original' },
  { id: 'pan', name: 'Banco Pan' },
  { id: 'astropay', name: 'AstroPay' },
  { id: 'other', name: 'Outro' },
];
export const BANK_IDS = BANKS.map((b) => b.id);

export const ACCOUNT_TYPES = ['checking', 'credit', 'wallet', 'savings'] as const;

export function welcomeMessage(lang: 'pt' | 'en'): { content: string; formTitle: string; formSubtitle: string } {
  const exp = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map((c) => c.name).join(', ');
  const inc = [...new Set(DEFAULT_CATEGORIES.filter((c) => c.type === 'income').map((c) => c.name))].join(', ');
  if (lang === 'en') {
    return {
      content: `Hi! I'm John, your financial assistant 💜 I'll get everything ready for you, right here in the chat.

I already created your categories:
- **Expenses:** ${exp}
- **Income:** ${inc}

You can ask me to change them any time (for example, "rename Lazer to Fun"). Now, to record your transactions I need your first account or card. Fill in the details in the sheet that just opened.`,
      formTitle: 'Add your first account or card',
      formSubtitle: 'The holder name helps me recognise transfers between your own accounts.',
    };
  }
  return {
    content: `Oi! Eu sou o John, seu assistente financeiro 💜 Vou deixar tudo pronto para você, aqui mesmo no chat.

Já criei as suas categorias:
- **Despesas:** ${exp}
- **Receitas:** ${inc}

Se quiser ajustar, é só me pedir quando quiser (por exemplo, "troque Lazer por Diversão"). Agora, para registrar suas movimentações, preciso da sua primeira conta ou cartão. Preencha os dados na folha que acabou de abrir.`,
    formTitle: 'Cadastre sua primeira conta ou cartão',
    formSubtitle: 'O nome do titular me ajuda a reconhecer transferências entre as suas contas.',
  };
}
