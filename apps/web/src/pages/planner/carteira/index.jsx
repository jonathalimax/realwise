// src/pages/planner/carteira/index.jsx
import { useState, useEffect } from 'react';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '@/contexts/InvestmentContext';
import useTransactions from '@/hooks/useTransactions';
import { getActiveVersion, updateWalletForMonth } from './walletVersion';
import LayerAllocationEditor from './LayerAllocationEditor';
import WalletLayerSection from './WalletLayerSection';

export default function CarteiraTab({ state, update, poupancaValue, selectedMonth }) {
  const { ownerId } = useAccess();
  const { transactions } = useTransactions({}, { enabled: Boolean(ownerId) });
  const { investments, getCurrentValue, loading: invLoading } = useInvestments();
  const [taggedTransactions, setTaggedTransactions] = useState({});

  // Fetch transactions tagged to planner goals
  useEffect(() => {
    const byGoal = {};
    transactions.forEach((tx) => {
      if (tx.plannerGoalId && !tx.investmentId) {
        if (!byGoal[tx.plannerGoalId]) byGoal[tx.plannerGoalId] = [];
        byGoal[tx.plannerGoalId].push(tx);
      }
    });
    setTaggedTransactions(byGoal);
  }, [transactions]);

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

  return (
    <div className="space-y-6">
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
