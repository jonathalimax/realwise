import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';

/**
 * Lightweight hook that reads savingsRows from the Firestore planner doc.
 * Returns an array of { id, label } for use in form dropdowns.
 */
export default function usePlannerGoals() {
  const { ownerId } = useAccess();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    const unsubscribe = onSnapshot(doc(db, 'planner', ownerId), (snap) => {
      if (snap.exists()) {
        const rows = snap.data().savingsRows ?? [];
        setGoals(rows.map(r => ({ id: r.id, label: r.label })));
      }
    });
    return unsubscribe;
  }, [ownerId]);

  return goals;
}
