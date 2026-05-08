import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useCards } from '@/contexts/CardsContext';

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
