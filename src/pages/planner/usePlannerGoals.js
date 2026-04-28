import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';

/**
 * Lightweight hook that reads wallet sublayers from the Firestore planner doc.
 * Prefers walletVersions sublayers (covers all layers including crescimento and
 * custom sublayers). Falls back to savingsRows for legacy planner docs.
 * Returns an array of { id, label, layerLabel } for use in form dropdowns.
 */
export default function usePlannerGoals() {
  const { ownerId } = useAccess();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (!ownerId) return;

    let unsubscribe;
    try {
      unsubscribe = onSnapshot(
        doc(db, 'planner', ownerId),
        (snap) => {
          if (!snap.exists()) {
            setGoals([]);
            return;
          }

          const data = snap.data();
          const walletVersions = data.walletVersions ?? [];

          if (walletVersions.length > 0) {
            // Use the most recent wallet version to get all sublayers
            const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            const sorted = [...walletVersions].sort((a, b) => a.from.localeCompare(b.from));
            let activeVersion = null;
            for (const v of sorted) {
              if (v.from <= currentMonth) activeVersion = v;
            }
            const version = activeVersion ?? sorted[sorted.length - 1];
            const sublayers = (version?.layers ?? []).flatMap(layer =>
              (layer.sublayers ?? []).map(sub => ({
                id: sub.id,
                label: sub.label,
                layerLabel: layer.label,
              }))
            );
            setGoals(sublayers);
          } else {
            // Fallback for legacy planner docs without walletVersions
            const rows = data.savingsRows ?? [];
            setGoals(rows.map(r => ({ id: r.id, label: r.label, layerLabel: '' })));
          }
        },
        (error) => {
          console.error('Error loading planner goals:', error);
          setGoals([]);
        }
      );
    } catch (error) {
      console.error('Error setting up planner goals listener:', error);
      setGoals([]);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [ownerId]);

  return goals;
}
