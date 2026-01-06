import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Topics that are selected by default for first-time users
const DEFAULT_SELECTED_TOPICS = ['settings'];

const TUTORIAL_TOPICS = [
  {
    id: 'settings',
    icon: '⚙️',
    title: { pt: 'Configurações', en: 'Settings' },
    content: {
      pt: {
        subtitle: 'Personalize o app do seu jeito',
        points: [
          'Modo Escuro - Alterne entre tema claro e escuro clicando no ícone de sol/lua na barra superior',
          'Compartilhar Finanças - Adicione outras pessoas para acessar e gerenciar as finanças juntos (em Configurações > Acesso)',
          'Notificações WhatsApp - Configure números para receber lembretes de contas a pagar (em Configurações > WhatsApp)',
          'Categorias - Personalize as categorias de receitas e despesas (em Configurações > Categorias)'
        ]
      },
      en: {
        subtitle: 'Customize the app your way',
        points: [
          'Dark Mode - Toggle between light and dark theme by clicking the sun/moon icon in the top bar',
          'Share Finances - Add other people to access and manage finances together (in Settings > Access)',
          'WhatsApp Notifications - Set up phone numbers to receive bill reminders (in Settings > WhatsApp)',
          'Categories - Customize income and expense categories (in Settings > Categories)'
        ]
      }
    }
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: { pt: 'Visão Geral', en: 'Dashboard Overview' },
    content: {
      pt: {
        subtitle: 'Seu resumo financeiro em um só lugar',
        points: [
          'Cartões de Saldo - Veja receitas, despesas e saldo total instantaneamente',
          'Seletor de Mês - Navegue entre meses usando as setas ou o dropdown',
          'Filtros - Filtre por banco, categoria ou alterne entre visualização de compra/pagamento para cartões de crédito'
        ]
      },
      en: {
        subtitle: 'Your financial snapshot at a glance',
        points: [
          'Balance Cards - See income, expenses and total balance instantly',
          'Month Selector - Navigate between months using arrows or dropdown',
          'Filters - Filter by bank, category, or switch between purchase/payment view for credit cards'
        ]
      }
    }
  },
  {
    id: 'transactions',
    icon: '💳',
    title: { pt: 'Transações', en: 'Transactions' },
    content: {
      pt: {
        subtitle: 'Gerencie suas movimentações financeiras',
        points: [
          'Adicionar Manualmente - Clique no botão + e selecione "Adicionar" para criar transações de receita ou despesa',
          'Importar do Banco - Importe extratos CSV ou OFX diretamente do seu banco',
          'Parcelas e Recorrência - Configure transações parceladas ou recorrentes (mensal, semanal, anual)'
        ]
      },
      en: {
        subtitle: 'Manage your financial transactions',
        points: [
          'Add Manually - Click the + button and select "Add" to create income or expense transactions',
          'Import from Bank - Import CSV or OFX statements directly from your bank',
          'Installments & Recurring - Set up installment or recurring transactions (monthly, weekly, yearly)'
        ]
      }
    }
  },
  {
    id: 'categories',
    icon: '📁',
    title: { pt: 'Categorias e Orçamento', en: 'Categories & Budget' },
    content: {
      pt: {
        subtitle: 'Organize e controle seus gastos',
        points: [
          'Categorias - Organize transações em categorias como Alimentação, Moradia, Lazer, etc.',
          'Limites de Orçamento - Defina limites mensais por categoria e acompanhe seu progresso',
          'Regra 50/30/20 - Use a regra de planejamento financeiro: 50% necessidades, 30% desejos, 20% poupança'
        ]
      },
      en: {
        subtitle: 'Organize and control your spending',
        points: [
          'Categories - Organize transactions into categories like Food, Housing, Leisure, etc.',
          'Budget Limits - Set monthly limits per category and track your progress',
          '50/30/20 Rule - Use the financial planning rule: 50% needs, 30% wants, 20% savings'
        ]
      }
    }
  },
  {
    id: 'banks',
    icon: '🏦',
    title: { pt: 'Bancos e Cartões', en: 'Banks & Cards' },
    content: {
      pt: {
        subtitle: 'Gerencie múltiplas contas',
        points: [
          'Adicionar Bancos - Registre seus bancos e cartões de crédito para melhor organização',
          'Data de Fechamento - Configure o dia de fechamento da fatura do cartão de crédito',
          'Visualização Compra vs Pagamento - Alterne entre ver transações pela data da compra ou mês de pagamento'
        ]
      },
      en: {
        subtitle: 'Manage multiple accounts',
        points: [
          'Add Banks - Register your banks and credit cards for better organization',
          'Closing Date - Set up your credit card statement closing date',
          'Purchase vs Payment View - Switch between viewing transactions by purchase date or payment month'
        ]
      }
    }
  },
  {
    id: 'bills',
    icon: '📋',
    title: { pt: 'Contas a Pagar', en: 'Bills & Reminders' },
    content: {
      pt: {
        subtitle: 'Nunca perca um vencimento',
        points: [
          'Criar Contas - Adicione contas com data de vencimento, valor e recorrência',
          'Marcar como Pago - Com um clique, marque contas como pagas',
          'Notificações WhatsApp - Receba lembretes no WhatsApp antes do vencimento'
        ]
      },
      en: {
        subtitle: 'Never miss a due date',
        points: [
          'Create Bills - Add bills with due date, amount and recurrence',
          'Mark as Paid - With one click, mark bills as paid',
          'WhatsApp Notifications - Receive reminders on WhatsApp before due dates'
        ]
      }
    }
  },
  {
    id: 'goals',
    icon: '🎯',
    title: { pt: 'Metas e Poupança', en: 'Goals & Savings' },
    content: {
      pt: {
        subtitle: 'Alcance seus objetivos financeiros',
        points: [
          'Criar Metas - Defina metas como viagem, carro, casa ou reserva de emergência',
          'Acompanhar Progresso - Visualize quanto falta para atingir cada meta',
          'Adicionar Fundos - Registre contribuições e veja a evolução ao longo do tempo'
        ]
      },
      en: {
        subtitle: 'Achieve your financial goals',
        points: [
          'Create Goals - Set goals like travel, car, house or emergency fund',
          'Track Progress - See how much is left to reach each goal',
          'Add Funds - Record contributions and see progress over time'
        ]
      }
    }
  },
  {
    id: 'investments',
    icon: '📈',
    title: { pt: 'Investimentos', en: 'Investments' },
    content: {
      pt: {
        subtitle: 'Acompanhe sua carteira',
        points: [
          'Adicionar Investimentos - Registre renda fixa, ações, fundos, cripto e imóveis',
          'Vincular a Metas - Associe investimentos às suas metas de poupança',
          'Calcular Rendimentos - Acompanhe rendimentos e impostos (IOF, IR) automaticamente'
        ]
      },
      en: {
        subtitle: 'Track your portfolio',
        points: [
          'Add Investments - Record fixed income, stocks, funds, crypto and real estate',
          'Link to Goals - Associate investments with your savings goals',
          'Calculate Returns - Track returns and taxes automatically'
        ]
      }
    }
  }
];

