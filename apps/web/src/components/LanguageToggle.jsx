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
    'hero.subheadline': 'A simple, private finance tracker that helps you manage, track, and analyze your money—without AI, and with full transparency.',
    'hero.cta': 'Start Free',
    'hero.note': 'Manual tracking and imports stay free forever.',
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
    'pricing.title': 'Start Free. Upgrade For More Control.',
    'pricing.subtitle': 'Manual tracking and imports are free. Premium unlocks planning, bills, investments, and spending guidance.',
    'pricing.badge': 'Free core + Premium',
    'pricing.complete': 'Premium Unlock',
    'pricing.feature1': 'Planning and category limits',
    'pricing.feature2': 'Bills and reminders',
    'pricing.feature3': 'Investments and goals',
    'pricing.feature4': 'How much is left to spend',
    'pricing.feature5': 'Desktop and mobile',
    'pricing.feature6': 'Clear charts and private data ownership',
    'pricing.why1.title': 'Bilingual',
    'pricing.why1.desc': 'English & Portuguese',
    'pricing.why2.title': 'Privacy First',
    'pricing.why2.desc': 'Your data is yours',
    'pricing.why3.title': 'Upgrade Later',
    'pricing.why3.desc': 'Start free and pay when premium helps',
    'pricing.onetime': 'premium unlock',
    'pricing.converted': 'approx.',
    'pricing.cta': 'Start Free',
    'pricing.guarantee': 'Premium unlock available anytime',
    'pricing.why.title': 'Simple & Transparent',
    'pricing.why.desc': 'No hidden fees, no subscriptions. Just a one-time purchase with clear terms and conditions.',
    'pricing.note': 'The free core helps you track and import. Premium adds forward-looking guidance and advanced control.',

    // FAQ
    'faq.label': 'FAQ',
    'faq.title': 'Frequently asked questions',

    // Footer
    'footer.title': 'Start tracking for free—',
    'footer.title2': 'upgrade only when you want more control',
    'footer.desc': 'Use the free core for tracking and imports. Unlock premium tools later for planning, bills, and investments.',
    'footer.cta': 'Start Free',
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
    'hero.subheadline': 'Um rastreador de finanças simples e privado que ajuda você a gerenciar, acompanhar e analisar seu dinheiro—sem IA e com total transparência.',
    'hero.cta': 'Começar grátis',
    'hero.note': 'Transações manuais e importação ficam grátis para sempre.',
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
    'pricing.title': 'Comece grátis. Faça upgrade para ter mais controle.',
    'pricing.subtitle': 'Lançamentos manuais e importação são grátis. O Premium desbloqueia planejamento, contas, investimentos e orientação de gastos.',
    'pricing.badge': 'Core gratuito + Premium',
    'pricing.complete': 'Desbloqueio Premium',
    'pricing.feature1': 'Planejamento e limites por categoria',
    'pricing.feature2': 'Contas e lembretes',
    'pricing.feature3': 'Investimentos e metas',
    'pricing.feature4': 'Quanto ainda dá para gastar',
    'pricing.feature5': 'Desktop e celular',
    'pricing.feature6': 'Gráficos claros e seus dados sob seu controle',
    'pricing.why1.title': 'Bilíngue',
    'pricing.why1.desc': 'Português e Inglês',
    'pricing.why2.title': 'Privacidade',
    'pricing.why2.desc': 'Seus dados são seus',
    'pricing.why3.title': 'Upgrade depois',
    'pricing.why3.desc': 'Comece grátis e pague quando o Premium ajudar',
    'pricing.onetime': 'desbloqueio premium',
    'pricing.converted': 'aprox.',
    'pricing.cta': 'Começar grátis',
    'pricing.guarantee': 'O desbloqueio Premium fica disponível quando você quiser',
    'pricing.why.title': 'Simples & Transparente',
    'pricing.why.desc': 'Sem taxas ocultas, sem assinaturas. Apenas uma compra única com termos e condições claros.',
    'pricing.note': 'O núcleo gratuito ajuda você a acompanhar e importar. O Premium adiciona orientação futura e controle avançado.',

    // FAQ
    'faq.label': 'Perguntas Frequentes',
    'faq.title': 'Perguntas frequentes',

    // Footer
    'footer.title': 'Comece a acompanhar de graça—',
    'footer.title2': 'faça upgrade só quando quiser mais controle',
    'footer.desc': 'Use o núcleo gratuito para acompanhar e importar. Desbloqueie depois as ferramentas Premium de planejamento, contas e investimentos.',
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
