import { useState, useEffect } from 'react';
import { useAccess } from '@/contexts/AccessContext';
import { getActiveVersionOrLatest } from './carteira/walletVersion';
import { plannerResource } from '@/lib/api/resources/planner';

/**
 * Lightweight hook that reads wallet sublayers from the planner record.
 * Prefers walletVersions sublayers (covers all layers including crescimento and
 * custom sublayers). Falls back to savingsRows for legacy planner docs.
 * Returns an array of { id, label, layerLabel } for use in form dropdowns.
 */
export default function usePlannerGoals() {
  const { ownerId } = useAccess();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (!ownerId) return;

    plannerResource.get()
      .then((response) => {
        const data = response?.state || response || {};
        const walletVersions = data.walletVersions ?? [];

        if (walletVersions.length > 0) {
          const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const activeVersion = getActiveVersionOrLatest(walletVersions, currentMonth);

          if (activeVersion) {
            const sublayers = (activeVersion.layers ?? []).flatMap(layer =>
              (layer.sublayers ?? []).map(sub => ({
                id: sub.id,
                label: sub.label,
                layerLabel: layer.label,
              }))
            );
            setGoals(sublayers);
          } else {
            setGoals([]);
          }
        } else {
          const rows = data.savingsRows ?? [];
          setGoals(rows.map(r => ({ id: r.id, label: r.label, layerLabel: '' })));
        }
      })
      .catch((error) => {
        console.error('[usePlannerGoals] Error loading planner:', error);
        setGoals([]);
      });
  }, [ownerId]);

  return goals;
}
