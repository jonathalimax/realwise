import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import TutorialModal from '../components/TutorialModal';
import {
  QuestionMarkCircleIcon,
  PlayCircleIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
  BookOpenIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

export default function HelpPage() {
  const navigate = useNavigate();
  const { language } = useSettings();
  const [showTutorial, setShowTutorial] = useState(false);

  const helpItems = [
    {
      icon: PlayCircleIcon,
      title: language === 'pt' ? 'Tutorial Interativo' : 'Interactive Tutorial',
      description: language === 'pt'
        ? 'Aprenda a usar o aplicativo passo a passo'
        : 'Learn how to use the app step by step',
      action: () => setShowTutorial(true),
      color: 'rose',
    },
    {
      icon: LightBulbIcon,
      title: language === 'pt' ? 'Sugestões de Funcionalidades' : 'Feature Requests',
      description: language === 'pt'
        ? 'Sugira novas funcionalidades para o app'
        : 'Suggest new features for the app',
      action: () => navigate('/feedback'),
      color: 'amber',
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: language === 'pt' ? 'Suporte' : 'Support',
      description: language === 'pt'
        ? 'Entre em contato com nossa equipe'
        : 'Get in touch with our team',
      action: () => navigate('/support'),
      color: 'blue',
    },
  ];

  const faqItems = [
    {
      question: language === 'pt' ? 'Como adicionar uma transação?' : 'How do I add a transaction?',
      answer: language === 'pt'
        ? 'No Dashboard, clique no botão + no canto inferior direito e selecione "Adicionar". Preencha os detalhes da transação e salve.'
        : 'On the Dashboard, click the + button in the bottom right corner and select "Add". Fill in the transaction details and save.',
    },
    {
      question: language === 'pt' ? 'Como importar extratos bancários?' : 'How do I import bank statements?',
      answer: language === 'pt'
        ? 'No Dashboard, clique no botão + e selecione "Importar". Arraste seu arquivo de extrato (CSV ou OFX) e o sistema detectará automaticamente o banco.'
        : 'On the Dashboard, click the + button and select "Import". Drag your statement file (CSV or OFX) and the system will automatically detect your bank.',
    },
    {
      question: language === 'pt' ? 'O que é a regra 50/30/20?' : 'What is the 50/30/20 rule?',
      answer: language === 'pt'
        ? 'É uma regra de orçamento que sugere dividir sua renda em: 50% para necessidades (moradia, contas, alimentação), 30% para desejos (lazer, compras) e 20% para poupança e investimentos.'
        : 'It\'s a budgeting rule that suggests dividing your income into: 50% for needs (housing, bills, food), 30% for wants (leisure, shopping), and 20% for savings and investments.',
    },
    {
      question: language === 'pt' ? 'Como funcionam as notificações de contas?' : 'How do bill notifications work?',
      answer: language === 'pt'
        ? 'O aplicativo enviará notificações push diariamente às 9h sobre contas próximas do vencimento. Permita as notificações quando solicitado.'
        : 'The app sends push notifications daily at 9 AM about bills that are due soon. Allow notifications when prompted.',
    },
    {
      question: language === 'pt' ? 'Posso compartilhar minha conta com outra pessoa?' : 'Can I share my account with someone else?',
      answer: language === 'pt'
        ? 'Sim! Nas Configurações, você pode adicionar usuários com acesso compartilhado à sua conta. Eles podem visualizar ou editar suas transações dependendo da permissão concedida.'
        : 'Yes! In Settings, you can add users with shared access to your account. They can view or edit your transactions depending on the permission granted.',
    },
  ];

  const colorClasses = {
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Ajuda' : 'Help'}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Quick Actions */}
        <div className="space-y-3 mb-8">
          {helpItems.map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all group"
            >
              <div className={`p-3 rounded-xl ${colorClasses[item.color]}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            </button>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-gray-500" />
              <h2 className="font-bold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Perguntas Frequentes' : 'Frequently Asked Questions'}
              </h2>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {faqItems.map((item, index) => (
              <details key={index} className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <span className="font-medium text-gray-900 dark:text-white pr-4">
                    {item.question}
                  </span>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0" />
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* App Version */}
        <div className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
          <p>Realwise v1.0.0</p>
          <p className="mt-1">
            {language === 'pt' ? 'Feito com ❤️ para você' : 'Made with ❤️ for you'}
          </p>
        </div>
      </main>

      {/* Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        isFirstTime={false}
      />
    </div>
  );
}
