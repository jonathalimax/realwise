import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { getActiveVersion } from './carteira/walletVersion';

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
            console.warn('[usePlannerGoals] Planner document does not exist for', ownerId);
            setGoals([]);
            return;
          }

          const data = snap.data();
          const walletVersions = data.walletVersions ?? [];

          if (walletVersions.length > 0) {
            // Use the most recent wallet version to get all sublayers
            const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            const activeVersion = getActiveVersion(walletVersions, currentMonth);

            if (activeVersion) {
              const sublayers = (activeVersion.layers ?? []).flatMap(layer =>
                (layer.sublayers ?? []).map(sub => ({
                  id: sub.id,
                  label: sub.label,
                  layerLabel: layer.label,
                }))
              );
              console.log('[usePlannerGoals] Found', sublayers.length, 'sublayers from active version:', sublayers);
              setGoals(sublayers);
            } else {
              console.warn('[usePlannerGoals] No active version found. Versions:', walletVersions.map(v => v.from));
              setGoals([]);
            }
          } else {
            // Fallback for legacy planner docs without walletVersions
            const rows = data.savingsRows ?? [];
            console.log('[usePlannerGoals] Using fallback savingsRows:', rows.length, 'rows');
            setGoals(rows.map(r => ({ id: r.id, label: r.label, layerLabel: '' })));
          }
        },
        (error) => {
          console.error('[usePlannerGoals] Firestore listener error:', error);
          setGoals([]);
        }
      );
    } catch (error) {
      console.error('[usePlannerGoals] Error setting up listener:', error);
      setGoals([]);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [ownerId]);

  return goals;
}
