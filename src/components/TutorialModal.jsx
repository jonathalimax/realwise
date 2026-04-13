import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import InstallPWAButton from './ui/InstallPWAButton';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

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
          '📋 Contas a Pagar - Cadastre e receba notificações push sobre vencimentos',
          '🎯 Metas - Crie objetivos e acompanhe seu progresso',
          '📈 Investimentos - Registre e monitore rendimentos',
          '🌙 Modo Escuro - Toque no ícone sol/lua para alternar'
        ]
      },
      en: {
        subtitle: 'Everything you need to know',
        points: [
          '📋 Bills to Pay - Register and get push notifications for due dates',
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

  // Sharing step state
  const [phase, setPhase] = useState('selection'); // 'selection' | 'content' | 'sharing'
  const [sharedEmails, setSharedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailRole, setNewEmailRole] = useState('write');
  const [isSaving, setIsSaving] = useState(false);

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
    setPhase('content');
  };

  const handleSkip = async () => {
    try {
      if (isFirstTime) {
        await setTutorialCompleted(true);
      }
    } catch (err) {
      console.error('Error marking tutorial completed:', err);
    } finally {
      onClose();
      resetState();
    }
  };

  const handleNext = () => {
    if (phase === 'content' && currentStep < viewingTopics.length) {
      setCurrentStep(prev => prev + 1);
    } else if (phase === 'content' && currentStep >= viewingTopics.length) {
      // Show sharing step for first-time users
      if (isFirstTime) {
        setPhase('sharing');
      } else {
        handleFinish();
      }
    } else if (phase === 'sharing') {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (phase === 'sharing') {
      setPhase('content');
      setCurrentStep(viewingTopics.length);
    } else if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      setCurrentStep(0);
      setPhase('selection');
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      // Save shared emails if any
      if (sharedEmails.length > 0 && auth.currentUser) {
        await saveSharedEmails();
      }

      if (isFirstTime) {
        await setTutorialCompleted(true);
      }
    } catch (err) {
      console.error('Error finishing tutorial:', err);
    } finally {
      setIsSaving(false);
      onClose();
      resetState();
    }
  };

  const resetState = () => {
    setCurrentStep(0);
    setSelectedTopics(DEFAULT_SELECTED_TOPICS);
    setViewingTopics([]);
    setPhase('selection');
    setSharedEmails([]);
    setNewEmail('');
    setNewEmailRole('write');
  };

  // Email sharing functions
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addEmail = () => {
    const emailToAdd = newEmail.trim().toLowerCase();
    if (!emailToAdd || !isValidEmail(emailToAdd)) return;

    // Check if already added
    if (sharedEmails.some(e => e.email === emailToAdd)) return;

    // Don't add own email
    if (auth.currentUser?.email?.toLowerCase() === emailToAdd) return;

    setSharedEmails(prev => [...prev, { email: emailToAdd, role: newEmailRole }]);
    setNewEmail('');
    setNewEmailRole('write');
  };

  const removeEmail = (emailToRemove) => {
    setSharedEmails(prev => prev.filter(e => e.email !== emailToRemove));
  };

  const saveSharedEmails = async () => {
    if (!auth.currentUser || sharedEmails.length === 0) return;

    try {
      const accessRef = doc(db, 'access', 'allowed_emails');
      const existingDoc = await getDoc(accessRef);

      let emails = [];
      if (existingDoc.exists()) {
        const data = existingDoc.data();
        emails = data.emails || [];
        // Convert old format to new format if needed
        if (emails.length > 0 && typeof emails[0] === 'string') {
          emails = emails.map(e => ({ email: e, role: 'write' }));
        }
      }

      // Add new emails (avoid duplicates)
      for (const newEmailEntry of sharedEmails) {
        if (!emails.some(e => e.email === newEmailEntry.email)) {
          emails.push(newEmailEntry);
        }
      }

      await setDoc(accessRef, {
        emails,
        ownerId: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving shared emails:', error);
    }
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
              {phase === 'selection'
                ? (lang === 'pt' ? 'Bem-vindo ao Blim Wallet!' : 'Welcome to Blim Wallet!')
                : phase === 'sharing'
                ? (lang === 'pt' ? 'Compartilhar Acesso' : 'Share Access')
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
            {phase === 'sharing' ? (
              // Sharing Step Screen
              <div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {lang === 'pt'
                    ? 'Convide pessoas para acessar seus dados financeiros. Você pode gerenciar isso depois em Configurações > Acesso.'
                    : 'Invite people to access your financial data. You can manage this later in Settings > Access.'}
                </p>

                {/* Add Email Input */}
                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                      placeholder={lang === 'pt' ? 'Digite o e-mail...' : 'Enter email...'}
                      className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white placeholder-gray-400
                        focus:border-rose-500 dark:focus:border-rose-400 focus:ring-0 focus:outline-none transition"
                    />
                    <select
                      value={newEmailRole}
                      onChange={(e) => setNewEmailRole(e.target.value)}
                      className="px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                        text-gray-900 dark:text-white text-sm
                        focus:border-rose-500 dark:focus:border-rose-400 focus:ring-0 focus:outline-none transition"
                    >
                      <option value="write">{lang === 'pt' ? 'Editar' : 'Edit'}</option>
                      <option value="read">{lang === 'pt' ? 'Visualizar' : 'View only'}</option>
                    </select>
                    <button
                      onClick={addEmail}
                      disabled={!newEmail.trim() || !isValidEmail(newEmail)}
                      className="px-4 py-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Email List */}
                {sharedEmails.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {sharedEmails.map((entry) => (
                      <div
                        key={entry.email}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{entry.email}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {entry.role === 'write'
                              ? (lang === 'pt' ? 'Pode editar' : 'Can edit')
                              : (lang === 'pt' ? 'Apenas visualizar' : 'View only')}
                          </p>
                        </div>
                        <button
                          onClick={() => removeEmail(entry.email)}
                          className="p-2 text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-700/50 rounded-xl mb-4">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      {lang === 'pt'
                        ? 'Nenhum e-mail adicionado ainda'
                        : 'No emails added yet'}
                    </p>
                  </div>
                )}

                {/* Info Note */}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {lang === 'pt'
                    ? '* Pessoas com acesso "Editar" podem adicionar e modificar transações. "Visualizar" permite apenas ver os dados.'
                    : '* People with "Edit" access can add and modify transactions. "View only" allows just viewing data.'}
                </p>
              </div>
            ) : phase === 'selection' ? (
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
            {phase === 'selection' ? (
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
            ) : phase === 'sharing' ? (
              <>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition flex items-center gap-1"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                  {lang === 'pt' ? 'Voltar' : 'Back'}
                </button>
                <div className="flex items-center gap-2">
                  {/* Progress dots for topics + sharing */}
                  {viewingTopics.map((_, index) => (
                    <div
                      key={index}
                      className="w-2 h-2 rounded-full bg-rose-300 dark:bg-rose-700"
                    />
                  ))}
                  <div className="w-4 h-2 rounded-full bg-rose-500" />
                </div>
                <button
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving
                    ? (lang === 'pt' ? 'Salvando...' : 'Saving...')
                    : sharedEmails.length > 0
                    ? (lang === 'pt' ? 'Salvar e Concluir' : 'Save & Finish')
                    : (lang === 'pt' ? 'Pular' : 'Skip')
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
                  {/* Show dot for sharing step if first time user */}
                  {isFirstTime && (
                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                  )}
                </div>
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition flex items-center gap-2"
                >
                  {currentStep < viewingTopics.length
                    ? (lang === 'pt' ? 'Próximo' : 'Next')
                    : isFirstTime
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
