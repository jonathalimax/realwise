export const DEFAULT_RULES = [
  // Moradia (Housing)
  {
    keywords: ['ALUGUEL', 'CONDOMINIO', 'IPTU', 'SEGURO RESIDENCIAL', 'IMOBILIARIA', 'LOCACAO'],
    category: 'Moradia',
    type: 'expense',
    priority: 10
  },
  // Contas (Bills)
  {
    keywords: ['ENERGIA', 'LUZ', 'AGUA', 'GAS', 'INTERNET', 'TELEFONE', 'CELULAR', 'VIVO', 'CLARO', 'TIM', 'OI', 'NET', 'COMGAS', 'SABESP', 'ENEL', 'CPFL', 'CEMIG', 'LIGHT'],
    category: 'Contas',
    type: 'expense',
    priority: 10
  },
  // Veículo (Vehicle)
  {
    keywords: ['GASOLINA', 'COMBUSTIVEL', 'POSTO', 'SHELL', 'IPIRANGA', 'BR', 'PETROBRAS', 'ESTACIONAMENTO', 'ZONA AZUL', 'UBER', '99', 'TAXI', 'CABIFY', '99POP', 'INDRIVER', 'LYFT', 'SEGURO AUTO', 'IPVA', 'LICENCIAMENTO', 'DETRAN', 'MECANICO', 'OFICINA', 'LAVA JATO'],
    category: 'Veículo',
    type: 'expense',
    priority: 10
  },
  // Alimentação (Food)
  {
    keywords: ['IFOOD', 'RAPPI', 'RESTAURANTE', 'LANCHONETE', 'PADARIA', 'MERCADO', 'SUPERMERCADO', 'CARREFOUR', 'EXTRA', 'PAO DE ACUCAR', 'ASSAI', 'ATACADAO', 'BIG', 'WALMART', 'HORTIFRUTI', 'ACOUGUE', 'PEIXARIA'],
    category: 'Alimentação',
    type: 'expense',
    priority: 10
  },
  // Saúde (Healthcare)
  {
    keywords: ['FARMACIA', 'DROGARIA', 'HOSPITAL', 'CLINICA', 'MEDICO', 'LABORATORIO', 'DROGA', 'RAIA', 'PACHECO', 'SAO PAULO', 'PAGUE MENOS', 'DENTISTA', 'ODONTO', 'CONSULTA', 'EXAME', 'PLANO DE SAUDE', 'UNIMED', 'AMIL', 'BRADESCO SAUDE'],
    category: 'Saúde',
    type: 'expense',
    priority: 10
  },
  // Educação (Education)
  {
    keywords: ['ESCOLA', 'FACULDADE', 'UNIVERSIDADE', 'CURSO', 'UDEMY', 'COURSERA', 'ALURA', 'MENSALIDADE', 'MATERIAL ESCOLAR', 'LIVRO', 'LIVRARIA'],
    category: 'Educação',
    type: 'expense',
    priority: 10
  },
  // Lazer (Leisure/Entertainment)
  {
    keywords: ['CINEMA', 'TEATRO', 'SHOW', 'INGRESSO', 'PARQUE', 'DIVERSAO', 'STEAM', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'GAME', 'JOGO'],
    category: 'Lazer',
    type: 'expense',
    priority: 10
  },
  // Vestuário (Clothing)
  {
    keywords: ['RENNER', 'RIACHUELO', 'C&A', 'ZARA', 'HERING', 'MARISA', 'CENTAURO', 'NETSHOES', 'CALCADO', 'SAPATO', 'ROUPA', 'MODA'],
    category: 'Vestuário',
    type: 'expense',
    priority: 10
  },
  // Impostos (Taxes)
  {
    keywords: ['IMPOSTO', 'IR', 'IRPF', 'DARF', 'GUIA', 'TAXA', 'TRIBUTO', 'RECEITA FEDERAL'],
    category: 'Impostos',
    type: 'expense',
    priority: 10
  },
  // Assinaturas (Subscriptions)
  {
    keywords: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'AMAZON PRIME', 'HBO', 'GLOBOPLAY', 'PARAMOUNT', 'APPLE TV', 'YOUTUBE', 'TWITCH', 'APPLE MUSIC', 'DEEZER', 'ICLOUD', 'GOOGLE ONE', 'DROPBOX'],
    category: 'Assinaturas',
    type: 'expense',
    priority: 10
  },
  // Viagens (Travel)
  {
    keywords: ['HOTEL', 'POUSADA', 'AIRBNB', 'BOOKING', 'DECOLAR', 'PASSAGEM', 'AEREO', 'LATAM', 'GOL', 'AZUL', 'RODOVIARIA', 'ONIBUS'],
    category: 'Viagens',
    type: 'expense',
    priority: 10
  },
  // Shopping/Compras -> Diversos for general shopping
  {
    keywords: ['AMAZON', 'MERCADO LIVRE', 'MAGALU', 'MAGAZINE LUIZA', 'AMERICANAS', 'SHOPEE', 'ALIEXPRESS', 'CASAS BAHIA', 'PONTO FRIO'],
    category: 'Diversos',
    type: 'expense',
    priority: 8
  },
  // Income categories - these should have high priority to override expense detection
  {
    keywords: ['SALARIO', 'PAGAMENTO RECEBIDO', 'DEPOSITO'],
    category: 'Salário',
    type: 'income',
    priority: 15
  },
  {
    keywords: [
      'TRANSFERENCIA RECEBIDA',
      'TRANSFERÊNCIA RECEBIDA',
      'PIX RECEBIDO',
      'TED RECEBIDO',
      'DOC RECEBIDO',
      'CREDITO EM CONTA',
      'CREDITO CONTA',
      'RECEBIDA',
      'RECEBIDO'
    ],
    category: 'Renda',
    type: 'income',
    priority: 15
  },
  {
    keywords: ['INVESTIMENTO', 'RENDIMENTO', 'DIVIDENDO', 'JUROS', 'APLICACAO', 'RESGATE'],
    category: 'Investimentos',
    type: 'income',
    priority: 14
  }
];

export function categorizeTransaction(description, customRules = []) {
  const allRules = [...customRules, ...DEFAULT_RULES];
  const normalizedDesc = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Sort by priority (descending)
  const sortedRules = [...allRules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of sortedRules) {
    if (rule.isActive === false) continue;

    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedDesc.includes(normalizedKeyword)) {
        return {
          category: rule.category,
          type: rule.type,
          matchedKeyword: keyword,
          confidence: 1.0
        };
      }
    }
  }

  return null; // No match found
}
