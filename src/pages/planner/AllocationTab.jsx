import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useBudget } from '@/contexts/BudgetContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useCards } from '@/contexts/CardsContext';
import { NumericFormat } from 'react-number-format';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from './usePlannerState';

const RULE_LABELS = {
  needs:   { short: 'N', label: 'Necessidades', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  wants:   { short: 'D', label: 'Desejos',      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  savings: { short: 'P', label: 'Poupança',     color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
};

function InnerTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
      {tabs.map(t => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            active === t.value
              ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function AllocationTab({
  state,
  liquidezFinal,
  necessidadesValue,
  poupancaValue,
  desejosValue,
  monthAllocation,
  updateMonthAllocation,
  resetMonthAllocation,
  selectedMonth,
  updateCategoryBudgetPct,
}) {
  const { ownerId } = useAccess();
  const { categories } = useSettings();
  const { calculateCategorySpending, getCategoryRule, setCategoryRule } = useBudget();
  const { getPaymentMonthKey } = useCards();

  const [activeTab, setActiveTab] = useState('regra');
  const [allTx, setAllTx] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
    const unsub = onSnapshot(q, snap => {
      setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [ownerId]);

  const monthTx = useMemo(() => allTx.filter(tx => {
    if (tx.type !== 'expense' || tx.ignored) return false;
    const key = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
    return key === selectedMonth;
  }), [allTx, selectedMonth, getPaymentMonthKey]);

  const categorySpending = useMemo(() => calculateCategorySpending(monthTx), [monthTx, calculateCategorySpending]);

  const allCategories = useMemo(() => {
    const registered = categories?.expense ?? [];
    const spending   = Object.keys(categorySpending);
    const budgeted   = Object.keys(state.categoryBudgetsPct ?? {});
    return [...new Set([...registered, ...spending, ...budgeted])].sort();
  }, [categories?.expense, categorySpending, state.categoryBudgetsPct]);

  const categoryBudgetsPct = state.categoryBudgetsPct ?? {};

  // Total % allocated across all categories
  const totalPct   = allCategories.reduce((sum, c) => sum + (categoryBudgetsPct[c] ?? 0), 0);
  const totalValue = liquidezFinal * totalPct / 100;
  const remaining  = liquidezFinal - totalValue;

  // Allocated R$ per rule bucket (for Regra reference cards)
  const allocatedByRule = useMemo(() => {
    const sums = { needs: 0, wants: 0, savings: 0 };
    allCategories.forEach(cat => {
      const pct   = categoryBudgetsPct[cat] ?? 0;
      const value = liquidezFinal * pct / 100;
      const rule  = getCategoryRule(cat);
      if (rule in sums) sums[rule] += value;
    });
    return sums;
  }, [allCategories, categoryBudgetsPct, liquidezFinal, getCategoryRule]);

  const allocationTotal = monthAllocation.necessidades + monthAllocation.poupanca + monthAllocation.desejos;
  const isValid    = allocationTotal === 100;
  const hasOverride = !!state.allocationOverrides?.[selectedMonth];

  if (liquidezFinal <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">Preencha o Dashboard Financeiro para ver a alocação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InnerTabs
        tabs={[
          { value: 'regra',  label: 'Regra' },
          { value: 'limite', label: 'Limite' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* ── REGRA ──────────────────────────────────────────────────────────── */}
      {activeTab === 'regra' && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isValid
                ? <Badge variant="default">✓ 100%</Badge>
                : <Badge variant="destructive">Soma: {allocationTotal}%</Badge>}
              {hasOverride && (
                <span className="text-xs text-gray-400">Personalizado</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                Total: <span className="font-bold text-violet-600 dark:text-violet-400">{formatBRL.format(liquidezFinal)}</span>
              </span>
              {hasOverride && (
                <button onClick={resetMonthAllocation} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
                  Resetar
                </button>
              )}
            </div>
          </div>

          {/* Unified bucket cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'necessidades', emoji: '🏠', label: 'Necessidades', pct: monthAllocation.necessidades, value: necessidadesValue, allocated: allocatedByRule.needs,   sub: 'Moradia, alimentação, contas', c: 'blue',    onChange: v => updateMonthAllocation('necessidades', v) },
              { key: 'poupanca',     emoji: '💰', label: 'Poupança',     pct: monthAllocation.poupanca,     value: poupancaValue,     allocated: allocatedByRule.savings, sub: 'Reserva + investimentos',    c: 'emerald', onChange: v => updateMonthAllocation('poupanca', v) },
              { key: 'desejos',      emoji: '🎯', label: 'Desejos',      pct: monthAllocation.desejos,      value: desejosValue,      allocated: allocatedByRule.wants,   sub: 'Lazer, viagens, extras',     c: 'orange',  onChange: v => updateMonthAllocation('desejos', v) },
            ].map(({ key, emoji, label, pct, value, allocated, sub, c, onChange }) => {
              const free    = value - allocated;
              const isOver  = allocated > value;
              const fillPct = value > 0 ? Math.min((allocated / value) * 100, 100) : 0;
              return (
                <div key={key} className={`bg-${c}-50 dark:bg-${c}-900/20 rounded-2xl p-4 border border-${c}-100 dark:border-${c}-800 space-y-3`}>
                  {/* Label + % */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold text-${c}-600 dark:text-${c}-400 uppercase tracking-wide`}>{emoji} {label}</span>
                    <span className={`text-xl font-bold tabular-nums text-${c}-700 dark:text-${c}-300`}>{pct}%</span>
                  </div>

                  {/* Slider */}
                  <input
                    type="range" min={0} max={100} step={1} value={pct}
                    onChange={e => onChange(Number(e.target.value))}
                    className={`w-full h-2 rounded-full appearance-none cursor-pointer accent-${c}-500`}
                  />

                  {/* Amount */}
                  <p className={`text-2xl font-bold text-${c}-700 dark:text-${c}-300 tabular-nums`}>
                    {formatBRL.format(value)}
                  </p>
                  <p className={`text-xs text-${c}-400 -mt-2`}>{sub}</p>

                  {/* Progress bar */}
                  <div>
                    <div className={`w-full h-1.5 rounded-full bg-${c}-200 dark:bg-${c}-800`}>
                      <div
                        className={`h-1.5 rounded-full transition-all ${isOver ? 'bg-red-500' : `bg-${c}-500`}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className={`text-${c}-400`}>Definido: {formatBRL.format(allocated)}</span>
                      <span className={`font-semibold ${isOver ? 'text-red-500' : `text-${c}-600 dark:text-${c}-300`}`}>
                        {isOver ? '−' : '+'}{formatBRL.format(Math.abs(free))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LIMITE ─────────────────────────────────────────────────────────── */}
      {activeTab === 'limite' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {totalPct.toFixed(1)}% alocado
                </span>
                <span className="text-xs text-gray-400 ml-2">= {formatBRL.format(totalValue)}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                Math.abs(remaining) < 1
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : remaining < 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              }`}>
                {remaining >= 0 ? `+${(100 - totalPct).toFixed(1)}% livre` : `−${(totalPct - 100).toFixed(1)}% excedido`}
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${totalValue > liquidezFinal ? 'bg-red-500' : 'bg-violet-500'}`}
                style={{ width: `${Math.min(100, totalPct)}%` }}
              />
            </div>
          </div>

          {/* Unified category table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Orçamento por Categoria</h3>
              <p className="text-xs text-gray-400 mt-0.5">% da liquidez ({formatBRL.format(liquidezFinal)}) — classifique cada categoria na regra</p>
            </div>

            {allCategories.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Nenhuma categoria. Adicione nas Configurações ou registre transações.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {allCategories.map(category => {
                  const pct    = categoryBudgetsPct[category] ?? 0;
                  const limit  = liquidezFinal * pct / 100;
                  const spent  = categorySpending[category] ?? 0;
                  const rule   = getCategoryRule(category);
                  const pctUsed = limit > 0 ? (spent / limit) * 100 : 0;

                  const barColor  = pctUsed === 0 ? 'bg-gray-300 dark:bg-gray-600'
                    : pctUsed < 80  ? 'bg-emerald-500'
                    : pctUsed < 100 ? 'bg-amber-500'
                    : 'bg-red-500';
                  const textColor = pctUsed === 0 ? 'text-gray-400'
                    : pctUsed < 80  ? 'text-emerald-600 dark:text-emerald-400'
                    : pctUsed < 100 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500';

                  return (
                    <div key={category} className="px-4 py-3">
                      {/* Row 1: name + rule dropdown */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate min-w-0">{category}</span>
                        <select
                          value={rule ?? ''}
                          onChange={e => setCategoryRule(category, e.target.value)}
                          className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer ${
                            rule ? RULE_LABELS[rule]?.color : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                          } border-transparent`}
                        >
                          <option value="">— Regra —</option>
                          {Object.entries(RULE_LABELS).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Row 2a: % input + computed R$ */}
                      <div className="flex items-center gap-2 mt-1">
                        <NumericFormat
                          value={pct === 0 ? '' : pct}
                          onValueChange={vals => updateCategoryBudgetPct(category, vals.floatValue ?? 0)}
                          decimalSeparator="," suffix=" %" decimalScale={1} allowNegative={false} placeholder="0 %"
                          className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        {pct > 0 && (
                          <span className="text-xs text-gray-400 tabular-nums">
                            = {formatBRL.format(limit)}
                          </span>
                        )}
                      </div>

                      {/* Row 2b: spent + progress bar + % used */}
                      {pct > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                            {formatBRL.format(spent)} gasto
                          </span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${barColor}`}
                              style={{ width: `${Math.min(pctUsed, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums w-8 text-right shrink-0 ${textColor}`}>
                            {pctUsed.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
