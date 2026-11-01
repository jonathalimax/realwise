import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { XMarkIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

const STEPS = [
  {
    icon: '👋',
    title: { pt: 'Bem-vindo ao Realwise!', en: 'Welcome to Realwise!' },
    description: {
      pt: 'Veja como configurar tudo em 3 passos simples para começar a controlar suas finanças.',
      en: 'Here\'s how to get set up in 3 simple steps so you can start managing your finances.',
    },
    action: null,
  },
  {
    icon: '🏦',
    title: { pt: 'Adicione um banco ou cartão', en: 'Add a bank or card' },
    description: {
      pt: 'Registre seus bancos e cartões para organizar melhor de onde vem e para onde vai seu dinheiro.',
      en: 'Register your banks and cards to better track where your money comes from and where it goes.',
    },
    action: {
      label: { pt: 'Ir para Bancos', en: 'Go to Banks' },
      route: '/cards',
    },
  },
  {
    icon: '💰',
    title: { pt: 'Registre suas entradas', en: 'Record your income' },
    description: {
      pt: 'Use o botão + na página de Entradas para adicionar seu salário e outras receitas do mês.',
      en: 'Use the + button on the Income page to add your salary and other monthly earnings.',
    },
    action: {
      label: { pt: 'Ir para Entradas', en: 'Go to Income' },
      route: '/income',
    },
  },
  {
    icon: '💸',
    title: { pt: 'Registre suas saídas', en: 'Record your expenses' },
    description: {
      pt: 'Use o botão + na página de Saídas para registrar suas despesas e acompanhar seus gastos.',
      en: 'Use the + button on the Expenses page to log your spending and keep track of outflows.',
    },
    action: {
      label: { pt: 'Ir para Saídas', en: 'Go to Expenses' },
      route: '/expenses',
    },
  },
];

export default function TutorialModal({ isOpen, onClose, isFirstTime = false }) {
  const { language, setTutorialCompleted } = useSettings();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const lang = language === 'pt' ? 'pt' : 'en';
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const handleClose = () => {
    if (isFirstTime) {
      setTutorialCompleted(true).catch(err =>
        console.error('Error marking tutorial completed:', err)
      );
    }
    setStep(0);
    onClose();
  };

  const handleAction = () => {
    if (current.action) {
      navigate(current.action.route);
    }
    handleClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-[var(--rw-surface)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition z-10"
          aria-label={lang === 'pt' ? 'Fechar' : 'Close'}
        >
          <XMarkIcon className="w-5 h-5 text-[var(--rw-muted)]" />
        </button>

        {/* Content */}
        <div className="px-6 pt-10 pb-6 text-center">
          <div className="text-6xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-[var(--rw-ink)] mb-3">
            {current.title[lang]}
          </h2>
          <p className="text-[var(--rw-muted)] text-sm leading-relaxed">
            {current.description[lang]}
          </p>
        </div>

        {/* Action button (steps 1–3) */}
        {current.action && (
          <div className="px-6 pb-4">
            <button
              onClick={handleAction}
              className="w-full py-2.5 bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)] font-medium text-sm rounded-xl hover:bg-violet-100 dark:hover:bg-violet-900/50 transition"
            >
              {current.action.label[lang]} →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--rw-border)]">
          {/* Back */}
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={isFirst}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:invisible"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step
                    ? 'w-5 h-2 bg-[var(--rw-brand)]'
                    : 'w-2 h-2 bg-[var(--rw-track)] hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              />
            ))}
          </div>

          {/* Next / Finish */}
          {isLast ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[var(--rw-brand)] hover:opacity-90 text-white text-sm font-medium rounded-xl transition"
            >
              {lang === 'pt' ? 'Começar' : 'Get started'}
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
