import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import InstallPWAButton from './ui/InstallPWAButton';

// Topics that are selected by default for first-time users - simpler and shorter
const DEFAULT_SELECTED_TOPICS = ['basics', 'features'];

const TUTORIAL_TOPICS = [
  {
    id: 'basics',
    icon: '🚀',
    title: { pt: 'Como Começar', en: 'Getting Started' },
    content: {
      pt: {
        subtitle: 'O essencial para você começar',
        points: [
          '💰 Adicione Transações - Use o botão + para adicionar receitas e despesas',
          '🏦 Configure Bancos - Registre seus cartões para organizar melhor',
          '📊 Filtre por Mês - Navegue entre meses e use filtros por banco/categoria'
        ]
      },
      en: {
        subtitle: 'The essentials to get you started',
        points: [
          '💰 Add Transactions - Use the + button to add income and expenses',
          '🏦 Set Up Banks - Register your cards for better organization',
          '📊 Filter by Month - Navigate between months and use bank/category filters'
        ]
      }
    }
  },
  {
    id: 'features',
    icon: '⭐',
    title: { pt: 'Recursos Principais', en: 'Key Features' },
    content: {
      pt: {
        subtitle: 'Tudo que você precisa saber',
        points: [
          '📋 Contas a Pagar - Cadastre e receba notificações no WhatsApp',
          '🎯 Metas - Crie objetivos e acompanhe seu progresso',
          '📈 Investimentos - Registre e monitore rendimentos',
          '🌙 Modo Escuro - Toque no ícone sol/lua para alternar'
        ]
      },
      en: {
        subtitle: 'Everything you need to know',
        points: [
          '📋 Bills to Pay - Register and get WhatsApp notifications',
          '🎯 Goals - Create objectives and track progress',
          '📈 Investments - Record and monitor returns',
          '🌙 Dark Mode - Tap sun/moon icon to toggle'
        ]
      }
    }
  },
  {
    id: 'tips',
    icon: '💡',
    title: { pt: 'Dicas Rápidas', en: 'Quick Tips' },
    content: {
      pt: {
        subtitle: 'Aproveite ao máximo o Blim Wallet',
        points: [
          '📱 Instale como App - Use o botão de instalação para acesso rápido',
          '👥 Compartilhe - Adicione pessoas em Configurações > Acesso',
          '📁 Personalize - Crie categorias personalizadas em Configurações'
        ]
      },
      en: {
        subtitle: 'Make the most of Blim Wallet',
        points: [
          '📱 Install as App - Use the install button for quick access',
          '👥 Share - Add people in Settings > Access',
          '📁 Customize - Create custom categories in Settings'
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
                ? (lang === 'pt' ? 'Bem-vindo ao Blim Wallet!' : 'Welcome to Blim Wallet!')
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
                <div>
                  <InstallPWAButton />
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition"
                  >
                    {lang === 'pt' ? 'Pular' : 'Skip'}
                  </button>
                </div>
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
