// src/pages/planner/carteira/index.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '@/contexts/InvestmentContext';
import { getActiveVersion, updateWalletForMonth } from './walletVersion';
import CarteiraDashboard from './CarteiraDashboard';
import LayerAllocationEditor from './LayerAllocationEditor';
import WalletLayerSection from './WalletLayerSection';
import AnalysePanel from './AnalysePanel';

export default function CarteiraTab({ state, update, poupancaValue, selectedMonth }) {
  const { ownerId } = useAccess();
  const { investments, getCurrentValue, loading: invLoading } = useInvestments();
  const [taggedTransactions, setTaggedTransactions] = useState({});

  // Fetch transactions tagged to planner goals
  useEffect(() => {
    if (!ownerId) return;
    const fetchTagged = async () => {
      try {
        const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
        const snap = await getDocs(q);
        const byGoal = {};
        snap.forEach(d => {
          const tx = { id: d.id, ...d.data() };
          if (tx.plannerGoalId) {
            if (!byGoal[tx.plannerGoalId]) byGoal[tx.plannerGoalId] = [];
            byGoal[tx.plannerGoalId].push(tx);
          }
        });
        setTaggedTransactions(byGoal);
      } catch (err) {
        console.error('[CarteiraTab] Error fetching tagged transactions:', err);
      }
    };
    fetchTagged();
  }, [ownerId]);

  const walletVersions = state.walletVersions ?? [];
  const activeVersion = getActiveVersion(walletVersions, selectedMonth);
  const layers = activeVersion?.layers ?? [];

  // Determine if selected month is in the past (read-only)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const readOnly = selectedMonth < currentMonth;

  const applyLayerPatch = (patchFn) => {
    const newVersions = updateWalletForMonth(walletVersions, selectedMonth, patchFn);
    update('walletVersions', newVersions);
  };

  const handleUpdateLayers = (newLayers) => {
    applyLayerPatch(() => newLayers);
  };

  const handleUpdateLayer = (updatedLayer) => {
    applyLayerPatch(layers => layers.map(l => l.id === updatedLayer.id ? updatedLayer : l));
  };

  const handleDeleteLayer = (layerId) => {
    applyLayerPatch(layers => layers.filter(l => l.id !== layerId));
  };

  const handleApplySuggestions = (suggestions) => {
    applyLayerPatch(currentLayers => {
      let updated = [...currentLayers];
      suggestions.forEach(s => {
        if (s.type === 'allocation' && s.patch?.layerId && s.patch?.newPct != null) {
          updated = updated.map(l => l.id === s.patch.layerId ? { ...l, pct: s.patch.newPct } : l);
        }
        if (s.type === 'instrument' && s.patch?.sublayerId && s.patch?.instruments) {
          updated = updated.map(l => ({
            ...l,
            sublayers: (l.sublayers ?? []).map(sub =>
              sub.id === s.patch.sublayerId ? { ...sub, instruments: s.patch.instruments } : sub
            ),
          }));
        }
      });
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <CarteiraDashboard
        walletVersions={walletVersions}
        selectedMonth={selectedMonth}
        poupancaValue={poupancaValue}
        investments={investments}
        getCurrentValue={getCurrentValue}
        invLoading={invLoading}
        taggedTransactions={taggedTransactions}
      />

      <AnalysePanel
        layers={layers}
        poupancaValue={poupancaValue}
        onApplySuggestions={handleApplySuggestions}
        readOnly={readOnly}
      />

      <LayerAllocationEditor
        layers={layers}
        poupancaValue={poupancaValue}
        onUpdateLayers={handleUpdateLayers}
        readOnly={readOnly}
      />

      {layers.map((layer, i) => (
        <WalletLayerSection
          key={layer.id}
          layer={layer}
          layerIndex={i}
          poupancaValue={poupancaValue}
          investments={investments}
          getCurrentValue={getCurrentValue}
          invLoading={invLoading}
          taggedTransactions={taggedTransactions}
          readOnly={readOnly}
          onUpdateLayer={handleUpdateLayer}
          onDeleteLayer={() => handleDeleteLayer(layer.id)}
        />
      ))}
    </div>
  );
}
