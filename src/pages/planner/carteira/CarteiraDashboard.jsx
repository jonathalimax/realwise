// src/pages/planner/carteira/CarteiraDashboard.jsx
import { Shimmer } from '@/components/ui/shimmer';
import { formatBRL, PRIORITY_ORDER, resolveLayerColors } from './constants';
import { getActiveVersion, getSubBalance } from './walletVersion';

export default function CarteiraDashboard({
  walletVersions,
  selectedMonth,
  poupancaValue,
  investments,
  getCurrentValue,
  invLoading,
  taggedTransactions,
}) {
  const activeVersion = getActiveVersion(walletVersions, selectedMonth);
  const layers = activeVersion?.layers ?? [];
  const allSublayers = layers.flatMap(l => l.sublayers ?? []);

  // Total patrimony: live investments + manual balances for unlinked sublayers
  const totalInvested = investments
    .filter(inv => inv.status !== 'closed')
    .reduce((s, inv) => s + getCurrentValue(inv), 0);
  const totalManualOnly = allSublayers
    .filter(sub => {
      const hasInv = investments.some(inv => inv.plannerGoalId === sub.id && inv.status !== 'closed');
      const hasTx = (taggedTransactions[sub.id] ?? []).length > 0;
      return !hasInv && !hasTx && (sub.manualBalance ?? 0) > 0;
    })
    .reduce((s, sub) => s + sub.manualBalance, 0);
  const totalPatrimonio = totalInvested + totalManualOnly;

  // Emergency fund
  const emergSub = allSublayers.find(s => s.id === 'emergencia');
  const emergBalance = emergSub ? getSubBalance(emergSub, investments, getCurrentValue, taggedTransactions) : 0;
  const emergTarget = emergSub?.goalTarget ?? 120000;
  const monthlyExpenses = emergTarget / 6;
  const mesesCobertos = monthlyExpenses > 0 ? Math.floor(emergBalance / monthlyExpenses) : 0;
  const emergPct = emergTarget > 0 ? Math.min(100, (emergBalance / emergTarget) * 100) : 0;
  const emergColor = emergPct >= 100 ? '#10b981' : emergPct >= 50 ? '#f59e0b' : '#ef4444';

  // Priority focus — first incomplete goal by PRIORITY_ORDER
  const subBalances = {};
  allSublayers.forEach(sub => {
    subBalances[sub.id] = getSubBalance(sub, investments, getCurrentValue, taggedTransactions);
  });
  const sorted = [...allSublayers].sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a.id);
    const ib = PRIORITY_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const focusSub = sorted.find(s => (s.goalTarget ?? 0) > 0 && subBalances[s.id] < s.goalTarget) ?? null;
  const focusBalance = focusSub ? subBalances[focusSub.id] : 0;
  const focusPct = focusSub ? Math.min(100, (focusBalance / focusSub.goalTarget) * 100) : 0;

  // Find which layer the focus sub belongs to
  const focusLayer = focusSub ? layers.find(l => l.sublayers.some(s => s.id === focusSub.id)) : null;
  const focusColors = focusLayer ? resolveLayerColors(focusLayer.id, focusLayer.colorKey, 0) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Patrimônio total */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-4 col-span-2 sm:col-span-1">
        <p className="text-xs text-gray-400 mb-1">Patrimônio total</p>
        {invLoading ? (
          <Shimmer className="h-7 w-3/4 rounded-lg" />
        ) : (
          <p className="text-xl font-bold text-white tabular-nums">{formatBRL.format(totalPatrimonio)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">investimentos + reservas</p>
      </div>

      {/* Disponível p/ investir */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disponível p/ investir</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{formatBRL.format(poupancaValue)}</p>
        <p className="text-xs text-gray-400 mt-1">alocação poupança</p>
      </div>

      {/* Fundo emergência */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fundo emergência</p>
        {invLoading ? (
          <Shimmer className="h-6 w-2/3 rounded" />
        ) : (
          <div className="flex items-end gap-1">
            <p className="text-lg font-bold tabular-nums" style={{ color: emergColor }}>{mesesCobertos}</p>
            <p className="text-xs text-gray-400 mb-0.5">/ 6 meses</p>
          </div>
        )}
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${emergPct}%`, backgroundColor: emergColor }} />
        </div>
      </div>

      {/* Foco atual */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Foco atual</p>
          {focusSub && focusColors && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${focusColors.badge}`}>
              {focusSub.icon}
            </span>
          )}
        </div>
        {invLoading ? (
          <Shimmer className="h-6 w-2/3 rounded" />
        ) : focusSub ? (
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">{focusSub.label}</p>
        ) : allSublayers.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma meta configurada</p>
        ) : (
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Todas as metas atingidas 🎉</p>
        )}
        {focusSub && !invLoading && (
          <>
            <p className="text-xs text-gray-400 mt-0.5 tabular-nums truncate">
              {formatBRL.format(focusBalance)} / {formatBRL.format(focusSub.goalTarget)}
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1.5">
              <div className={`h-1.5 rounded-full transition-all ${focusColors?.bar ?? 'bg-gray-400'}`} style={{ width: `${focusPct}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