export default function TutorialModal({ isOpen, onClose, isFirstTime = false }) {
  const { language, setTutorialCompleted } = useSettings();
  const [selectedTopics, setSelectedTopics] = useState(DEFAULT_SELECTED_TOPICS);
  const [currentStep, setCurrentStep] = useState(0); // 0 = selection screen
  const [viewingTopics, setViewingTopics] = useState([]);

  if (!isOpen) return null;

  const lang = language === 'pt' ? 'pt' : 'en';

  const toggleTopic = (topicId) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleStart = () => {
    if (selectedTopics.length === 0) {
      handleSkip();
      return;
    }
    const topics = TUTORIAL_TOPICS.filter(t => selectedTopics.includes(t.id));
    setViewingTopics(topics);
    setCurrentStep(1);
  };

  const handleSkip = async () => {
    if (isFirstTime) {
      await setTutorialCompleted(true);
    }
    onClose();
    resetState();
  };

  const handleNext = () => {
    if (currentStep < viewingTopics.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      setCurrentStep(0);
    }
  };

  const handleFinish = async () => {
    if (isFirstTime) {
      await setTutorialCompleted(true);
    }
    onClose();
    resetState();
  };

  const resetState = () => {
    setCurrentStep(0);
    setSelectedTopics(DEFAULT_SELECTED_TOPICS);
    setViewingTopics([]);
  };

  const currentTopic = viewingTopics[currentStep - 1];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={handleSkip} />
      <div className="absolute inset-4 sm:inset-8 lg:inset-16 xl:inset-24 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {currentStep === 0
                ? (lang === 'pt' ? 'Bem-vindo ao Limas Finance!' : 'Welcome to Limas Finance!')
                : currentTopic?.title[lang]
              }
            </h2>
            <button
              onClick={handleSkip}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {currentStep === 0 ? (
              // Topic Selection Screen
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {lang === 'pt'
                    ? 'Selecione os tópicos que gostaria de aprender:'
                    : 'Select the topics you would like to learn:'}
                </p>
                <div className="space-y-2">
                  {TUTORIAL_TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all ${
                        selectedTopics.includes(topic.id)
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        selectedTopics.includes(topic.id)
                          ? 'bg-rose-500 border-rose-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {selectedTopics.includes(topic.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-2xl">{topic.icon}</span>
                      <span className={`font-medium ${
                        selectedTopics.includes(topic.id)
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {topic.title[lang]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Topic Content Card
              <div>
                <div className="text-center mb-6">
                  <span className="text-5xl mb-4 block">{currentTopic?.icon}</span>
                  <p className="text-gray-600 dark:text-gray-400">
                    {currentTopic?.content[lang].subtitle}
                  </p>
                </div>
                <div className="space-y-4">
                  {currentTopic?.content[lang].points.map((point, index) => (
                    <div key={index} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex-shrink-0 w-6 h-6 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
                        <span className="text-rose-600 dark:text-rose-400 text-sm font-bold">{index + 1}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {currentStep === 0 ? (
              <>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition"
                >
                  {lang === 'pt' ? 'Pular' : 'Skip'}
                </button>
                <button
                  onClick={handleStart}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition flex items-center gap-2"
                >
                  {selectedTopics.length === 0
                    ? (lang === 'pt' ? 'Fechar' : 'Close')
                    : (lang === 'pt' ? 'Começar' : 'Start')
                  }
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition flex items-center gap-1"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                  {lang === 'pt' ? 'Voltar' : 'Back'}
                </button>
                <div className="flex items-center gap-2">
                  {viewingTopics.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition ${
                        index + 1 === currentStep
                          ? 'bg-rose-500 w-4'
                          : index + 1 < currentStep
                          ? 'bg-rose-300 dark:bg-rose-700'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition flex items-center gap-2"
                >
                  {currentStep < viewingTopics.length
                    ? (lang === 'pt' ? 'Próximo' : 'Next')
                    : (lang === 'pt' ? 'Concluir' : 'Finish')
                  }
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
