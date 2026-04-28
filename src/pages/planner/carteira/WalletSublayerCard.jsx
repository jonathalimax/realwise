// src/pages/planner/carteira/WalletSublayerCard.jsx
import { Shimmer } from '@/components/ui/shimmer';
import { formatBRL, resolveLayerColors, INSTRUMENT_TYPE_COLORS } from './constants';
import { sublayerMonthlyAmount, netReturn, getSubBalance } from './walletVersion';
import { useState } from 'react';

export default function WalletSublayerCard({
  sublayer,
  layerMonthlyAmount,
  layerId,
  layerColorKey,
  layerIndex,
  investments,
  getCurrentValue,
  invLoading,
  taggedTransactions,
  readOnly,
  onEdit,
}) {
  const [showInstruments, setShowInstruments] = useState(false);
  const colors = resolveLayerColors(layerId, layerColorKey, layerIndex);

  const monthlyContrib = sublayerMonthlyAmount(sublayer, layerMonthlyAmount);
  const net = netReturn(sublayer.returnPct ?? 1.0, sublayer.taxRate ?? 15);
  const currentBalance = getSubBalance(sublayer, investments, getCurrentValue, taggedTransactions);
  const goalTarget = sublayer.goalTarget ?? 0;
  const isOngoing = goalTarget === 0;
  const progressPct = !isOngoing && goalTarget > 0 ? Math.min(100, (currentBalance / goalTarget) * 100) : 0;
  const remaining = Math.max(0, goalTarget - currentBalance);
  const goalReached = !isOngoing && currentBalance >= goalTarget && goalTarget > 0;

  const taggedInvs = investments.filter(inv => inv.plannerGoalId === sublayer.id && inv.status !== 'closed');
  const taggedTxs = taggedTransactions[sublayer.id] ?? [];
  const hasAutoData = (taggedInvs.length + taggedTxs.length) > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{sublayer.icon}</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{sublayer.label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${INSTRUMENT_TYPE_COLORS[sublayer.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
            {sublayer.type ?? 'Outro'}
          </span>
          {!readOnly && (
            <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs transition-colors" title="Editar sublayer">✏️</button>
          )}
        </div>
      </div>

      {/* Description */}
      {sublayer.description && (
        <p className="text-xs text-gray-400">{sublayer.description}</p>
      )}

      {/* Instruments toggle */}
      {sublayer.instruments?.length > 0 && (
        <div>
          <button onClick={() => setShowInstruments(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors">
            <span>{showInstruments ? '▾' : '▸'}</span>
            <span>Onde investir</span>
          </button>
          {showInstruments && (
            <div className="mt-1.5 space-y-1">
              {sublayer.instruments.map((inst, i) => {
                const tc = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${tc}`}>{inst.type}</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{inst.name}</span>
                    </div>
                    <span className="text-xs tabular-nums text-gray-400 shrink-0">{inst.alloc}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Linked records */}
      <div className="space-y-1.5">
        {invLoading ? (
          <Shimmer className="h-7 w-full rounded-lg" />
        ) : hasAutoData ? (
          <>
            {taggedInvs.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{inv.name}</span>
                  {inv.bank && <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${colors.chip}`}>{inv.bank}</span>}
                </div>
                <span className="text-xs tabular-nums font-bold text-gray-700 dark:text-gray-300 ml-2 shrink-0">{formatBRL.format(getCurrentValue(inv))}</span>
              </div>
            ))}
            {taggedTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{tx.description}</span>
                <span className="text-xs tabular-nums font-bold text-gray-700 dark:text-gray-300 ml-2 shrink-0">{formatBRL.format(tx.amount)}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {/* Stats + Progress */}
      <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Atual</span>
          <span className="tabular-nums font-bold text-gray-900 dark:text-white">{formatBRL.format(currentBalance)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Retorno bruto</span>
          <span className="tabular-nums">{(sublayer.returnPct ?? 1.0).toFixed(2)}% a.m.</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Líquido (IRPF {sublayer.taxRate ?? 15}%)</span>
          <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{net.toFixed(3)}% a.m.</span>
        </div>
        {!isOngoing && (
          <>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Meta</span>
              <span className="tabular-nums">{formatBRL.format(goalTarget)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${colors.bar}`} style={{ width: `${progressPct}%` }} />
            </div>
            {goalReached ? (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center">Meta atingida! 🎉</p>
            ) : (
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Faltam</span>
                <span className="tabular-nums">{formatBRL.format(remaining)}</span>
              </div>
            )}
          </>
        )}
        {isOngoing && <p className="text-xs text-gray-400 italic">Reserva contínua</p>}
      </div>

      {/* Footer: monthly contribution */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span>Aporte este mês</span>
        <span className="tabular-nums font-bold text-gray-700 dark:text-gray-300">{formatBRL.format(monthlyContrib)}</span>
      </div>
    </div>
  );
}
