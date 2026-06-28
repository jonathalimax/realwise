// src/pages/planner/usePlannerLayers.js
import { useState, useEffect } from 'react';
import { useAccess } from '@/contexts/AccessContext';
import { plannerResource } from '@/lib/api/resources/planner';

/**
 * Returns the layers array from the active wallet version for the current month.
 * Each layer: { id, label, icon, colorKey, sublayers[] }
 * sublayer: { id, label, type, ... }
 */
export default function usePlannerLayers() {
  const { ownerId } = useAccess();
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    plannerResource.get()
      .then((response) => {
      const data = response?.state || response || {};
      const walletVersions = data.walletVersions ?? [];
      if (!walletVersions.length) { setLayers([]); return; }

      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const sorted = [...walletVersions].sort((a, b) => a.from.localeCompare(b.from));
      let active = null;
      for (const v of sorted) {
        if (v.from <= currentMonth) active = v;
      }
      setLayers((active ?? sorted[sorted.length - 1]).layers ?? []);
      })
      .catch((error) => {
        console.error('[usePlannerLayers] Error loading planner:', error);
        setLayers([]);
      });
  }, [ownerId]);

  return layers;
}
