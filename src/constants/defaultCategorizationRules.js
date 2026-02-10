// Default categorization rules for Brazilian transactions
// These rules are used to auto-categorize imported transactions based on description patterns

export const DEFAULT_RULES = [
  // ========================================
  // EXPENSE CATEGORIES
  // ========================================

  // Moradia (Housing) - Priority 10
  {
    keywords: [
      'ALUGUEL', 'CONDOMINIO', 'CONDOMÍNIO', 'IPTU', 'SEGURO RESIDENCIAL',
      'IMOBILIARIA', 'IMOBILIÁRIA', 'LOCACAO', 'LOCAÇÃO', 'TAXA COND',
      'FUNDO RESERVA', 'AGUA COND', 'GAS COND', 'MANUTENCAO PREDIO',
      'PORTARIA', 'SINDICO', 'LOPES', 'QUINTO ANDAR', 'QUINTOANDAR', 'ZAP IMOVEIS'
    ],
    category: 'Moradia',
    type: 'expense',
    priority: 10
  },

  // Contas (Bills/Utilities) - Priority 10
  {
    keywords: [
      // Electricity
      'ENERGIA', 'LUZ', 'ENEL', 'CPFL', 'CEMIG', 'LIGHT', 'CELPE', 'COELBA',
      'COELCE', 'COSERN', 'ELEKTRO', 'CELESC', 'COPEL', 'CEEE', 'CEMAR',
      'EQUATORIAL', 'EDP', 'NEOENERGIA', 'ENERGISA',
      // Water
      'AGUA', 'SABESP', 'CEDAE', 'CAGECE', 'COMPESA', 'CAESB', 'COPASA',
      'SANEPAR', 'CORSAN', 'EMBASA', 'CAERN', 'SANEAGO',
      // Gas
      'GAS', 'COMGAS', 'NATURGY', 'GAS NATURAL', 'CASAN', 'GAS BRASILIANO',
      'SULGÁS', 'MSGÁS', 'COMPAGÁS',
      // Internet/Phone/TV
      'INTERNET', 'TELEFONE', 'CELULAR', 'VIVO', 'CLARO', 'TIM', 'OI',
      'NET', 'TELECOM', 'FIBRA', 'BANDA LARGA', 'ALGAR', 'BRISANET',
      'DESKTOP', 'UNIFIQUE', 'SERCOMTEL', 'GVT', 'SKY', 'DIRECTV'
    ],
    category: 'Contas',
    type: 'expense',
    priority: 10
  },

  // Veiculo/Transporte (Transportation) - Priority 10
  {
    keywords: [
      // Fuel
      'GASOLINA', 'COMBUSTIVEL', 'COMBUSTÍVEL', 'POSTO', 'SHELL', 'IPIRANGA',
      'BR DISTRIBUIDORA', 'PETROBRAS', 'VIBRA', 'ALE', 'TOTAL ENERGIES',
      'REDE PETROESTE', 'RAIZEN', 'ETANOL', 'ALCOOL', 'DIESEL', 'GNV',
      // Parking
      'ESTACIONAMENTO', 'ZONA AZUL', 'ESTAPAR', 'PARK', 'PARKING', 'VAGA',
      'SETCESP', 'INDIGO', 'ALLPARK',
      // Ride apps
      'UBER', '99', 'TAXI', 'TÁXI', 'CABIFY', '99POP', 'INDRIVER', '99APP',
      'UBER TRIP', 'UBER*', '99 PAY', 'LYFT', 'BLABLACAR', 'BUSER',
      // Public transport
      'METRO', 'METRÔ', 'ONIBUS', 'ÔNIBUS', 'BILHETE UNICO', 'BILHETE ÚNICO',
      'VEM', 'BOM', 'CARTAO TRANSPORTE', 'SPTRANS', 'CPTM', 'BARCAS',
      // Vehicle expenses
      'SEGURO AUTO', 'IPVA', 'LICENCIAMENTO', 'DETRAN', 'MECANICO', 'MECÂNICO',
      'OFICINA', 'LAVA JATO', 'LAVA RAPIDO', 'LAVA RÁPIDO', 'AUTO PECAS',
      'AUTOPEÇAS', 'PNEU', 'BORRACHARIA', 'TROCA DE OLEO', 'ÓLEO', 'DPVAT',
      'MULTA TRANSITO', 'MULTA TRÂNSITO', 'PEDAGIO', 'PEDÁGIO', 'VELOE',
      'SEMPARAR', 'CONECTCAR', 'MOVE MAIS', 'TAGGY', 'TOLLPLUS'
    ],
    category: 'Veículo',
    type: 'expense',
    priority: 10
  },

  // Alimentacao (Food) - Priority 10
  {
    keywords: [
      // Delivery apps
      'IFOOD', 'RAPPI', 'UBER EATS', 'UBEREATS', '99 FOOD', 'ZDELIVERY',
      'AIQFOME', 'JAMES DELIVERY', 'DELIVEROO',
      // Payment patterns (common in Brazil)
      'PAG*', 'PAG *', 'PAGSEGURO', 'MAQUININHA',
      // Supermarkets
      'MERCADO', 'SUPERMERCADO', 'SUPER', 'CARREFOUR', 'EXTRA', 'PAO DE ACUCAR',
      'PÃO DE AÇÚCAR', 'ASSAI', 'ASSAÍ', 'ATACADAO', 'ATACADÃO', 'BIG',
      'WALMART', 'SAM\'S CLUB', 'SAMS CLUB', 'MAKRO', 'MAXXI', 'DIA',
      'HIROTA', 'ST MARCHE', 'ZONA SUL', 'GUANABARA', 'PREZUNIC', 'MUNDIAL',
      'MATEUS', 'MIX MATEUS', 'NORDESTAO', 'NORDESTÃO', 'COMPER', 'CONDOR',
      'ANGELONI', 'ZAFFARI', 'NACIONAL', 'IMPERATRIZ', 'FORT ATACADISTA',
      'TENDA', 'REDE ECONOMIA', 'SUPERNOSSO', 'VERDEMAR', 'HORTIFRUTI',
      // Bakeries and food shops
      'PADARIA', 'PANIFICADORA', 'CONFEITARIA', 'DOCERIA', 'ACOUGUE',
      'AÇOUGUE', 'PEIXARIA', 'MERCEARIA', 'EMPORIO', 'EMPÓRIO', 'QUITANDA',
      // Restaurants and fast food
      'RESTAURANTE', 'LANCHONETE', 'FAST FOOD', 'BURGUER', 'BURGER', 'PIZZA',
      'PIZZARIA', 'SUSHI', 'JAPONESA', 'CHURRASCARIA', 'RODIZIO', 'RODÍZIO',
      'BAR ', 'BOTECO', 'CHOPERIA', 'CERVEJARIA', 'PUB', 'BISTR',
      'MCDONALDS', 'MC DONALDS', 'MCDONALD\'S', 'BURGER KING', 'BK ',
      'HABIB\'S', 'HABIBS', 'SUBWAY', 'KFC', 'POPEYES', 'BOBS', 'BOB\'S',
      'GIRAFFAS', 'OUTBACK', 'APPLEBEES', 'APPLEBEE\'S', 'SPOLETO', 'COCO BAMBU',
      'MADERO', 'FOGO DE CHAO', 'FOGO DE CHÃO', 'BULLGUER', 'PARIS 6',
      'JERONIMO', 'JERÔNIMO', 'THE FIFTIES', 'VIENA', 'STERNA', 'AMOR ACAI',
      // Coffee shops
      'CAFE', 'CAFÉ', 'COFFEE', 'STARBUCKS', 'FRAN\'S CAFE', 'FRAN\'S CAFÉ',
      'LIVRARIA CULTURA', 'KOPENHAGEN', 'CACAU SHOW', 'BRASIL CACAU',
      'CHOCOLATE', 'SORVETE', 'SORVETERIA', 'GELATERIA', 'ICE CREAM',
      'ACAI', 'AÇAÍ', 'OAKBERRY', 'CASA DO PAO', 'CASA DO PÃO'
    ],
    category: 'Alimentação',
    type: 'expense',
    priority: 10
  },

  // Saude (Healthcare) - Priority 10
  {
    keywords: [
      // Pharmacies
      'FARMACIA', 'FARMÁCIA', 'DROGARIA', 'DROGA ', 'DROGASIL', 'DROGA RAIA',
      'RAIA DROGASIL', 'PAGUE MENOS', 'DROGARIAS PACHECO', 'VENANCIO',
      'DROGARIA SAO PAULO', 'DROGARIA SÃO PAULO', 'PANVEL', 'NISSEI',
      'PREÇO POPULAR', 'PRECO POPULAR', 'DROGAL', 'EXTRAFARMA', 'ARAUJO',
      'ARAÚJO', 'DROGARIA CATARINENSE', 'POPULAR FARMA', 'ULTRAFARMA',
      // Hospitals and clinics
      'HOSPITAL', 'CLINICA', 'CLÍNICA', 'MEDICO', 'MÉDICO', 'LABORATORIO',
      'LABORATÓRIO', 'LAB ', 'EXAME', 'CONSULTA', 'DIAGNOSTICO', 'DIAGNÓSTICO',
      'FLEURY', 'DASA', 'ALBERT EINSTEIN', 'SIRIO LIBANES', 'SÍRIO LIBANÊS',
      'SAO LUIZ', 'SÃO LUIZ', 'SAMARITANO', 'OSWALDO CRUZ', 'SANTA CASA',
      'LAVOISIER', 'HERMES PARDINI', 'HEMOCORD', 'RICHET', 'WEINMANN',
      // Dentist
      'DENTISTA', 'ODONTO', 'ORTODONTIA', 'SORRIDENTS', 'ODONTOCLINIC',
      // Health insurance
      'PLANO DE SAUDE', 'PLANO DE SAÚDE', 'UNIMED', 'AMIL', 'BRADESCO SAUDE',
      'BRADESCO SAÚDE', 'SULAMERICA', 'SULAM', 'NOTREDAME', 'GNDI', 'HAPVIDA',
      'INTERMEDI', 'INTERMÉDICA', 'PREVENT SENIOR', 'CASSI', 'OMINT',
      'ALLIANZ SAUDE', 'PORTO SEGURO SAUDE', 'GOLDEN CROSS',
      // Specialties
      'PSICO', 'FISIO', 'OFTALMOL', 'DERMATO', 'GINECO', 'PEDIATRA',
      'ORTOPEDIA', 'CARDIO', 'NUTRI', 'OTORRINO', 'UROLOG', 'GASTRO',
      // Optical
      'OTICA', 'ÓTICA', 'OPTICA', 'ÓPTICA', 'OCULOS', 'ÓCULOS', 'LENTES'
    ],
    category: 'Saúde',
    type: 'expense',
    priority: 10
  },

  // Educacao (Education) - Priority 10
  {
    keywords: [
      // Schools and universities
      'ESCOLA', 'FACULDADE', 'UNIVERSIDADE', 'COLEGIO', 'COLÉGIO', 'UNI ',
      'MENSALIDADE', 'MATRÍCULA', 'MATRICULA', 'MATERIAL ESCOLAR',
      'FGV', 'INSPER', 'PUC', 'USP', 'UNICAMP', 'UNESP', 'UNIFESP',
      'ESTACIO', 'ESTÁCIO', 'ANHANGUERA', 'UNINOVE', 'UNIP', 'MACKENZIE',
      'IBMEC', 'FAAP', 'ESPM', 'SENAC', 'SENAI', 'SESI', 'SESC',
      // Online courses
      'CURSO', 'UDEMY', 'COURSERA', 'ALURA', 'ROCKETSEAT', 'ORIGAMID',
      'HOTMART', 'EDUZZ', 'MONETIZZE', 'EADBOX', 'DESCOMPLICA', 'PLATZI',
      'LINKEDIN LEARNING', 'SKILLSHARE', 'MASTERCLASS', 'KHAN ACADEMY',
      'DUOLINGO', 'BABBEL', 'BUSUU', 'CAMBLY', 'ITALKI', 'PREPLY',
      // Books and materials
      'LIVRO', 'LIVRARIA', 'SARAIVA', 'CULTURA', 'AMAZON BOOKS', 'ESTANTE',
      'TRAVESSA', 'LEITURA', 'CURITIBA', 'KINDLE'
    ],
    category: 'Educação',
    type: 'expense',
    priority: 10
  },

  // Lazer (Leisure/Entertainment) - Priority 10
  {
    keywords: [
      // Cinema and shows
      'CINEMA', 'CINEMARK', 'CINEPOLIS', 'KINOPLEX', 'UCI', 'CINESYSTEM',
      'MOVIECOM', 'CINEARTE', 'PLAYARTE', 'TOPAZIO', 'CINESERCLA',
      'TEATRO', 'SHOW', 'INGRESSO', 'EVENTIM', 'TICKET', 'INGRESSORAPIDO',
      'SYMPLA', 'INGRESSE', 'LIVEPASS', 'TICKETS', 'BILHETERIA',
      // Parks and attractions
      'PARQUE', 'DIVERSAO', 'DIVERSÃO', 'BETO CARRERO', 'HOT BEACH',
      'BEACH PARK', 'ACQUA', 'HOPI HARI', 'PLAYCENTER', 'LEGOLAND',
      'ZOOLOGICO', 'ZOOLÓGICO', 'AQUARIO', 'AQUÁRIO', 'MUSEU', 'EXPOSICAO',
      // Games
      'STEAM', 'PLAYSTATION', 'PSN', 'PS PLUS', 'PS5', 'PS4', 'XBOX',
      'NINTENDO', 'ESHOP', 'SWITCH', 'GAME', 'JOGO', 'EPIC GAMES',
      'RIOT GAMES', 'EA SPORTS', 'BLIZZARD', 'GARENA', 'UBISOFT',
      'GAME PASS', 'GEFORCE NOW', 'NVIDIA', 'NUUVEM', 'GOG',
      // Sports and fitness
      'ACADEMIA', 'SMART FIT', 'BLUEFIT', 'SELFIT', 'BODYTECH', 'BIO RITMO',
      'CROSSFIT', 'SPINNING', 'YOGA', 'PILATES', 'PERSONAL', 'NATACAO',
      'NATAÇÃO', 'CLUB', 'CLUBE', 'SOCIEDADE', 'QUADRA', 'TENIS', 'TÊNIS',
      'GOLFE', 'ESCALADA', 'BOULDER', 'SURF', 'SKATE', 'CORRIDA',
      // Hobbies
      'HOBBY', 'ARTESANATO', 'LOJA DE ARTE', 'PINTURA', 'MUSICA', 'MÚSICA',
      'INSTRUMENTO', 'AULA DE ', 'DANCA', 'DANÇA', 'BALLET', 'BALÉ'
    ],
    category: 'Lazer',
    type: 'expense',
    priority: 10
  },

  // Vestuario (Clothing) - Priority 10
  {
    keywords: [
      // Fashion retail
      'RENNER', 'RIACHUELO', 'C&A', 'CEA', 'ZARA', 'H&M', 'FOREVER 21',
      'HERING', 'MARISA', 'PERNAMBUCANAS', 'LEADER', 'TORRA TORRA',
      'BESNI', 'LOJAS MEL', 'POMPEIA', 'BROOKSFIELD', 'ELLUS', 'CALVIN KLEIN',
      'TOMMY HILFIGER', 'LACOSTE', 'POLO RALPH', 'ARAMIS', 'DUDALINA',
      'FORUM', 'TRITON', 'COLCCI', 'ANIMALE', 'FARM', 'CANTAO', 'CANTÃO',
      'MARIA FILO', 'MARIA FILÓ', 'LE LIS', 'SHOULDER', 'MORENA ROSA',
      'JOHN JOHN', 'OSKLEN', 'RICHARDS', 'VIA MIA', 'AREZZO', 'SCHUTZ',
      'ANACAPRI', 'SANTA LOLLA', 'LOUCOS E SANTOS', 'ADIDAS', 'NIKE',
      'PUMA', 'MIZUNO', 'ASICS', 'NEW BALANCE', 'REEBOK', 'FILA', 'VANS',
      'CONVERSE', 'ALL STAR', 'HAVAIANAS', 'IPANEMA', 'MELISSA', 'RIDER',
      // Sports retail
      'CENTAURO', 'NETSHOES', 'DECATHLON', 'WORLDS TENNIS', 'AUTHENTIC FEET',
      'ARTWALK', 'FOOTLOCKER', 'FOOT LOCKER', 'LOJA DO SPORT', 'ESPORTE',
      // Shoes and accessories
      'CALCADO', 'CALÇADO', 'SAPATO', 'SAPATARIA', 'TENIS ', 'TÊNIS ',
      'ROUPA', 'MODA', 'BOUTIQUE', 'ALFAIATARIA', 'COSTURA', 'ATELIER',
      'JOALHERIA', 'RELOJOARIA', 'VIVARA', 'PANDORA', 'SWAROVSKI',
      'MONTE CARLO', 'HSTERN', 'H.STERN', 'TIFFANY', 'OTICA ', 'ÓTICA '
    ],
    category: 'Vestuário',
    type: 'expense',
    priority: 10
  },

  // Impostos (Taxes) - Priority 10
  {
    keywords: [
      'IMPOSTO', 'IR ', 'IRPF', 'IRPJ', 'DARF', 'GUIA', 'GPS', 'INSS',
      'TRIBUTO', 'RECEITA FEDERAL', 'TAXA ', 'ISS', 'ICMS', 'PIS', 'COFINS',
      'CSLL', 'IOF', 'ITR', 'ITBI', 'ITCMD', 'TFE', 'ALVARA', 'ALVARÁ',
      'LICENCA', 'LICENÇA', 'PREFEITURA', 'SECRETARIA', 'FAZENDA',
      'DAS SIMPLES', 'SIMPLES NACIONAL', 'MEI', 'CARNELEAO', 'CARNÊ-LEÃO'
    ],
    category: 'Impostos',
    type: 'expense',
    priority: 10
  },

  // Assinaturas (Subscriptions) - Priority 10
  {
    keywords: [
      // Streaming video
      'NETFLIX', 'SPOTIFY', 'DISNEY', 'DISNEY+', 'AMAZON PRIME', 'PRIME VIDEO',
      'HBO', 'HBO MAX', 'HBOMAX', 'GLOBOPLAY', 'GLOBO PLAY', 'PARAMOUNT',
      'PARAMOUNT+', 'APPLE TV', 'APPLETV', 'YOUTUBE', 'YOUTUBE PREMIUM',
      'CRUNCHYROLL', 'FUNIMATION', 'MUBI', 'TELECINE', 'NOW', 'CLARO TV',
      'PLUTO TV', 'STAR+', 'STARPLUS', 'DISCOVERY+', 'DISCOVERY PLUS',
      'STARZPLAY', 'DAZN', 'ESPN+', 'LOOKE', 'OLDFLIX', 'CURTAON',
      // Streaming music
      'APPLE MUSIC', 'DEEZER', 'TIDAL', 'AMAZON MUSIC', 'YOUTUBE MUSIC',
      'SOUNDCLOUD', 'NAPSTER',
      // Games subscriptions
      'TWITCH', 'XBOX GAME PASS', 'EA PLAY', 'UBISOFT+', 'PLAYSTATION NOW',
      'GEFORCE NOW',
      // Cloud storage
      'ICLOUD', 'GOOGLE ONE', 'DROPBOX', 'ONEDRIVE', 'BOX', 'MEGA',
      // Software
      'ADOBE', 'CREATIVE CLOUD', 'MICROSOFT 365', 'OFFICE 365', 'CANVA',
      'FIGMA', 'NOTION', 'SLACK', 'ZOOM', 'GRAMMARLY', 'EVERNOTE',
      'LASTPASS', '1PASSWORD', 'NORDVPN', 'EXPRESSVPN', 'SURFSHARK',
      // Reading
      'KINDLE UNLIMITED', 'AUDIBLE', 'SCRIBD', 'AMAZON READING',
      'FOLHA', 'ESTADAO', 'ESTADÃO', 'O GLOBO', 'VALOR', 'EXAME',
      'REVISTA', 'ASSINATURA', 'ASSINE', 'PLANO MENSAL', 'PLANO ANUAL',
      // Other
      'LINKEDIN PREMIUM', 'TINDER', 'BUMBLE', 'HAPPN', 'BADOO'
    ],
    category: 'Assinaturas',
    type: 'expense',
    priority: 10
  },

  // Viagens (Travel) - Priority 10
  {
    keywords: [
      // Accommodation
      'HOTEL', 'POUSADA', 'HOSTEL', 'AIRBNB', 'BOOKING', 'BOOKING.COM',
      'HOTELS.COM', 'EXPEDIA', 'TRIVAGO', 'HURB', 'DECOLAR', 'CVCVIAGENS',
      'CVC', 'SUBMARINO VIAGENS', 'DESPEGAR', '123MILHAS', 'MAXMILHAS',
      // Airlines
      'PASSAGEM', 'AEREO', 'AÉREO', 'VOO', 'LATAM', 'GOL', 'AZUL', 'AVIANCA',
      'TAP', 'COPA', 'AMERICAN AIRLINES', 'UNITED', 'DELTA', 'EMIRATES',
      'AIR FRANCE', 'KLM', 'LUFTHANSA', 'BRITISH AIRWAYS', 'IBERIA',
      'AEROPORTO', 'AIRPORT', 'TAXA EMBARQUE', 'BAGAGEM',
      // Ground transport
      'RODOVIARIA', 'RODOVIÁRIA', 'RODOVIARIO', 'RODOVIÁRIO', 'ONIBUS ',
      'ÔNIBUS ', 'VIACAO', 'VIAÇÃO', 'COMETA', '1001', 'CATARINENSE',
      'ITAPEMIRIM', 'PLANALTO', 'MARCOPOLO', 'CLICKBUS', 'BUSER',
      // Car rental
      'LOCADORA', 'ALUGUEL CARRO', 'RENT A CAR', 'LOCALIZA', 'MOVIDA',
      'UNIDAS', 'HERTZ', 'AVIS', 'BUDGET', 'NATIONAL', 'ENTERPRISE',
      // Travel misc
      'VIAGEM', 'TURISMO', 'TOUR', 'EXCURSAO', 'EXCURSÃO', 'CRUZEIRO',
      'SEGURO VIAGEM', 'VISTO', 'VISA ', 'CONSULADO', 'EMBAIXADA'
    ],
    category: 'Viagens',
    type: 'expense',
    priority: 10
  },

  // Compras/Shopping (General Shopping) - Priority 8 (lower to allow specific categories to match first)
  {
    keywords: [
      // E-commerce
      'AMAZON', 'MERCADO LIVRE', 'MERCADOLIVRE', 'ML ', 'MAGALU',
      'MAGAZINE LUIZA', 'AMERICANAS', 'SHOPEE', 'ALIEXPRESS', 'SHEIN',
      'CASAS BAHIA', 'PONTO FRIO', 'EXTRA.COM', 'VIA VAREJO', 'SUBMARINO',
      'SHOPTIME', 'B2W', 'KABUM', 'TERABYTE', 'PICHAU', 'FAST SHOP',
      'GIRAFA', 'POLISHOP', 'COLOMBO', 'LOJA ', 'STORE', 'ELETRO',
      // Department stores
      'LOJAS AMERICANAS', 'HAVAN', 'BEMOL', 'GAZIN', 'ELETROZEMA',
      'RICARDO ELETRO', 'CITY LAR', 'NOVO MUNDO', 'MARABRAZ',
      // Home goods
      'LEROY MERLIN', 'TELHANORTE', 'C&C', 'DICICO', 'SODIMAC',
      'FERREIRA COSTA', 'COPAFER', 'QUERO-QUERO', 'TINTAS ', 'SUVINIL',
      'CORAL', 'TOKSTOK', 'TOK STOK', 'ETNA', 'CAMICADO', 'CASA SHOW',
      'LE BISCUIT', 'INOVATHI', 'LOJAS KD', 'MADEIRA MADEIRA',
      // Pets
      'PET', 'PETZ', 'COBASI', 'PETLOVE', 'ANIMAL', 'VETERINARIO',
      'VETERINÁRIO', 'CLINICA VET', 'CLÍNICA VET', 'RACAO', 'RAÇÃO'
    ],
    category: 'Diversos',
    type: 'expense',
    priority: 8
  },

  // Doacao/Caridade (Donations/Charity) - Priority 9
  {
    keywords: [
      'DOACAO', 'DOAÇÃO', 'CARIDADE', 'ONG', 'FUNDACAO', 'FUNDAÇÃO',
      'INSTITUTO', 'CONTRIBUICAO', 'CONTRIBUIÇÃO', 'VAQUINHA',
      'CATARSE', 'KICKSTARTER', 'APOIA.SE', 'PADRIM', 'PICPAY DOACAO',
      'CRUZ VERMELHA', 'MEDICOS SEM FRONTEIRAS', 'MSF', 'UNICEF',
      'AACD', 'CRIANCA ESPERANCA', 'TELETON', 'APADRIN'
    ],
    category: 'Doações',
    type: 'expense',
    priority: 9
  },

  // Servicos Pessoais (Personal Services) - Priority 9
  {
    keywords: [
      'SALAO', 'SALÃO', 'BARBEARIA', 'CABELEIREIRO', 'MANICURE', 'PEDICURE',
      'ESTETICA', 'ESTÉTICA', 'SPA', 'MASSAGEM', 'DEPILACAO', 'DEPILAÇÃO',
      'TATUAGEM', 'TATTOO', 'PIERCING', 'SOBRANCELHA'
    ],
    category: 'Cuidados Pessoais',
    type: 'expense',
    priority: 9
  },

  // ========================================
  // INCOME CATEGORIES (Higher priority)
  // ========================================

  // Salario (Salary) - Priority 15
  {
    keywords: [
      'SALARIO', 'SALÁRIO', 'PAGAMENTO RECEBIDO', 'PAGTO RECEBIDO',
      'FOLHA DE PAGAMENTO', 'FOLHA PAGTO', 'HOLERITE', 'CONTRA CHEQUE',
      'ADIANTAMENTO SALARIO', 'ADIANTAMENTO SALARIAL', 'FERIAS', 'FÉRIAS',
      '13 SALARIO', '13º SALÁRIO', 'DECIMO TERCEIRO', 'PLR', 'PPR',
      'BONUS', 'BÔNUS', 'GRATIFICACAO', 'GRATIFICAÇÃO', 'COMISSAO', 'COMISSÃO'
    ],
    category: 'Salário',
    type: 'income',
    priority: 15
  },

  // Renda (General Income) - Priority 15
  {
    keywords: [
      'TRANSFERENCIA RECEBIDA', 'TRANSFERÊNCIA RECEBIDA',
      'PIX RECEBIDO', 'PIX REC', 'RECEBIDO PIX',
      'TED RECEBIDO', 'TED REC', 'RECEBIDO TED',
      'DOC RECEBIDO', 'DOC REC', 'RECEBIDO DOC',
      'CREDITO EM CONTA', 'CRÉDITO EM CONTA', 'CREDITO CONTA',
      'DEPOSITO', 'DEPÓSITO', 'DEP ', 'DEP.',
      'RECEBIDA', 'RECEBIDO', 'ENTRADA', 'CREDIT'
    ],
    category: 'Renda',
    type: 'income',
    priority: 15
  },

  // Investimentos (Investment Income) - Priority 14
  {
    keywords: [
      'INVESTIMENTO', 'RENDIMENTO', 'DIVIDENDO', 'JCP', 'JSCP',
      'JUROS SOBRE CAPITAL', 'JUROS', 'APLICACAO', 'APLICAÇÃO',
      'RESGATE', 'LIQUIDACAO', 'LIQUIDAÇÃO', 'RENTABILIDADE',
      'TESOURO DIRETO', 'CDB', 'LCI', 'LCA', 'DEBENTURE', 'DEBÊNTURE',
      'FII', 'FUNDO IMOBIL', 'ACAO', 'AÇÃO', 'PROVENTOS', 'AMORTIZACAO',
      'BONIFICACAO', 'BONIFICAÇÃO', 'VENDA ATIVOS', 'LUCRO VENDA'
    ],
    category: 'Investimentos',
    type: 'income',
    priority: 14
  },

  // Freelance - Priority 14
  {
    keywords: [
      'FREELA', 'FREELANCE', 'SERVICO PRESTADO', 'SERVIÇO PRESTADO',
      'NOTA FISCAL', 'NF-E', 'NFS-E', 'RECIBO', 'RPA', 'AUTÔNOMO',
      'AUTONOMO', 'PRESTACAO SERVICO', 'PRESTAÇÃO SERVIÇO',
      'CONSULTORIA', 'ASSESSORIA', 'PROJETO', 'HONORARIO', 'HONORÁRIO'
    ],
    category: 'Freelance',
    type: 'income',
    priority: 14
  },

  // Reembolso (Refund) - Priority 14
  {
    keywords: [
      'REEMBOLSO', 'DEVOLUCAO', 'DEVOLUÇÃO', 'ESTORNO', 'CANCELAMENTO',
      'REFUND', 'CASHBACK', 'CASH BACK', 'CHARGEBACK', 'RESSARCIMENTO',
      'RESTITUICAO', 'RESTITUIÇÃO', 'INDENIZACAO', 'INDENIZAÇÃO'
    ],
    category: 'Reembolso',
    type: 'income',
    priority: 14
  },

  // Presente/Outros (Gift/Other Income) - Priority 13
  {
    keywords: [
      'PRESENTE', 'GIFT', 'PREMIO', 'PRÊMIO', 'SORTEIO', 'LOTERIA',
      'MEGA SENA', 'QUINA', 'LOTOFACIL', 'LOTERICA', 'LOTÉRICA',
      'HERANCA', 'HERANÇA', 'DOACAO RECEBIDA', 'DOAÇÃO RECEBIDA'
    ],
    category: 'Outros',
    type: 'income',
    priority: 13
  }
];

