import LegalLayout from './LegalLayout';
import { OPERATOR } from './operator';

// Keep in step with the product: the trial length, how cancelling works and what happens to data after the trial
// are the behaviours this text promises (billing/, engagement-reminders/, account/).
const sections = [
  {
    id: 'aceite',
    title: 'Aceite e quem somos',
    body: [
      `Estes Termos regem o uso do Realwise, serviço operado por ${OPERATOR.name}, CNPJ ${OPERATOR.cnpj}. Ao criar sua conta ou usar o serviço, você declara que leu e concorda com eles e com a Política de Privacidade.`,
      'O uso é permitido a pessoas com 18 anos ou mais e plena capacidade civil.',
    ],
  },
  {
    id: 'servico',
    title: 'O que é o Realwise',
    body: [
      'O Realwise é um aplicativo de controle financeiro pessoal. Com ele você registra lançamentos, contas e cartões, acompanha orçamento e contas a pagar e conversa com o Elio, um assistente de inteligência artificial que lê extratos e faturas, categoriza gastos, monta um plano e envia um resumo mensal.',
      'O Realwise não é banco, corretora nem instituição financeira e não movimenta seu dinheiro. Não conectamos à sua conta bancária: os dados entram porque você os informa ou os envia.',
      'O Elio e o resumo mensal são ferramentas de organização e educação financeira. Não são consultoria, recomendação de investimento nem aconselhamento financeiro, jurídico ou tributário personalizado, e o Elio não indica produtos de investimento específicos. Decisões sobre o seu dinheiro são suas.',
    ],
  },
  {
    id: 'ia',
    title: 'Limites da inteligência artificial',
    body: [
      'A IA pode interpretar errado um documento, classificar um gasto na categoria errada ou dar uma resposta imprecisa. Confira o que o Elio registrou, principalmente valores e datas, antes de basear alguma decisão nele. Você pode editar ou desfazer os registros a qualquer momento.',
    ],
  },
  {
    id: 'conta',
    title: 'Sua conta',
    body: [
      'O acesso é feito com sua conta Google ou Apple. Você é responsável pelo que acontece na sua conta e por manter o acesso a ela em segurança. Avise-nos em caso de uso indevido.',
      'Cada conta é pessoal. Não revenda nem compartilhe o acesso de forma que o desvirtue.',
    ],
  },
  {
    id: 'teste-e-planos',
    title: 'Teste grátis, planos e pagamento',
    body: [
      [
        'Todo novo usuário tem 7 dias de teste grátis, sem cadastro de cartão.',
        'Ao fim do teste, para continuar usando você escolhe um plano pago (mensal ou anual). O valor, a periodicidade e as condições aparecem na tela de assinatura antes de você confirmar o pagamento.',
        'A cobrança é feita pelo Stripe e a assinatura se renova automaticamente a cada período até você cancelar.',
        'Se você não assinar, o acesso fica pausado e seus dados continuam guardados. Você pode assinar depois e voltar de onde parou, ou excluir a conta.',
        'Podemos alterar os preços dos planos. A mudança vale para renovações futuras e avisamos antes de ela ser aplicada a você.',
      ],
    ],
  },
  {
    id: 'cancelamento',
    title: 'Cancelamento e reembolso',
    body: [
      'Você cancela quando quiser em Configurações → Assinatura, sem multa. O cancelamento impede novas cobranças e o acesso continua até o fim do período já pago.',
      `Se você contratou o plano pela internet, tem o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor: pode desistir em até 7 dias corridos da contratação e receber de volta o valor pago. Para isso, escreva para ${OPERATOR.email}.`,
      'Você também pode excluir a conta em Configurações. A exclusão cancela a assinatura e apaga seus dados de forma definitiva.',
    ],
  },
  {
    id: 'uso',
    title: 'Uso permitido',
    body: [
      'Você concorda em não usar o Realwise para fins ilegais ou fraudulentos, não tentar acessar contas ou dados de outras pessoas, não explorar falhas, não sobrecarregar o serviço com acessos automatizados e não tentar extrair o funcionamento interno do assistente.',
      'Podemos suspender ou encerrar uma conta que viole estes Termos ou coloque outras pessoas ou o serviço em risco.',
    ],
  },
  {
    id: 'seus-dados',
    title: 'Seus dados e conteúdo',
    body: [
      'Os dados e documentos que você envia continuam sendo seus. Você nos autoriza a tratá-los apenas para prestar o serviço a você, como descrito na Política de Privacidade, incluindo o envio ao provedor de IA para o Elio responder.',
      'O software, a marca, o design e os textos do Realwise pertencem à operadora. Esses Termos não transferem nenhum direito sobre eles além do uso do serviço.',
    ],
  },
  {
    id: 'disponibilidade',
    title: 'Disponibilidade e mudanças no serviço',
    body: [
      'Trabalhamos para manter o Realwise no ar, mas não garantimos funcionamento ininterrupto: pode haver manutenção, falhas e indisponibilidade de fornecedores, como o provedor de IA ou o Stripe.',
      'O serviço evolui. Podemos incluir, alterar ou retirar recursos. Se retirarmos algo essencial do plano que você paga, avisaremos antes.',
    ],
  },
  {
    id: 'responsabilidade',
    title: 'Responsabilidade',
    body: [
      'Respondemos pelo que a lei determina, inclusive os direitos do Código de Defesa do Consumidor, que nenhuma cláusula destes Termos afasta. Dentro desse limite, não nos responsabilizamos por decisões financeiras tomadas com base nas informações do aplicativo, por erros de dados que você informou ou enviou, nem por falhas causadas por terceiros ou fora do nosso controle.',
    ],
  },
  {
    id: 'mudancas',
    title: 'Mudanças nestes Termos',
    body: ['Podemos atualizar estes Termos. Quando a mudança for relevante, avisamos por e-mail ou no aplicativo antes de ela valer. Continuar usando depois do aviso significa que você concorda com a nova versão; se não concordar, pode cancelar e excluir a conta.'],
  },
  {
    id: 'lei',
    title: 'Lei aplicável e contato',
    body: [
      'Estes Termos seguem as leis do Brasil. Fica eleito o foro do seu domicílio para resolver qualquer disputa, como garante o Código de Defesa do Consumidor.',
      `Dúvidas, pedidos e reclamações: ${OPERATOR.email}.`,
    ],
  },
];

export default function Terms() {
  return (
    <LegalLayout
      title="Termos de Uso"
      updatedAt="30 de outubro de 2026"
      intro="Estas são as regras de uso do Realwise. Escrevemos de forma direta para você saber o que esperar de nós e o que esperamos de você."
      sections={sections}
    />
  );
}
