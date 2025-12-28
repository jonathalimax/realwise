import React, { createContext, useContext, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

// Convert CMS format (hero_badge_pt) to translation key format (hero.badge)
const cmsToTranslationKey = (cmsKey) => {
  // Remove _pt or _en suffix
  const key = cmsKey.replace(/_pt$|_en$/, '');
  // Convert underscores to dots
  return key.replace(/_/g, '.');
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('pt');
  const [cmsContent, setCmsContent] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('language');
    if (saved) {
      setLanguage(saved);
    }

    // Fetch CMS content
    const fetchCMS = async () => {
      try {
        const contentDoc = await getDoc(doc(db, 'cms', 'content'));
        if (contentDoc.exists()) {
          setCmsContent(contentDoc.data());
        }
      } catch (error) {
        console.error('Error fetching CMS content:', error);
      }
      setLoading(false);
    };
    fetchCMS();
  }, []);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'pt' : 'en';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  // Translation function that checks CMS first, then falls back to static translations
  const t = (key) => {
    // Convert key format: hero.badge -> hero_badge
    const cmsKey = key.replace(/\./g, '_') + '_' + language;

    // Check CMS content first
    if (cmsContent[cmsKey] && cmsContent[cmsKey].trim() !== '') {
      return cmsContent[cmsKey];
    }

    // Fall back to static translations
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, loading }}>
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
    'hero.badge': '50% of proceeds go to the church',
    'hero.headline1': 'Track, plan, and grow',
    'hero.headline2': 'your finances',
    'hero.subheadline': 'A simple, private finance tracker that helps you manage, track, and analyze your money—without AI, and with full transparency.',
    'hero.cta': 'Get Early Access',
    'hero.note': 'One-time purchase. No subscriptions.',
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
    'pricing.title': 'Lifetime Access—One Payment',
    'pricing.subtitle': 'Pay once, use forever. No monthly fees.',
    'pricing.badge': '50% goes to the church',
    'pricing.complete': 'Complete Access',
    'pricing.feature1': 'Full app access on web & mobile',
    'pricing.feature2': 'Unlimited transactions & accounts',
    'pricing.feature3': 'All current and future features',
    'pricing.feature4': 'Lifetime updates included',
    'pricing.feature5': 'Priority support',
    'pricing.onetime': 'one-time',
    'pricing.converted': 'approx.',
    'pricing.cta': 'Get Early Access',
    'pricing.guarantee': '30-day money-back guarantee',
    'pricing.why.title': 'Why We Donate',
    'pricing.why.desc': 'We believe tools that help people steward their finances should give back. That\'s why half of every purchase supports church work. We publish donation reports regularly so you can see exactly where funds go.',
    'pricing.note': 'One system per person. Your data stored in your own database account. Optional maintenance available. No hosting or domain fees required.',

    // FAQ
    'faq.label': 'FAQ',
    'faq.title': 'Frequently asked questions',

    // Footer
    'footer.title': 'Start tracking smarter—',
    'footer.title2': 'no subscriptions, full transparency',
    'footer.desc': 'Take control of your finances with a tool that respects your privacy and supports a greater purpose.',
    'footer.cta': 'Get Early Access',
    'footer.support': 'Support',
    'footer.feedback': 'Feedback Portal',
    'footer.donations': 'Donations',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.made': 'Made with',

    // Navigation
    'nav.back': 'Back to Home',

    // Donations
    'donations.title': 'Support Development & Give Generously',
    'donations.subtitle': '50% of all donations go to GOD\'s work through the church. We publish transparent donation receipts and impact summaries.',
    'donations.select': 'Select Amount',
    'donations.custom': 'Custom amount',
    'donations.impact': 'Your Impact',
    'donations.impact.desc': 'of your donation will go directly to church ministry work.',
    'donations.name': 'Name',
    'donations.name.placeholder': 'Your name (optional)',
    'donations.email': 'Email',
    'donations.email.placeholder': 'you@example.com',
    'donations.donate': 'Donate',
    'donations.secure': 'Secure payment processing. Thank you for your generosity.',
    'donations.reports': 'Transparency Reports',
    'donations.raised': 'Total Raised',
    'donations.donated': 'Donated to Church',
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
    'hero.badge': '50% dos valores vão para a igreja',
    'hero.headline1': 'Acompanhe, planeje e expanda',
    'hero.headline2': 'suas finanças',
    'hero.subheadline': 'Um rastreador de finanças simples e privado que ajuda você a gerenciar, acompanhar e analisar seu dinheiro—sem IA e com total transparência.',
    'hero.cta': 'Acesso Antecipado',
    'hero.note': 'Compra única. Sem assinaturas.',
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
    'pricing.title': 'Acesso Vitalício—Um Pagamento',
    'pricing.subtitle': 'Pague uma vez, use para sempre. Sem mensalidades.',
    'pricing.badge': '50% vão para a igreja',
    'pricing.complete': 'Acesso Completo',
    'pricing.feature1': 'Acesso completo ao app web e mobile',
    'pricing.feature2': 'Transações e contas ilimitadas',
    'pricing.feature3': 'Todos os recursos atuais e futuros',
    'pricing.feature4': 'Atualizações vitalícias incluídas',
    'pricing.feature5': 'Suporte prioritário',
    'pricing.onetime': 'único',
    'pricing.converted': 'aprox.',
    'pricing.cta': 'Acesso Antecipado',
    'pricing.guarantee': 'Garantia de reembolso de 30 dias',
    'pricing.why.title': 'Por Que Doamos',
    'pricing.why.desc': 'Acreditamos que ferramentas que ajudam as pessoas a administrar suas finanças devem retribuir. É por isso que metade de cada compra apoia o trabalho da igreja. Publicamos relatórios de doações regularmente para que você possa ver exatamente para onde os fundos vão.',
    'pricing.why.verse': 'Tudo o que fizerem, façam de todo o coração, como para o Senhor, não para os homens, sabendo que receberão do Senhor a recompensa da herança, pois é a Cristo, o Senhor, a quem vocês servem.',
    'pricing.why.verse.ref': 'Colossenses 3:23-24',
    'pricing.note': 'Um sistema por pessoa. Seus dados armazenados na sua própria conta de banco de dados. Manutenção opcional disponível. Sem taxas de hospedagem ou domínio.',

    // FAQ
    'faq.label': 'Perguntas Frequentes',
    'faq.title': 'Perguntas frequentes',

    // Footer
    'footer.title': 'Comece a rastrear de forma mais inteligente—',
    'footer.title2': 'sem assinaturas, total transparência',
    'footer.desc': 'Assuma o controle de suas finanças com uma ferramenta que respeita sua privacidade e apoia um propósito maior.',
    'footer.cta': 'Acesso Antecipado',
    'footer.support': 'Suporte',
    'footer.feedback': 'Portal de Feedback',
    'footer.donations': 'Doações',
    'footer.privacy': 'Privacidade',
    'footer.terms': 'Termos',
    'footer.made': 'Feito com',

    // Navigation
    'nav.back': 'Voltar para Home',

    // Donations
    'donations.title': 'Apoie o Desenvolvimento & Doe Generosamente',
    'donations.subtitle': '50% de todas as doações vão para o trabalho de DEUS através da igreja. Publicamos recibos de doação transparentes e resumos de impacto.',
    'donations.select': 'Selecione o Valor',
    'donations.custom': 'Valor personalizado',
    'donations.impact': 'Seu Impacto',
    'donations.impact.desc': 'da sua doação irão diretamente para o trabalho ministerial da igreja.',
    'donations.name': 'Nome',
    'donations.name.placeholder': 'Seu nome (opcional)',
    'donations.email': 'E-mail',
    'donations.email.placeholder': 'voce@exemplo.com',
    'donations.donate': 'Doar',
    'donations.secure': 'Processamento de pagamento seguro. Obrigado pela sua generosidade.',
    'donations.reports': 'Relatórios de Transparência',
    'donations.raised': 'Total Arrecadado',
    'donations.donated': 'Doado à Igreja',
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
