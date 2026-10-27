// pt-BR first, English as the fallback. The paywall renders outside SettingsProvider
// (the settings endpoint is blocked too), so it reads the language SettingsProvider last saved.
export const LANGUAGE_STORAGE_KEY = 'realwise:language';

export function resolveBillingLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch {
    // storage unavailable: fall through to the browser language
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return browser.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

const COPY = {
  pt: {
    locale: 'pt-BR',
    paywall: {
      eyebrow: 'Assinatura',
      titleTrialEnded: 'Seu teste grátis terminou',
      titleLapsed: 'Sua assinatura não está ativa',
      titleChoose: 'Escolha seu plano',
      reassurance: 'Seus dados estão guardados e voltam assim que você assinar.',
      intro: 'Assine para continuar usando o Realwise. Você pode cancelar quando quiser.',
      planMonthly: 'Mensal',
      planAnnual: 'Anual',
      perMonth: '/mês',
      perYear: '/ano',
      perMonthEquivalent: (value) => `equivale a ${value}/mês`,
      // Only "mais de X%" when the (rounded) percent is strictly above a multiple of ten, so the claim is always true.
      savings: (percent) => (percent >= 21 && percent % 10 !== 0 ? `Mais de ${Math.floor(percent / 10) * 10}% de desconto` : `Economize ${percent}%`),
      subscribe: 'Assinar',
      subscribeWith: (plan) => `Assinar plano ${plan}`,
      redirecting: 'Abrindo o pagamento...',
      secureNote: 'Pagamento seguro pelo Stripe. Cupons de desconto podem ser aplicados na próxima tela.',
      manage: 'Gerenciar assinatura',
      opening: 'Abrindo...',
      logout: 'Sair da conta',
      backToApp: 'Voltar ao app',
      plansLoading: 'Carregando planos...',
      plansError: 'Não conseguimos carregar os planos agora.',
      retry: 'Tentar de novo',
      checkoutError: 'Não foi possível abrir o pagamento. Tente de novo em instantes.',
      alreadySubscribed: 'Você já tem uma assinatura. Use "Gerenciar assinatura" para alterá-la.',
      portalError: 'Não foi possível abrir o gerenciamento. Tente de novo em instantes.',
    },
    success: {
      confirmingTitle: 'Confirmando seu pagamento',
      confirmingBody: 'Isso costuma levar poucos segundos. Não precisa fechar esta página.',
      timeoutTitle: 'Ainda estamos confirmando',
      timeoutBody: 'A confirmação do pagamento pode levar um minuto. Se você já pagou, seus dados continuam guardados e o acesso volta assim que ela chegar.',
      refresh: 'Verificar de novo',
      checking: 'Verificando...',
      toPaywall: 'Voltar aos planos',
    },
    trial: {
      daysLeft: (n) => `Teste grátis: ${n === 1 ? 'falta 1 dia' : `faltam ${n} dias`}`,
      lastDay: 'Teste grátis: termina hoje',
      cta: 'Assinar',
    },
    plan: {
      trialLabel: 'Teste grátis',
      endsIn: 'termina em',
      ended: 'Teste terminado',
      subscribeNow: 'Assinar agora',
      planMonthly: 'Plano Mensal',
      planAnnual: 'Plano Anual',
      planActive: 'Assinatura ativa',
      fullAccess: 'Acesso completo',
      lifetime: 'Acesso vitalício',
      owner: 'Acesso total',
      manage: 'Gerenciar',
      pastDue: 'Pagamento pendente',
      cancelsOn: (date) => `Cancela em ${date}`,
      renewsOn: (date) => `Renova em ${date}`,
      d: 'd',
      h: 'h',
      m: 'm',
      s: 's',
    },
    settings: {
      title: 'Assinatura',
      planLabel: 'Plano',
      statusLabel: 'Situação',
      renewsLabel: 'Renova em',
      endsLabel: 'Termina em',
      trialEndsLabel: 'Teste termina em',
      monthly: 'Mensal',
      annual: 'Anual',
      stateOwner: 'Acesso total',
      stateLifetime: 'Acesso vitalício',
      stateSubscribed: 'Assinatura ativa',
      stateTrial: 'Teste grátis',
      stateBlocked: 'Sem assinatura ativa',
      cancelNotice: (date) => `Sua assinatura foi cancelada e continua ativa até ${date}. Depois disso o acesso é pausado, e seus dados ficam guardados.`,
      pastDue: 'Não conseguimos cobrar o último pagamento. Atualize a forma de pagamento para manter o acesso.',
      manage: 'Gerenciar assinatura',
      subscribe: 'Assinar',
    },
  },
  en: {
    locale: 'en-US',
    paywall: {
      eyebrow: 'Subscription',
      titleTrialEnded: 'Your free trial has ended',
      titleLapsed: 'Your subscription is not active',
      titleChoose: 'Choose your plan',
      reassurance: 'Your data is safe and comes back as soon as you subscribe.',
      intro: 'Subscribe to keep using Realwise. You can cancel anytime.',
      planMonthly: 'Monthly',
      planAnnual: 'Annual',
      perMonth: '/month',
      perYear: '/year',
      perMonthEquivalent: (value) => `works out to ${value}/month`,
      savings: (percent) => (percent >= 21 && percent % 10 !== 0 ? `Over ${Math.floor(percent / 10) * 10}% off` : `Save ${percent}%`),
      subscribe: 'Subscribe',
      subscribeWith: (plan) => `Subscribe to the ${plan} plan`,
      redirecting: 'Opening checkout...',
      secureNote: 'Secure payment by Stripe. You can apply discount codes on the next screen.',
      manage: 'Manage subscription',
      opening: 'Opening...',
      logout: 'Sign out',
      backToApp: 'Back to the app',
      plansLoading: 'Loading plans...',
      plansError: 'We could not load the plans right now.',
      retry: 'Try again',
      checkoutError: 'Could not open checkout. Please try again in a moment.',
      alreadySubscribed: 'You already have a subscription. Use "Manage subscription" to change it.',
      portalError: 'Could not open billing management. Please try again in a moment.',
    },
    success: {
      confirmingTitle: 'Confirming your payment',
      confirmingBody: 'This usually takes a few seconds. You do not need to close this page.',
      timeoutTitle: 'Still confirming',
      timeoutBody: 'Payment confirmation can take a minute. If you already paid, your data is safe and access returns as soon as it arrives.',
      refresh: 'Check again',
      checking: 'Checking...',
      toPaywall: 'Back to plans',
    },
    trial: {
      daysLeft: (n) => `Free trial: ${n} ${n === 1 ? 'day' : 'days'} left`,
      lastDay: 'Free trial: ends today',
      cta: 'Subscribe',
    },
    plan: {
      trialLabel: 'Free trial',
      endsIn: 'ends in',
      ended: 'Trial ended',
      subscribeNow: 'Subscribe now',
      planMonthly: 'Monthly plan',
      planAnnual: 'Annual plan',
      planActive: 'Active subscription',
      fullAccess: 'Full access',
      lifetime: 'Lifetime access',
      owner: 'Full access',
      manage: 'Manage',
      pastDue: 'Payment pending',
      cancelsOn: (date) => `Cancels on ${date}`,
      renewsOn: (date) => `Renews on ${date}`,
      d: 'd',
      h: 'h',
      m: 'm',
      s: 's',
    },
    settings: {
      title: 'Subscription',
      planLabel: 'Plan',
      statusLabel: 'Status',
      renewsLabel: 'Renews on',
      endsLabel: 'Ends on',
      trialEndsLabel: 'Trial ends on',
      monthly: 'Monthly',
      annual: 'Annual',
      stateOwner: 'Full access',
      stateLifetime: 'Lifetime access',
      stateSubscribed: 'Active subscription',
      stateTrial: 'Free trial',
      stateBlocked: 'No active subscription',
      cancelNotice: (date) => `Your subscription was canceled and stays active until ${date}. After that access is paused and your data stays safe.`,
      pastDue: 'We could not charge your last payment. Update your payment method to keep access.',
      manage: 'Manage subscription',
      subscribe: 'Subscribe',
    },
  },
};

export function getBillingCopy(language) {
  return COPY[language] ?? COPY.pt;
}

export function formatMoney(amountInCents, currency, locale) {
  const value = amountInCents / 100;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: (currency || 'BRL').toUpperCase() }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim();
  }
}

export function formatDate(isoDate, locale) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}
