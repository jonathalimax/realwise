/**
 * The pre-designed categories (the onboarding interview offers all of them; `basic` ones start on). Each expense
 * category has a default budget group the user can change later. Keep this list in step with
 * apps/web/src/lib/categoryCatalog.js: categories are stored by name, so names are the contract.
 */
export type BudgetGroup = 'needs' | 'wants' | 'savings';

export interface CatalogCategory {
  pt: string;
  en: string;
  type: 'income' | 'expense';
  bucket?: BudgetGroup;
  basic: boolean;
  hint: string;
  icon: string;
  color: string;
}

const e = (pt: string, en: string, bucket: BudgetGroup, basic: boolean, icon: string, color: string, hint: string): CatalogCategory => ({ pt, en, type: 'expense', bucket, basic, hint, icon, color });
const i = (pt: string, en: string, basic: boolean, icon: string, color: string, hint: string): CatalogCategory => ({ pt, en, type: 'income', basic, hint, icon, color });

export const CATEGORY_CATALOG: CatalogCategory[] = [
  e('Moradia', 'Housing', 'needs', true, '🏠', '#6366f1', 'Aluguel, condomínio, financiamento'),
  e('Contas', 'Bills', 'needs', true, '💡', '#0ea5e9', 'Luz, água, gás, internet'),
  e('Mercado', 'Groceries', 'needs', true, '🛒', '#16a34a', 'Supermercado e feira'),
  e('Alimentação', 'Food', 'needs', true, '🍽️', '#f97316', 'Refeições do dia a dia'),
  e('Saúde', 'Healthcare', 'needs', true, '🩺', '#ef4444', 'Plano, consultas, exames'),
  e('Farmácia', 'Pharmacy', 'needs', false, '💊', '#f43f5e', 'Remédios e itens de saúde'),
  e('Veículo', 'Vehicle', 'needs', true, '🚗', '#0ea5e9', 'Combustível, seguro, manutenção'),
  e('Transporte', 'Transport', 'needs', true, '🚌', '#38bdf8', 'Ônibus, metrô, aplicativos'),
  e('Impostos', 'Taxes', 'needs', true, '🧾', '#64748b', 'IPTU, IPVA, taxas'),
  e('Seguros', 'Insurance', 'needs', false, '🛡️', '#64748b', 'Vida, residencial, auto'),
  e('Educação', 'Education', 'wants', true, '🎓', '#8b5cf6', 'Escola, faculdade, material'),
  e('Filhos', 'Kids', 'needs', false, '🧸', '#f59e0b', 'Creche, roupas, atividades'),
  e('Pets', 'Pets', 'needs', false, '🐾', '#a16207', 'Ração, veterinário'),
  e('Dívidas', 'Debt', 'needs', false, '📉', '#dc2626', 'Parcelas, juros e empréstimos'),
  e('Manutenção da casa', 'Home upkeep', 'needs', false, '🔧', '#78716c', 'Reparos e reformas'),
  e('Lazer', 'Leisure', 'wants', true, '🎉', '#ec4899', 'Passeios, cinema, eventos'),
  e('Restaurantes', 'Dining out', 'wants', true, '🍝', '#f97316', 'Restaurantes, bares e cafés'),
  e('Delivery', 'Delivery', 'wants', false, '🛵', '#fb923c', 'Pedidos por aplicativo'),
  e('Assinaturas', 'Subscriptions', 'wants', true, '📺', '#14b8a6', 'Streaming, apps e serviços'),
  e('Compras', 'Shopping', 'wants', true, '🛍️', '#f59e0b', 'Itens para casa e eletrônicos'),
  e('Vestuário', 'Clothing', 'wants', true, '👕', '#d946ef', 'Roupas e calçados'),
  e('Beleza', 'Beauty', 'wants', true, '💅', '#f472b6', 'Salão, cosméticos, estética'),
  e('Esporte', 'Sports', 'wants', true, '🏃', '#22c55e', 'Academia e equipamentos'),
  e('Viagens', 'Travel', 'wants', true, '✈️', '#0891b2', 'Passagens e hospedagem'),
  e('Presentes', 'Gifts', 'wants', false, '🎁', '#e11d48', 'Aniversários e datas especiais'),
  e('Doações', 'Donations', 'wants', false, '🤝', '#10b981', 'Ajuda a causas e pessoas'),
  e('Igreja', 'Church', 'wants', true, '⛪', '#a78bfa', 'Dízimo e ofertas'),
  e('Hobbies', 'Hobbies', 'wants', false, '🎨', '#c026d3', 'Jogos, cursos livres, artesanato'),
  e('Diversos', 'Other', 'wants', true, '📦', '#94a3b8', 'O que não cabe em outra categoria'),
  e('Investimentos', 'Investments', 'savings', true, '📈', '#10b981', 'Aportes em investimentos'),
  e('Reserva de emergência', 'Emergency fund', 'savings', false, '🛟', '#2dd4bf', 'Dinheiro guardado para imprevistos'),
  e('Aposentadoria', 'Retirement', 'savings', false, '🌴', '#14b8a6', 'Previdência e longo prazo'),
  e('Sonhos e metas', 'Goals', 'savings', false, '🎯', '#06b6d4', 'Viagem, casa, carro'),
  i('Salário', 'Salary', true, '💼', '#22c55e', 'Salário e pró-labore'),
  i('Freelance', 'Freelance', true, '🧑‍💻', '#16a34a', 'Trabalhos avulsos'),
  i('Investimentos', 'Investment', true, '📈', '#10b981', 'Rendimentos e dividendos'),
  i('Reembolso', 'Refund', true, '↩️', '#84cc16', 'Dinheiro devolvido'),
  i('Presente', 'Gift', true, '🎁', '#a3e635', 'Dinheiro recebido de presente'),
  i('Bônus', 'Bonus', false, '🏆', '#eab308', '13º, PLR e bônus'),
  i('Aluguel', 'Rental', false, '🏘️', '#65a30d', 'Aluguel recebido'),
  i('Vendas', 'Sales', false, '🏷️', '#4ade80', 'Vendas de itens ou serviços'),
  i('Benefícios', 'Benefits', false, '🧾', '#34d399', 'Auxílios e benefícios'),
  i('Outros', 'Other', true, '💰', '#84cc16', 'Outras entradas'),
];

export const BASIC_CATEGORIES = CATEGORY_CATALOG.filter((c) => c.basic);

/** Default budget group per category name (both languages), for the settings `categoryRuleMapping`. */
export function defaultRuleMapping(names: string[]): Record<string, BudgetGroup> {
  const out: Record<string, BudgetGroup> = {};
  for (const c of CATEGORY_CATALOG) {
    if (c.type !== 'expense' || !c.bucket) continue;
    if (names.includes(c.pt)) out[c.pt] = c.bucket;
    if (names.includes(c.en)) out[c.en] = c.bucket;
  }
  return out;
}
