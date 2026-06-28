import { useState, useEffect } from 'react';
import { useAccess } from '@/contexts/AccessContext';
import { useCards } from '@/contexts/CardsContext';
import { plannerResource } from '@/lib/api/resources/planner';
import { transactionsResource } from '@/lib/api/resources/transactions';

/**
 * Builds the onboarding profile by reading live app state.
 * Returns { profile }.
 *
 * profile shape: { hasAccount, hasRenda, hasTransaction }
 */
export function useOnboardingProfile() {
  const { ownerId } = useAccess();
  const { userBanks } = useCards();
  const [hasTransaction, setHasTransaction] = useState(false);
  const [hasRenda, setHasRenda] = useState(false);

  useEffect(() => {
    if (!ownerId) return;

    Promise.all([
      transactionsResource.list({ limit: 1 }),
      plannerResource.get(),
    ])
      .then(([transactions, plannerData]) => {
        setHasTransaction(Array.isArray(transactions) && transactions.length > 0);
        setHasRenda((plannerData?.salaryGross ?? plannerData?.salarioBruto ?? 0) > 0);
      })
      .catch(() => {});
  }, [ownerId]);

  return {
    profile: {
      hasAccount: userBanks.length > 0,
      hasRenda,
      hasTransaction,
    },
  };
}