/**
 * Categorize a transaction based on its description
 * @param {string} description - Transaction description
 * @param {Array} customRules - Optional custom rules (user-defined) to apply first
 * @returns {Object|null} - { category, type, matchedKeyword, confidence } or null if no match
 */
export function categorizeTransaction(description, customRules = []) {
  if (!description) return null;

  // Combine custom rules with defaults, custom rules first
  const allRules = [...customRules, ...DEFAULT_RULES];

  // Normalize description: uppercase, remove accents
  const normalizedDesc = description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Sort by priority (descending)
  const sortedRules = [...allRules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const rule of sortedRules) {
    // Skip inactive rules
    if (rule.isActive === false) continue;

    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Check for pattern match (supports * wildcard at end)
      if (normalizedKeyword.endsWith('*')) {
        const prefix = normalizedKeyword.slice(0, -1);
        if (normalizedDesc.includes(prefix)) {
          return {
            category: rule.category,
            type: rule.type,
            matchedKeyword: keyword,
            confidence: 1.0
          };
        }
      } else if (normalizedDesc.includes(normalizedKeyword)) {
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

/**
 * Get all unique categories from the default rules
 */
export function getDefaultCategories() {
  const expenseCategories = new Set();
  const incomeCategories = new Set();

  for (const rule of DEFAULT_RULES) {
    if (rule.type === 'expense') {
      expenseCategories.add(rule.category);
    } else if (rule.type === 'income') {
      incomeCategories.add(rule.category);
    }
  }

  return {
    expense: Array.from(expenseCategories),
    income: Array.from(incomeCategories)
  };
}
