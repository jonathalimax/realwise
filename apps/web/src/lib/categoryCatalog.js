/**
 * The pre-designed categories Realwise knows. Every entry has a default budget group (needs / wants / savings) that
 * the person can change later, and `basic` marks the ones that are on from the start. Everything else is opt-in: the
 * onboarding interview offers the whole list and Orçamento > Categorias lets you turn them on or off at any time.
 *
 * Names are the saved values (categories are stored by name), so keep them stable. Entries that existed before the
 * catalog keep their old names.
 */
export const CATEGORY_CATALOG = [
  // Needs
  { pt: 'Moradia', en: 'Housing', type: 'expense', bucket: 'needs', basic: true, hint: 'Aluguel, condomínio, financiamento' },
  { pt: 'Contas', en: 'Bills', type: 'expense', bucket: 'needs', basic: true, hint: 'Luz, água, gás, internet' },
  { pt: 'Mercado', en: 'Groceries', type: 'expense', bucket: 'needs', basic: true, hint: 'Supermercado e feira' },
  { pt: 'Alimentação', en: 'Food', type: 'expense', bucket: 'needs', basic: true, hint: 'Refeições do dia a dia' },
  { pt: 'Saúde', en: 'Healthcare', type: 'expense', bucket: 'needs', basic: true, hint: 'Plano, consultas, exames' },
  { pt: 'Farmácia', en: 'Pharmacy', type: 'expense', bucket: 'needs', basic: false, hint: 'Remédios e itens de saúde' },
  { pt: 'Veículo', en: 'Vehicle', type: 'expense', bucket: 'needs', basic: true, hint: 'Combustível, seguro, manutenção' },
  { pt: 'Transporte', en: 'Transport', type: 'expense', bucket: 'needs', basic: true, hint: 'Ônibus, metrô, aplicativos' },
  { pt: 'Impostos', en: 'Taxes', type: 'expense', bucket: 'needs', basic: true, hint: 'IPTU, IPVA, taxas' },
  { pt: 'Seguros', en: 'Insurance', type: 'expense', bucket: 'needs', basic: false, hint: 'Vida, residencial, auto' },
  { pt: 'Educação', en: 'Education', type: 'expense', bucket: 'wants', basic: true, hint: 'Escola, faculdade, material' },
  { pt: 'Filhos', en: 'Kids', type: 'expense', bucket: 'needs', basic: false, hint: 'Creche, roupas, atividades' },
  { pt: 'Pets', en: 'Pets', type: 'expense', bucket: 'needs', basic: false, hint: 'Ração, veterinário' },
  { pt: 'Dívidas', en: 'Debt', type: 'expense', bucket: 'needs', basic: false, hint: 'Parcelas, juros e empréstimos' },
  { pt: 'Manutenção da casa', en: 'Home upkeep', type: 'expense', bucket: 'needs', basic: false, hint: 'Reparos e reformas' },
  // Wants
  { pt: 'Lazer', en: 'Leisure', type: 'expense', bucket: 'wants', basic: true, hint: 'Passeios, cinema, eventos' },
  { pt: 'Restaurantes', en: 'Dining out', type: 'expense', bucket: 'wants', basic: true, hint: 'Restaurantes, bares e cafés' },
  { pt: 'Delivery', en: 'Delivery', type: 'expense', bucket: 'wants', basic: false, hint: 'Pedidos por aplicativo' },
  { pt: 'Assinaturas', en: 'Subscriptions', type: 'expense', bucket: 'wants', basic: true, hint: 'Streaming, apps e serviços' },
  { pt: 'Compras', en: 'Shopping', type: 'expense', bucket: 'wants', basic: true, hint: 'Itens para casa e eletrônicos' },
  { pt: 'Vestuário', en: 'Clothing', type: 'expense', bucket: 'wants', basic: true, hint: 'Roupas e calçados' },
  { pt: 'Beleza', en: 'Beauty', type: 'expense', bucket: 'wants', basic: true, hint: 'Salão, cosméticos, estética' },
  { pt: 'Esporte', en: 'Sports', type: 'expense', bucket: 'wants', basic: true, hint: 'Academia e equipamentos' },
  { pt: 'Viagens', en: 'Travel', type: 'expense', bucket: 'wants', basic: true, hint: 'Passagens e hospedagem' },
  { pt: 'Presentes', en: 'Gifts', type: 'expense', bucket: 'wants', basic: false, hint: 'Aniversários e datas especiais' },
  { pt: 'Doações', en: 'Donations', type: 'expense', bucket: 'wants', basic: false, hint: 'Ajuda a causas e pessoas' },
  { pt: 'Igreja', en: 'Church', type: 'expense', bucket: 'wants', basic: true, hint: 'Dízimo e ofertas' },
  { pt: 'Hobbies', en: 'Hobbies', type: 'expense', bucket: 'wants', basic: false, hint: 'Jogos, cursos livres, artesanato' },
  { pt: 'Diversos', en: 'Other', type: 'expense', bucket: 'wants', basic: true, hint: 'O que não cabe em outra categoria', protected: true },
  // Savings
  { pt: 'Investimentos', en: 'Investments', type: 'expense', bucket: 'savings', basic: true, hint: 'Aportes em investimentos' },
  { pt: 'Reserva de emergência', en: 'Emergency fund', type: 'expense', bucket: 'savings', basic: false, hint: 'Dinheiro guardado para imprevistos' },
  { pt: 'Aposentadoria', en: 'Retirement', type: 'expense', bucket: 'savings', basic: false, hint: 'Previdência e longo prazo' },
  { pt: 'Sonhos e metas', en: 'Goals', type: 'expense', bucket: 'savings', basic: false, hint: 'Viagem, casa, carro' },
  // Income
  { pt: 'Salário', en: 'Salary', type: 'income', basic: true, hint: 'Salário e pró-labore' },
  { pt: 'Freelance', en: 'Freelance', type: 'income', basic: true, hint: 'Trabalhos avulsos' },
  { pt: 'Investimentos', en: 'Investment', type: 'income', basic: true, hint: 'Rendimentos e dividendos' },
  { pt: 'Reembolso', en: 'Refund', type: 'income', basic: true, hint: 'Dinheiro devolvido' },
  { pt: 'Presente', en: 'Gift', type: 'income', basic: true, hint: 'Dinheiro recebido de presente' },
  { pt: 'Bônus', en: 'Bonus', type: 'income', basic: false, hint: '13º, PLR e bônus' },
  { pt: 'Aluguel', en: 'Rental', type: 'income', basic: false, hint: 'Aluguel recebido' },
  { pt: 'Vendas', en: 'Sales', type: 'income', basic: false, hint: 'Vendas de itens ou serviços' },
  { pt: 'Benefícios', en: 'Benefits', type: 'income', basic: false, hint: 'Auxílios e benefícios' },
  { pt: 'Outros', en: 'Other', type: 'income', basic: true, hint: 'Outras entradas', protected: true },
];

