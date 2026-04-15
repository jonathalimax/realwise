import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useCards } from '@/contexts/CardsContext';
import {
  ONBOARDING_STEPS,
  isOnboardingComplete,
  countCompletedSteps,
} from '@/config/onboardingSteps';

const STEP_ROUTES = {
  account: '/cards',
  renda: '/planner',
  transaction: '/transactions',
};

function StepIndicator({ steps, currentIndex, completedCount }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const done = step.isComplete;
        const active = i === currentIndex;
        return (
          <div
            key={step.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              done
                ? 'bg-violet-500 flex-1'
                : active
                  ? 'bg-violet-300 dark:bg-violet-700 flex-1'
                  : 'bg-gray-200 dark:bg-gray-700 flex-1'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function OnboardingWizard({ profile, onDismiss }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isOnboardingComplete(profile)) return null;

  const stepsWithStatus = ONBOARDING_STEPS.map(step => ({
    ...step,
    isComplete: step.isComplete(profile),
  }));

  const currentIndex = stepsWithStatus.findIndex(s => !s.isComplete);
  const current = stepsWithStatus[currentIndex];
  const completedCount = countCompletedSteps(profile);
  const total = ONBOARDING_STEPS.length;

  function handleAction() {
    const route = STEP_ROUTES[current.id];
    if (route) navigate(route);
  }

  function handleDismiss() {
    setDismissed(true);
    if (onDismiss) onDismiss();
  }

  return (
    <div className="mx-4 mt-4 mb-0 md:mx-6 md:mt-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-violet-100 dark:border-violet-900/40 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
              <span className="text-sm">🚀</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                Primeiros passos
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {completedCount} de {total} concluídos
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <StepIndicator
            steps={stepsWithStatus}
            currentIndex={currentIndex}
            completedCount={completedCount}
          />
        </div>

        {/* Current step */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {current.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
              {current.subtitle}
            </p>
          </div>
          <button
            onClick={handleAction}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
          >
            Começar
          </button>
        </div>

        {/* Completed steps list (collapsed by default — only show when progress > 0) */}
        {completedCount > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
            {stepsWithStatus.filter(s => s.isComplete).map(step => (
              <div key={step.id} className="flex items-center gap-2">
                <span className="text-green-500 text-xs">✓</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 line-through">
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook that builds the onboarding profile from live app state.
 * Returns { profile, loading }.
 */
export function useOnboardingProfile() {
  const { ownerId } = useAccess();
  const { userBanks } = useCards();
  const [hasTransaction, setHasTransaction] = useState(false);
  const [hasRenda, setHasRenda] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) { setLoading(false); return; }

    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId),
      limit(1),
    );

    Promise.all([
      getDocs(txQuery),
      getDocs(query(collection(db, 'planner'), where('__name__', '==', ownerId))),
    ])
      .then(([txSnap, plannerSnap]) => {
        setHasTransaction(!txSnap.empty);
        const plannerData = plannerSnap.docs[0]?.data();
        setHasRenda((plannerData?.salarioBruto ?? 0) > 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ownerId]);

  const profile = {
    hasAccount: userBanks.length > 0,
    hasRenda,
    hasTransaction,
  };

  return { profile, loading };
}
