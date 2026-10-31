import LegalLayout from './LegalLayout';
import { OPERATOR } from './operator';

// Every statement here describes what the code does today (see the file noted beside each block).
// When behaviour changes (a new vendor, a new retention window, a new kind of data), change this text in the same PR.
const sections = [
  {
    id: 'quem-somos',
    title: 'Quem é o responsável pelos seus dados',
    body: [
      `O Realwise é operado por ${OPERATOR.name}, CNPJ ${OPERATOR.cnpj}, que é a controladora dos dados pessoais tratados no aplicativo e no site, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).`,
      `Para qualquer assunto de privacidade, fale com a gente em ${OPERATOR.email}.`,
    ],
  },
  {
    id: 'dados',
    title: 'Quais dados coletamos',
    body: [
      'Dados da sua conta: e-mail, nome e foto de perfil, vindos do login com o Google. Não existe senha no Realwise: o acesso é sempre pela sua conta Google.',
      'Dados financeiros que você mesmo informa: lançamentos, contas, cartões, contas a pagar, orçamentos, categorias, investimentos, renda e metas. Eles entram quando você digita, conversa com o Elio ou envia extratos, faturas, planilhas, OFX, PDFs e fotos.',
      'Conversa com o Elio: as mensagens que você troca e os arquivos que anexa. O Elio também guarda “memórias” (fatos como um objetivo ou uma preferência que você contou). Você vê, edita e apaga essas memórias em Configurações.',
      'Assinatura: identificadores do cliente e da assinatura no Stripe, plano, situação, data de renovação e valor cobrado. Os dados do seu cartão são digitados direto no Stripe e nunca chegam aos nossos servidores.',
      'Nota fiscal: para emitir a NFS-e de cada pagamento usamos seu nome, e-mail e o valor pago. Pedimos seu CPF (ou CNPJ) na tela de pagamento do Stripe somente para emitir a nota fiscal, e não o usamos para mais nada. Endereço só entra na nota se você o informar.',
      'Uso e diagnóstico: data do último acesso; um registro de cada chamada de IA (modelo, quantidade de tokens, custo e erro, sem o conteúdo da conversa); e relatórios de erro com a rota afetada, mensagem de erro, versão do app, navegador e o seu identificador e e-mail, para sabermos quem foi afetado.',
      'Suporte e contato: o nome, o e-mail e a mensagem que você envia pelo app, e o histórico do que respondemos.',
      'Site (página inicial): um identificador anônimo guardado no seu navegador e eventos de visita e cliques em botões, com a origem do acesso (por exemplo, UTM). Se você preencher o formulário de novidades, guardamos nome, e-mail, WhatsApp (opcional) e o registro do seu consentimento.',
    ],
  },
  {
    id: 'finalidades',
    title: 'Para que usamos e em que base legal',
    body: [
      [
        'Prestar o serviço que você contratou (organizar suas finanças, ler seus documentos, responder o Elio, gerar o resumo do mês, lembrar contas): execução de contrato.',
        'Cobrar a assinatura e cumprir obrigações fiscais e legais: execução de contrato e obrigação legal.',
        'Enviar e-mails do serviço (boas-vindas, lembretes de conta, resumo mensal, aviso de fim do teste): execução de contrato e legítimo interesse. Você pode parar os e-mails de lembrete e de engajamento pelo link de descadastro que vai em cada um.',
        'Enviar novidades e promoções: somente com o seu consentimento (a caixa marcada no formulário do site), que você pode retirar a qualquer momento.',
        'Manter o serviço seguro, corrigir erros e medir de forma agregada como o site é usado: legítimo interesse.',
      ],
      'Não vendemos seus dados e não usamos suas informações financeiras para publicidade.',
    ],
  },
  {
    id: 'ia',
    title: 'Como a inteligência artificial usa seus dados',
    body: [
      'O Elio é um assistente de IA. Para responder, ele envia ao provedor de IA a sua mensagem, os documentos que você anexou, um resumo dos seus dados do mês (contas, categorias, totais) e as memórias que ele guardou sobre você.',
      'Usamos a plataforma OpenRouter para acessar modelos de linguagem da Anthropic (Claude). Cada chamada é feita pedindo ao OpenRouter que use apenas provedores sem retenção de dados e que não usem o conteúdo para treinar modelos. Isso é uma configuração que exigimos nas nossas requisições, mas a execução dessas garantias depende desses fornecedores.',
      'A IA pode errar ao ler um documento ou classificar um gasto. Por isso o Elio pede confirmação em ações sensíveis, como alterar ou apagar registros em lote, e você pode revisar e desfazer. Você pode pedir a revisão de qualquer decisão tomada de forma automatizada, escrevendo para o nosso e-mail.',
      'O Elio não recomenda produtos de investimento específicos e não substitui um profissional de finanças.',
      'O ditado por voz do chat usa o reconhecimento de voz do seu próprio navegador. Em alguns navegadores, como o Chrome, o áudio é processado por servidores do fabricante do navegador, sob a política dele. O Realwise não recebe nem guarda o áudio, só o texto.',
    ],
  },
  {
    id: 'compartilhamento',
    title: 'Com quem compartilhamos',
    body: [
      'Só compartilhamos dados com fornecedores que nos ajudam a operar o serviço, cada um com o mínimo necessário:',
      [
        'OpenRouter e Anthropic: processamento de IA (seção anterior).',
        'Stripe: cobrança e gestão da assinatura.',
        'Focus NFe: emissão e transmissão da nota fiscal de serviço (NFS-e) à Prefeitura de São Paulo, com os dados que constam da nota.',
        'Resend: envio dos e-mails do Realwise (recebe seu e-mail, nome e o conteúdo do e-mail).',
        'Google: login com a sua conta Google e, só se você aceitar os cookies, o Google Analytics do site (medição de visitas).',
        'brapi.dev: cotações de ações da B3. Recebe apenas os códigos dos ativos (tickers), sem ligação com você.',
        'Hetzner: hospedagem dos servidores e das cópias de segurança do Realwise, em data center na Alemanha.',
      ],
      'Podemos ainda divulgar dados quando houver ordem judicial ou obrigação legal.',
      'Seus dados ficam guardados em servidores na Alemanha (União Europeia) e alguns outros fornecedores também ficam fora do Brasil. Essa transferência internacional acontece para executar o contrato que você tem conosco, como a LGPD permite.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies e armazenamento no navegador',
    body: [
      [
        'Cookies de sessão (access_token e refresh_token): mantêm você logado por até 30 dias. São restritos ao envio por HTTPS e não podem ser lidos por scripts da página.',
        'Cookie de login (oauth_state): dura 10 minutos e só existe durante o login com o Google, para proteger contra fraude.',
        'Armazenamento local: um identificador anônimo de visitante no site e preferências do app (como tema e último cliente acessado).',
        'Google Analytics: mede visitas, origem do acesso, rolagem e seções vistas, e define cookies próprios do Google. Só é carregado depois que você clica em “Aceitar” no aviso de cookies; antes disso, e se você recusar, nada do Google Analytics é carregado. Você muda a sua escolha quando quiser pelo botão “Preferências de cookies” no fim desta página.',
      ],
    ],
  },
  {
    id: 'retencao',
    title: 'Por quanto tempo guardamos',
    body: [
      [
        'Seus dados financeiros e da conta ficam guardados enquanto a conta existir, inclusive se o teste acabar e você não assinar: o acesso é pausado e os dados continuam salvos, até você pedir a exclusão.',
        'Conversa com o Elio: o chat mostra e envia à IA só os últimos 3 dias de mensagens, mas as mensagens antigas continuam armazenadas até você excluir a conta.',
        'Arquivos que você anexa no chat: ficam guardados só temporariamente, até o Elio salvar os lançamentos ou por no máximo 24 horas.',
        'Link do resumo mensal: vale por 30 dias e o registro é apagado 60 dias depois de vencer.',
        'Relatórios de erro: apagados automaticamente após 90 dias.',
        'Cópias de segurança: ficam na Hetzner, na Alemanha. Ao excluir a conta, os dados saem do sistema na hora, mas ainda podem existir nas cópias de segurança até elas serem substituídas pelas mais recentes.',
        'Notas fiscais: quando você paga uma assinatura, emitimos a nota fiscal de serviço (NFS-e) pela Prefeitura de São Paulo, com seu nome, e-mail, valor e, se você informar, CPF ou CNPJ. A lei tributária obriga a guardar esses documentos por anos, então eles não são apagados com a conta; ao excluir a conta, a nota deixa de estar ligada a você no app.',
        'Contatos do formulário de novidades: até você pedir a remoção ou retirar o consentimento.',
      ],
    ],
  },
  {
    id: 'direitos',
    title: 'Seus direitos',
    body: [
      'A LGPD garante a você, entre outros direitos: confirmar que tratamos seus dados e acessá-los, corrigi-los, pedir anonimização, bloqueio ou eliminação, pedir portabilidade, saber com quem compartilhamos, retirar o consentimento e pedir a revisão de decisões automatizadas.',
      'O que você faz sozinho no app: editar e apagar seus lançamentos e memórias, parar os e-mails de lembrete pelo link de descadastro e excluir a conta em Configurações. A exclusão cancela a assinatura e apaga a conta e todos os dados associados de forma definitiva, e não dá para desfazer. Contas de administração não podem ser excluídas por esse caminho.',
      `Para os demais direitos, incluindo receber uma cópia dos seus dados (hoje não há botão de exportação no app), escreva para ${OPERATOR.email}. Respondemos no prazo da lei.`,
      'Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
    ],
  },
  {
    id: 'encarregado',
    title: 'Encarregado pelos dados (DPO)',
    body: [`O canal do encarregado pelo tratamento de dados pessoais do Realwise é ${OPERATOR.email}. Use-o para exercer seus direitos, tirar dúvidas ou reclamar sobre o tratamento dos seus dados.`],
  },
  {
    id: 'seguranca',
    title: 'Segurança',
    body: [
      'O acesso ao app exige login com o Google e usa cookies seguros. O token de renovação da sessão é guardado só em forma de hash. O acesso interno aos dados é restrito a quem opera o Realwise e é usado para suporte e manutenção.',
      'Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco relevante a você, avisaremos você e a ANPD, como a lei exige.',
    ],
  },
  {
    id: 'menores',
    title: 'Crianças e adolescentes',
    body: ['O Realwise é feito para maiores de 18 anos e não coletamos dados de menores de forma intencional. Se descobrirmos uma conta de menor, vamos excluí-la.'],
  },
  {
    id: 'mudancas',
    title: 'Mudanças nesta política',
    body: ['Quando mudarmos algo relevante, atualizamos a data no topo desta página e, se a mudança afetar o uso dos seus dados, avisamos por e-mail ou no app.'],
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Política de Privacidade"
      updatedAt="30 de outubro de 2026"
      intro="Aqui explicamos, em linguagem simples, quais dados o Realwise coleta, para que usa, com quem compartilha e como você controla tudo isso."
      sections={sections}
    />
  );
}
