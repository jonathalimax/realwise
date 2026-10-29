// Central de Ajuda do admin: respostas prontas para suporte e vendas, alinhadas ao produto como ele funciona hoje
// (assistente Elio no chat, teste grátis de 3 dias sem cartão, assinatura mensal/anual pelo Stripe).
export const guideData = [
  {
    id: 'o-que-e',
    label: '📌 O que é',
    color: 'text-emerald-400',
    items: [
      {
        id: 'o-que-e-realwise',
        title: 'O que é o Realwise?',
        content: 'O Realwise é um assistente de finanças pessoais com IA. Em vez de preencher planilhas, você conversa com o Elio: conta seus objetivos, manda extratos e faturas, e ele organiza tudo, monta o seu plano e responde dúvidas sobre o seu dinheiro.\n\nFunciona no celular e no computador, em português, e você pode digitar ou falar no microfone.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'quem-e-elio',
        title: 'Quem é o Elio?',
        content: 'O Elio é o assistente financeiro do Realwise. Ele tem um jeito leve e direto de conversar e cuida de:\n• Conhecer suas contas, sua renda e seus objetivos logo no primeiro acesso\n• Montar um plano a partir da sua renda\n• Ler extratos e faturas (PDF, foto, CSV, XLSX, OFX) e categorizar cada lançamento\n• Cadastrar contas a pagar, lembrar dos vencimentos e dar baixa quando você diz "paguei"\n• Responder perguntas como "quanto gastei no mês passado?" ou "onde posso economizar?"\n• Lembrar do que você contou (objetivos e preferências)\n\nEle não é consultor financeiro licenciado: dá orientação geral e sugere um profissional em decisões de alto risco.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'para-quem',
        title: 'Para quem é indicado?',
        content: 'Para quem quer organizar o dinheiro sem trabalho manual: usa vários bancos ou cartões, não tem paciência para planilha, quer saber para onde o dinheiro vai e ter um plano para os objetivos (reserva, viagem, quitar dívida).',
        channels: ['whatsapp'],
      },
      {
        id: 'dados-seguros',
        title: 'Os meus dados ficam seguros?',
        content: 'Os dados são só do usuário e ficam protegidos conforme a LGPD. Para ler os extratos usamos IA com provedores configurados para não reter nem treinar com as informações enviadas.\n\nNão pedimos acesso à conta bancária: o usuário envia os arquivos que quiser. Ele pode ver, editar e apagar tudo o que o Elio lembra sobre ele em Configurações → "O que o Elio sabe sobre você", e pode excluir a conta a qualquer momento (a exclusão é imediata e permanente).',
        channels: ['whatsapp', 'email'],
      },
    ],
  },
  {
    id: 'preco',
    label: '💰 Preço e teste',
    color: 'text-sky-400',
    items: [
      {
        id: 'teste-gratis',
        title: 'Tem teste grátis?',
        content: 'Sim. São 3 dias grátis com tudo liberado, sem cadastrar cartão e sem pagar nada. Só depois do teste, se quiser continuar, a pessoa escolhe um plano. Se não assinar, o acesso fica pausado e os dados continuam guardados.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'quanto-custa',
        title: 'Quanto custa depois do teste?',
        content: 'Dois planos, cobrados pelo Stripe:\n• Mensal: R$ 8,99 por mês\n• Anual: R$ 74,90 por ano (equivale a cerca de R$ 6,24 por mês, mais de 30% de desconto)\n\nOs valores podem mudar: confirme sempre na tela de assinatura do app.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'cancelar',
        title: 'Como cancelar?',
        content: 'Quando quiser, em Configurações → Assinatura → Gerenciar assinatura. Sem multa e sem burocracia. O acesso continua até o fim do período já pago.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'cupom',
        title: 'Como usar um cupom de desconto?',
        content: 'Na tela de pagamento do Stripe há o campo para o código promocional. Os códigos são criados e desativados no admin, em Comunicação → Códigos promo.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'trocar-plano',
        title: 'Como trocar de plano, atualizar o cartão ou ver faturas?',
        content: 'Em Configurações → Assinatura → Gerenciar assinatura. Abre o portal seguro do Stripe, onde a pessoa troca mensal por anual, atualiza o cartão, baixa recibos e cancela.',
        channels: ['whatsapp', 'email'],
      },
      {
        id: 'acesso-pausado',
        title: 'O teste acabou e não consigo entrar. E agora?',
        content: 'O acesso fica pausado, mas nada é apagado: os dados voltam assim que a pessoa assinar. Basta abrir o app e escolher um plano na tela que aparece.',
        channels: ['whatsapp'],
      },
    ],
  },
  {
    id: 'funcionalidades',
    label: '⚙️ Funcionalidades',
    color: 'text-violet-400',
    items: [
      {
        id: 'chat',
        title: 'Chat com o Elio',
        content: 'É a porta de entrada de tudo. Por ele o usuário cadastra contas, manda extratos, registra gastos ("gastei 45 no mercado"), pergunta sobre o dinheiro, edita ou exclui lançamentos e marca contas como pagas.\n\nAlterações em vários itens e exclusões pedem confirmação antes. Exclusões são sempre reversíveis: o item fica oculto e o Elio pode restaurar.',
      },
      {
        id: 'voz',
        title: 'Falar com o Elio (voz)',
        content: 'No chat há um botão de microfone para ditar a mensagem em português e um botão de alto-falante para ouvir a resposta. Usa o reconhecimento de voz do próprio navegador, então a qualidade depende do aparelho.\n\nSe não funcionar: conferir a permissão de microfone do site nas configurações do navegador.',
      },
      {
        id: 'extratos',
        title: 'Enviar extratos e faturas',
        content: 'Pelo clipe do chat, o usuário anexa PDF, foto, CSV, XLSX ou OFX de qualquer banco, vários de uma vez. O Elio descobre a conta de cada arquivo (e pergunta se não tiver certeza), categoriza e salva. Lançamentos duplicados são ignorados. Os de categoria duvidosa aparecem numa folha para o usuário confirmar.\n\nTransferências entre contas do próprio usuário não entram nos totais de entrada e saída.',
      },
      {
        id: 'plano',
        title: 'Planejamento a partir da renda',
        content: 'No primeiro acesso o Elio pergunta a renda líquida e os objetivos, propõe a divisão entre necessidades, desejos e poupança e, com o "pode ser", salva o plano. O usuário ajusta depois conversando com o Elio ou na tela Planejamento.',
      },
      {
        id: 'home',
        title: 'Tela inicial (Home)',
        content: 'Mostra o resumo do mês (entradas, saídas, saldo), o gráfico Panorama, Gastos por categoria (com limite do plano e alertas de 75% e estouro), o card de Planejamento e Contas do mês.',
      },
      {
        id: 'contas-pagar',
        title: 'Contas a pagar e lembretes',
        content: 'O Elio cadastra contas (inclusive recorrentes) e o app envia um e-mail diário às 9h (Brasília) sobre o que vence. Dá para dar baixa por e-mail ou dizendo "paguei" no chat. Em Configurações é possível ligar ou desligar os lembretes.\n\nO sistema também percebe pagamentos que se repetem todo mês e sugere transformar em conta a pagar.',
      },
      {
        id: 'memoria',
        title: 'Memória do Elio',
        content: 'O Elio guarda fatos que o usuário disse (objetivos, preferências, contexto) para personalizar os conselhos. Nada é deduzido por conta própria. Em Configurações → "O que o Elio sabe sobre você" dá para ver, editar, adicionar e apagar cada item.',
      },
      {
        id: 'categorias-bancos',
        title: 'Categorias e bancos',
        content: 'Em Configurações → Categorias e Bancos o usuário gerencia categorias de entrada e saída e as contas/cartões (dia de fechamento e vencimento, titular). O Elio também faz essas alterações por conversa.',
      },
      {
        id: 'transacoes',
        title: 'Lançamentos',
        content: 'A tela Transações lista tudo e permite editar valor, data, categoria, conta e tipo (receita, despesa ou transferência). O Elio também edita por conversa ("muda o Uber de ontem para Transporte").',
      },
    ],
  },
  {
    id: 'onboarding',
    label: '🚀 Primeiro acesso',
    color: 'text-amber-400',
    items: [
      {
        id: 'passo-cadastro',
        title: 'Passo 1: criar a conta',
        content: 'Na página inicial, "Começar grátis" leva ao login. Não precisa de cartão. O teste de 3 dias começa no primeiro acesso.',
      },
      {
        id: 'passo-entrevista',
        title: 'Passo 2: conversa com o Elio',
        content: 'O chat abre sozinho e o Elio cria as categorias padrão. Depois conduz uma conversa curta, um passo por vez:\n1. Cadastro da primeira conta ou cartão (e outras, se houver)\n2. Renda mensal líquida\n3. Objetivos (ex.: juntar R$ 20 mil, reserva de emergência)\n4. Proposta de plano, salvo quando o usuário concorda\n5. Convite para enviar os últimos extratos e faturas',
      },
      {
        id: 'passo-extratos',
        title: 'Passo 3: enviar os primeiros extratos',
        content: 'Com os arquivos no chat, o Elio lê e organiza. Em poucos minutos a Home já mostra gastos por categoria e o plano.',
      },
    ],
  },
  {
    id: 'como-usar',
    label: '📱 Como usar',
    color: 'text-rose-400',
    items: [
      {
        id: 'acessar',
        title: 'Acessar no celular e no computador',
        content: 'Basta abrir realwise.com.br no navegador e entrar. É o mesmo app nos dois, com os mesmos dados.',
      },
      {
        id: 'instalar-iphone',
        title: 'Instalar como app no iPhone',
        content: 'No Safari: botão Compartilhar → "Adicionar à Tela de Início". O ícone do Realwise aparece como um app.',
      },
      {
        id: 'instalar-android',
        title: 'Instalar como app no Android',
        content: 'No Chrome: menu ⋮ → "Instalar app" (ou "Adicionar à tela inicial").',
      },
      {
        id: 'anexos-historico',
        title: 'Por quanto tempo o chat e os anexos ficam guardados?',
        content: 'O histórico recente do chat é mantido por 3 dias e os anexos enviados ficam disponíveis por 3 dias, só no aparelho em que foram enviados. Os lançamentos, contas e planos ficam guardados normalmente.',
      },
      {
        id: 'excluir-conta',
        title: 'Como excluir a conta e os dados?',
        content: 'Em Configurações, no fim da página, "Excluir conta". A exclusão é imediata e permanente: apaga todos os dados. Se houver assinatura ativa, ela é cancelada.',
      },
      {
        id: 'falar-com-gente',
        title: 'Como falar com a equipe?',
        content: 'Pelo cartão "Contato" em Configurações (e pelo botão de WhatsApp da página inicial). As mensagens chegam na Caixa de suporte do admin e podem ser respondidas por e-mail.',
      },
    ],
  },
  {
    id: 'mensagens-prontas',
    label: '💬 Mensagens prontas',
    color: 'text-teal-400',
    items: [
      {
        id: 'msg-apresentacao',
        title: 'Apresentação inicial',
        content: 'Oi! O Realwise é um assistente financeiro com IA, o Elio. Você conta seus objetivos, manda seus extratos e faturas (ou fala com ele pelo microfone) e ele organiza tudo e monta o seu plano. Dá para testar 3 dias grátis, sem cartão: realwise.com.br',
      },
      {
        id: 'msg-preco',
        title: 'Resposta sobre preço',
        content: 'Você testa 3 dias grátis, sem cartão. Depois, se quiser continuar, são R$ 8,99 por mês ou R$ 74,90 por ano (mais de 30% de desconto). Cancela quando quiser, direto no app.',
      },
      {
        id: 'msg-seguranca',
        title: 'Resposta sobre segurança dos dados',
        content: 'Seus dados são só seus e ficam protegidos conforme a LGPD. Não pedimos acesso ao seu banco: você envia só os arquivos que quiser, e a IA que lê os extratos não retém nem treina com as suas informações. Você pode apagar tudo e excluir a conta quando quiser.',
      },
      {
        id: 'msg-bancos',
        title: 'Resposta sobre quais bancos funcionam',
        content: 'Qualquer um! O Elio lê PDF, foto, planilha (CSV/XLSX) e OFX de qualquer banco ou cartão, sem precisar conectar a sua conta.',
      },
      {
        id: 'msg-voz',
        title: 'Resposta sobre usar voz',
        content: 'Dá, sim! No chat, toque no microfone e fale, por exemplo, "gastei 45 no mercado". O Elio também pode ler as respostas em voz alta.',
      },
      {
        id: 'msg-boas-vindas',
        title: 'Boas-vindas após o cadastro',
        content: 'Seja bem-vindo(a) ao Realwise! 💜 Abra o app e converse com o Elio: ele vai te fazer algumas perguntas rápidas (contas, renda e objetivos) e montar o seu plano. Depois é só mandar seus extratos e faturas. Qualquer dúvida, é só chamar aqui.',
      },
    ],
  },
];

export default guideData;