const UNCATEGORIZED = { pt: 'Sem categoria', en: 'Uncategorized' };

const names = (lang, type, filter = () => true) => [
  ...CATEGORY_CATALOG.filter((c) => c.type === type && filter(c)).map((c) => c[lang]),
  UNCATEGORIZED[lang],
];

/** Every catalog name per language, in the shape the settings use ({ expense: [...], income: [...] }). */
export const catalogAll = (lang) => ({ expense: names(lang, 'expense'), income: names(lang, 'income') });
/** The categories that are on from the start. */
export const catalogBasics = (lang) => ({ expense: names(lang, 'expense', (c) => c.basic), income: names(lang, 'income', (c) => c.basic) });

/** Default budget group of every catalog expense category, by name in both languages. */
export const CATALOG_RULE_MAPPING = Object.fromEntries(
  CATEGORY_CATALOG.filter((c) => c.type === 'expense').flatMap((c) => [[c.pt, c.bucket], [c.en, c.bucket]]),
);

/** pt <-> en pairs for every catalog category, merged into the settings translation map. */
export const CATALOG_TRANSLATIONS = Object.fromEntries(
  CATEGORY_CATALOG.filter((c) => c.pt !== c.en).flatMap((c) => [[c.pt, c.en], [c.en, c.pt]]),
);

export const catalogEntry = (name) => CATEGORY_CATALOG.find((c) => c.pt === name || c.en === name) ?? null;
