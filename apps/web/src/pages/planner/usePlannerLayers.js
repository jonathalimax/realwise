// src/pages/planner/usePlannerLayers.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';

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
    const unsubscribe = onSnapshot(doc(db, 'planner', ownerId), (snap) => {
      if (!snap.exists()) { setLayers([]); return; }
      const walletVersions = snap.data().walletVersions ?? [];
      if (!walletVersions.length) { setLayers([]); return; }

      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const sorted = [...walletVersions].sort((a, b) => a.from.localeCompare(b.from));
      let active = null;
      for (const v of sorted) {
        if (v.from <= currentMonth) active = v;
      }
      setLayers((active ?? sorted[sorted.length - 1]).layers ?? []);
    });
    return unsubscribe;
  }, [ownerId]);

  return layers;
}
