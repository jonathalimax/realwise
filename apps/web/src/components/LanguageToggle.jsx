/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'pt';
  return localStorage.getItem('language') || 'pt';
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'pt' : 'en';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  // Static translation lookup for the marketing site.
  const t = (key) => {
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, loading: false }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="h-10 px-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
    >
      <Globe className="h-4 w-4 mr-2" />
      {language === 'en' ? 'EN' : 'PT'}
    </Button>
  );
}

// Static translations (fallback)
export const translations = {
  en: {
    // Hero
    'hero.badge': 'Personal finance made simple',
    'hero.headline1': 'Track, plan, and grow',
    'hero.headline2': 'your finances',
    'hero.subheadline': 'Start free to record and understand your money. When you want planning, importing, and deeper features, you unlock Premium.',
    'hero.cta': 'Start free',
    'hero.note': 'Manual tracking stays free. Premium is only for advanced features.',
    'hero.desktop': 'Desktop',
    'hero.mobile': 'Mobile',

    // Benefits
    'benefits.title': 'Why choose us',
    'benefits.subtitle': 'Everything you need, nothing you don\'t',
    'benefits.works': 'Works everywhere',
    'benefits.works.desc': 'Desktop and mobile',
    'benefits.import': 'Import statements',
    'benefits.import.desc': 'From banks and credit cards',
    'benefits.categorize': 'Smart auto-categorization',
    'benefits.categorize.desc': 'No AI required',
    'benefits.charts': 'Clear charts',
    'benefits.charts.desc': 'Income vs. expenses',
    'benefits.plan': 'Plan & track',
    'benefits.plan.desc': 'Goals and investments',
    'benefits.darkmode': 'Dark mode',
    'benefits.darkmode.desc': 'Comfortable viewing',
    'benefits.social': 'Join the beta and help shape the future of simple, honest personal finance.',

    // Features
    'features.label': 'Features',
    'features.title': 'Powerful yet simple',
    'features.subtitle': 'Everything you need to take control of your finances, designed with clarity and purpose.',
    'features.transactions.title': 'Manage Transactions',
    'features.transactions.desc': 'Add transactions manually or import your bank/credit card statements. See all your transactions in one place, organized by category.',
    'features.transactions.h1': 'Manual entry or import',
    'features.transactions.h2': 'Organized by category',
    'features.transactions.h3': 'Edit, merge, customize',
    'features.categorize.title': 'Categorize Without Complexity',
    'features.categorize.desc': 'Auto-categorization based on your rules—no AI and no surprises. Create personalized categories and manage them anytime.',
    'features.categorize.h1': 'Rule-based matching',
    'features.categorize.h2': 'Custom categories',
    'features.categorize.h3': 'Full control',
    'features.visualize.title': 'Visualize Your Money',
    'features.visualize.desc': 'Income vs. expenses chart that\'s easy to read. Monthly and yearly summaries with spending tracked by category.',
    'features.visualize.h1': 'Clear income vs expenses',
    'features.visualize.h2': 'Monthly/yearly views',
    'features.visualize.h3': 'Category breakdown',
    'features.plan.title': 'Plan & Achieve',
    'features.plan.desc': 'Build a spending plan that aligns with your goals. Set savings targets, track progress, and mark milestones.',
    'features.plan.h1': 'Spending plans',
    'features.plan.h2': 'Savings targets',
    'features.plan.h3': 'Goal tracking',
    'features.investments.title': 'Investments & Accounts',
    'features.investments.desc': 'Add your banks, cards, and investment entries for a holistic view. Monitor balances, contributions, and performance over time.',
    'features.investments.h1': 'All accounts in one place',
    'features.investments.h2': 'Investment tracking',
    'features.investments.h3': 'Performance metrics',
    'features.international.title': 'International Ready',
    'features.international.desc': 'EN/PT languages. BRL, USD, EUR, GBP currencies.',
    'features.privacy.title': 'Privacy First',
    'features.privacy.desc': 'Your data belongs to you. No AI, no selling data.',
    'features.fast.title': 'Fast & Beautiful',
    'features.fast.desc': 'Clean interface with dark mode support.',

    // Pricing
    'pricing.label': 'Pricing',
    'pricing.title': 'Free to start, premium when you need more',
    'pricing.subtitle': 'Manual tracking stays free. Premium unlocks deeper planning and automation.',
    'pricing.badge': 'Free core + premium extras',
    'pricing.complete': 'What stays free and what becomes premium',
    'pricing.feature1': 'Manual transaction entry stays free forever',
    'pricing.feature2': 'Import statements when you want more speed',
    'pricing.feature3': 'Category charts stay visible in the free plan',
    'pricing.feature4': 'Premium shows what is still available to spend',
    'pricing.feature5': 'Premium unlocks planning, goals and investments',
    'pricing.feature6': 'Secure checkout with wallets or card in Stripe',
    'pricing.why1.title': 'Bilingual',
    'pricing.why1.desc': 'English & Portuguese',
    'pricing.why2.title': 'Privacy First',
    'pricing.why2.desc': 'Your data is yours',
    'pricing.why3.title': 'No Monthly Fees',
    'pricing.why3.desc': 'Pay once, use forever',
    'pricing.onetime': 'premium access',
    'pricing.converted': 'approx.',
    'pricing.cta': 'Start free',
    'pricing.guarantee': 'Manual tracking stays free. Premium only appears where it adds more value.',
    'pricing.why.title': 'Clear from the start',
    'pricing.why.desc': 'No app-wide trial confusion. Free remains free, and premium is explained feature by feature.',
    'pricing.note': 'After the premium period ends, blocked features show an upgrade gate. Core tracking remains available.',

    // FAQ
    'faq.label': 'FAQ',
    'faq.title': 'Frequently asked questions',

    // Footer
    'footer.title': 'Use Realwise first,',
    'footer.title2': 'upgrade only if premium helps you more',
    'footer.desc': 'The goal is simple: get you using the system fast, keep manual control free, and charge only for deeper premium value.',
    'footer.cta': 'Start free',
    'footer.support': 'Support',
    'footer.feedback': 'Feedback Portal',
    'footer.donations': 'Donations',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.made': 'Made with ❤️ by',

    // Navigation
    'nav.back': 'Back to Home',

    // Donations
    'donations.title': 'Support the Creator',
    'donations.subtitle': 'Your donations help keep this project alive and support independent development. Thank you for your generosity!',
    'donations.select': 'Select Amount',
    'donations.custom': 'Custom amount',
    'donations.impact': 'Your Support',
    'donations.impact.desc': 'will go directly to supporting development.',
    'donations.name': 'Name',
    'donations.name.placeholder': 'Your name (optional)',
    'donations.email': 'Email',
    'donations.email.placeholder': 'you@example.com',
    'donations.donate': 'Donate',
    'donations.secure': 'Secure payment processing. Thank you for your generosity.',
    'donations.reports': 'Transparency Reports',
    'donations.raised': 'Total Raised',
    'donations.donated': 'Total Donations',
    'donations.donors': 'Donors',
    'donations.report': 'Report',
    'donations.comingSoon': 'Reports coming soon',
    'donations.comingSoonDesc': 'As soon as we receive the first donations, we will publish detailed transparency reports here.',

    // Feature Requests
    'feedback.title': 'Help Us Build Better',
    'feedback.subtitle': 'Submit feature requests, report bugs, and vote on priorities. Your feedback shapes our roadmap.',
    'feedback.submit': 'Submit',
    'feedback.roadmap': 'Roadmap',
    'feedback.feature': 'Feature Request',
    'feedback.bug': 'Bug Report',
    'feedback.title.label': 'Title',
    'feedback.title.placeholder.feature': 'What feature would you like?',
    'feedback.title.placeholder.bug': 'Brief description of the bug',
    'feedback.desc.label': 'Description',
    'feedback.desc.placeholder.feature': 'Describe the feature and why it would be helpful...',
    'feedback.desc.placeholder.bug': 'Steps to reproduce, expected vs actual behavior...',
    'feedback.email.label': 'Your Email',
    'feedback.submit.feature': 'Submit Request',
    'feedback.submit.bug': 'Submit Report',
    'feedback.status.planned': 'Planned',
    'feedback.status.progress': 'In Progress',
    'feedback.status.completed': 'Completed',
  },
  pt: {
    // Hero
    'hero.badge': 'Finanças pessoais simplificadas',
    'hero.headline1': 'Acompanhe, planeje e expanda',
    'hero.headline2': 'suas finanças',
    'hero.subheadline': 'Comece grátis para registrar e entender sua movimentação. Quando quiser planejamento, importação e recursos mais avançados, você desbloqueia o Premium.',
    'hero.cta': 'Começar grátis',
    'hero.note': 'Entrada manual grátis. Premium só para recursos avançados.',
    'hero.desktop': 'Desktop',
    'hero.mobile': 'Mobile',

    // Benefits
    'benefits.title': 'Por que nos escolher',
    'benefits.subtitle': 'Tudo que você precisa, nada que você não precisa',
    'benefits.works': 'Funciona em todos os lugares',
    'benefits.works.desc': 'Desktop e mobile',
    'benefits.import': 'Importe extratos',
    'benefits.import.desc': 'De bancos e cartões de crédito',
    'benefits.categorize': 'Categorização inteligente',
    'benefits.categorize.desc': 'Sem IA necessária',
    'benefits.charts': 'Gráficos claros',
    'benefits.charts.desc': 'Receitas vs. despesas',
    'benefits.plan': 'Planeje e acompanhe',
    'benefits.plan.desc': 'Metas e investimentos',
    'benefits.darkmode': 'Modo escuro',
    'benefits.darkmode.desc': 'Visualização confortável',
    'benefits.social': 'Participe do beta e ajude a moldar o futuro das finanças pessoais simples e honestas.',

    // Features
    'features.label': 'Recursos',
    'features.title': 'Poderoso e simples',
    'features.subtitle': 'Tudo que você precisa para ter controle das suas finanças, projetado com clareza e propósito.',
    'features.transactions.title': 'Gerencie Transações',
    'features.transactions.desc': 'Adicione transações manualmente ou importe extratos do seu banco/cartão de crédito. Veja todas as suas transações em um só lugar, organizadas por categoria.',
    'features.transactions.h1': 'Entrada manual ou importação',
    'features.transactions.h2': 'Organizado por categoria',
    'features.transactions.h3': 'Editar, mesclar, personalizar',
    'features.categorize.title': 'Categorize Sem Complexidade',
    'features.categorize.desc': 'Categorização automática baseada nas suas regras—sem IA e sem surpresas. Crie categorias personalizadas e gerencie-as a qualquer momento.',
    'features.categorize.h1': 'Correspondência baseada em regras',
    'features.categorize.h2': 'Categorias personalizadas',
    'features.categorize.h3': 'Controle total',
    'features.visualize.title': 'Visualize Seu Dinheiro',
    'features.visualize.desc': 'Gráfico de receitas vs. despesas fácil de ler. Resumos mensais e anuais com gastos rastreados por categoria.',
    'features.visualize.h1': 'Receitas vs despesas claras',
    'features.visualize.h2': 'Visões mensais/anuais',
    'features.visualize.h3': 'Detalhamento por categoria',
    'features.plan.title': 'Planeje e Conquiste',
    'features.plan.desc': 'Construa um plano de gastos alinhado com seus objetivos. Defina metas de economia, acompanhe o progresso e marque marcos.',
    'features.plan.h1': 'Planos de gastos',
    'features.plan.h2': 'Metas de economia',
    'features.plan.h3': 'Acompanhamento de objetivos',
    'features.investments.title': 'Investimentos e Contas',
    'features.investments.desc': 'Adicione seus bancos, cartões e entradas de investimento para uma visão holística. Monitore saldos, contribuições e desempenho ao longo do tempo.',
    'features.investments.h1': 'Todas as contas em um só lugar',
    'features.investments.h2': 'Rastreamento de investimentos',
    'features.investments.h3': 'Métricas de desempenho',
    'features.international.title': 'Pronto Para o Mundo',
    'features.international.desc': 'Idiomas EN/PT. Moedas BRL, USD, EUR, GBP.',
    'features.privacy.title': 'Privacidade em Primeiro Lugar',
    'features.privacy.desc': 'Seus dados pertencem a você. Sem IA, sem venda de dados.',
    'features.fast.title': 'Rápido e Bonito',
    'features.fast.desc': 'Interface limpa com suporte a modo escuro.',

    // Pricing
    'pricing.label': 'Preços',
    'pricing.title': 'Grátis para começar, premium quando fizer sentido',
    'pricing.subtitle': 'O controle manual continua grátis. O Premium entra para planejamento, importação e recursos mais profundos.',
    'pricing.badge': 'Core grátis + extras premium',
    'pricing.complete': 'O que continua grátis e o que vira premium',
    'pricing.feature1': 'Lançamento manual de transações grátis para sempre',
    'pricing.feature2': 'Importação de extratos quando você quiser mais agilidade',
    'pricing.feature3': 'Gráficos por categoria continuam visíveis no plano grátis',
    'pricing.feature4': 'O Premium mostra quanto ainda sobra para gastar',
    'pricing.feature5': 'O Premium desbloqueia planejamento, metas e investimentos',
    'pricing.feature6': 'Checkout seguro com carteiras digitais ou cartão no Stripe',
    'pricing.why1.title': 'Bilíngue',
    'pricing.why1.desc': 'Português e Inglês',
    'pricing.why2.title': 'Privacidade',
    'pricing.why2.desc': 'Seus dados são seus',
    'pricing.why3.title': 'Sem Mensalidade',
    'pricing.why3.desc': 'Pague uma vez, use sempre',
    'pricing.onetime': 'acesso premium',
    'pricing.converted': 'aprox.',
    'pricing.cta': 'Começar grátis',
    'pricing.guarantee': 'O app continua grátis para o controle manual. O premium aparece só onde entrega mais valor.',
    'pricing.why.title': 'Clareza desde o início',
    'pricing.why.desc': 'Nada de confusão com teste do app inteiro. O grátis continua grátis, e o premium é explicado recurso por recurso.',
    'pricing.note': 'Depois que o período premium termina, os recursos bloqueados mostram um gate de upgrade. O acompanhamento principal continua disponível.',

    // FAQ
    'faq.label': 'Perguntas Frequentes',
    'faq.title': 'Perguntas frequentes',

    // Footer
    'footer.title': 'Use o Realwise primeiro,',
    'footer.title2': 'e faça upgrade só se o premium te ajudar mais',
    'footer.desc': 'A ideia é simples: colocar você para usar o sistema rápido, manter o controle manual grátis e cobrar só pelo valor premium mais profundo.',
    'footer.cta': 'Começar grátis',
    'footer.support': 'Suporte',
    'footer.feedback': 'Portal de Feedback',
    'footer.donations': 'Doações',
    'footer.privacy': 'Privacidade',
    'footer.terms': 'Termos',
    'footer.made': 'Feito com ❤️ pela',

    // Navigation
    'nav.back': 'Voltar para Home',

    // Donations
    'donations.title': 'Apoie o Criador',
    'donations.subtitle': 'Suas doações ajudam a manter este projeto vivo e apoiam o desenvolvimento independente. Obrigado pela sua generosidade!',
    'donations.select': 'Selecione o Valor',
    'donations.custom': 'Valor personalizado',
    'donations.impact': 'Seu Apoio',
    'donations.impact.desc': 'irá diretamente para apoiar o desenvolvimento.',
    'donations.name': 'Nome',
    'donations.name.placeholder': 'Seu nome (opcional)',
    'donations.email': 'E-mail',
    'donations.email.placeholder': 'voce@exemplo.com',
    'donations.donate': 'Doar',
    'donations.secure': 'Processamento de pagamento seguro. Obrigado pela sua generosidade.',
    'donations.reports': 'Relatórios de Transparência',
    'donations.raised': 'Total Arrecadado',
    'donations.donated': 'Total de Doações',
    'donations.donors': 'Doadores',
    'donations.report': 'Relatório',
    'donations.comingSoon': 'Relatórios em breve',
    'donations.comingSoonDesc': 'Assim que recebermos as primeiras doações, publicaremos relatórios detalhados de transparência aqui.',

    // Feature Requests
    'feedback.title': 'Ajude-nos a Construir Melhor',
    'feedback.subtitle': 'Envie solicitações de recursos, relate bugs e vote nas prioridades. Seu feedback molda nosso roadmap.',
    'feedback.submit': 'Enviar',
    'feedback.roadmap': 'Roadmap',
    'feedback.feature': 'Solicitação de Recurso',
    'feedback.bug': 'Relatar Bug',
    'feedback.title.label': 'Título',
    'feedback.title.placeholder.feature': 'Que recurso você gostaria?',
    'feedback.title.placeholder.bug': 'Breve descrição do bug',
    'feedback.desc.label': 'Descrição',
    'feedback.desc.placeholder.feature': 'Descreva o recurso e por que seria útil...',
    'feedback.desc.placeholder.bug': 'Passos para reproduzir, comportamento esperado vs real...',
    'feedback.email.label': 'Seu E-mail',
    'feedback.submit.feature': 'Enviar Solicitação',
    'feedback.submit.bug': 'Enviar Relatório',
    'feedback.status.planned': 'Planejado',
    'feedback.status.progress': 'Em Andamento',
    'feedback.status.completed': 'Concluído',
  }
};
