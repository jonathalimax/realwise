import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useBudget } from '@/contexts/BudgetContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useCards } from '@/contexts/CardsContext';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { formatBRL } from './usePlannerState';
import SpendingChart from '@/components/charts/SpendingChart';
import CategoryTrendChart from './CategoryTrendChart';

const RULE_LABELS = {
  needs:   { label: '🏠 Necessidades', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  wants:   { label: '🎯 Desejos',       color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  savings: { label: '💰 Poupança',      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
};

function BudgetProgressBar({ pct, colorClass }) {
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function GastosTab({
  selectedMonth,
  liquidezFinal,
  necessidadesValue,
  desejosValue,
  poupancaValue,
}) {
  const { ownerId } = useAccess();
  const { categories } = useSettings();
  const { getPaymentMonthKey } = useCards();
  const {
    getTemplateBudget,
    setTemplateCategoryBudget,
    calculateCategorySpending,
    getBudgetStatus,
    getStatusColor,
    getCategoryRule,
    setCategoryRule,
  } = useBudget();

  const [activeTab, setActiveTab] = useState('tracking');
  const [allTx, setAllTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
    const unsub = onSnapshot(q, snap => {
      setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [ownerId]);

  const monthTx = useMemo(() => allTx.filter(tx => {
    if (tx.type !== 'expense' || tx.ignored) return false;
    const key = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
    return key === selectedMonth;
  }), [allTx, selectedMonth, getPaymentMonthKey]);

  const last6Months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(`${selectedMonth}-01`);
      d.setMonth(d.getMonth() - (5 - i));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }, [selectedMonth]);

  const templateBudget = getTemplateBudget();
  const categorySpending = useMemo(() => calculateCategorySpending(monthTx), [monthTx, calculateCategorySpending]);

  const allocatedByRule = useMemo(() => {
    const limits = templateBudget?.categoryBudgets ?? {};
    const sums = { needs: 0, wants: 0, savings: 0 };
    Object.entries(limits).forEach(([cat, amount]) => {
      const rule = getCategoryRule(cat);
      if (rule in sums) sums[rule] += amount ?? 0;
    });
    return sums;
  }, [templateBudget, getCategoryRule]);

  const allCategories = useMemo(() => {
    const registeredCats = categories?.expense ?? [];
    const templateCats = templateBudget ? Object.keys(templateBudget.categoryBudgets || {}) : [];
    const spendingCats = Object.keys(categorySpending);
    return [...new Set([...registeredCats, ...spendingCats, ...templateCats])].sort();
  }, [categories?.expense, categorySpending, templateBudget]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Inner tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {[
          { value: 'tracking', label: 'Rastreamento' },
          { value: 'limits',   label: 'Limites & Alocação' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === tab.value
                ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Rastreamento ─────────────────────────────────────────────── */}
      {activeTab === 'tracking' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <SpendingChart transactions={monthTx} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Tendência — últimos 6 meses por categoria
            </h3>
            <CategoryTrendChart allTx={allTx} last6Months={last6Months} getMonthKey={getPaymentMonthKey} />
          </div>
        </div>
      )}

      {/* ── Tab: Limites & Alocação ───────────────────────────────────────── */}
      {activeTab === 'limits' && (
        <div className="space-y-4">
          {/* Allocation reference with limits breakdown */}
          {liquidezFinal > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Referência de alocação — {selectedMonth}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Necessidades', emoji: '🏠', target: necessidadesValue, allocated: allocatedByRule.needs,
                    theme: { card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800', title: 'text-blue-500', amount: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-200 dark:bg-blue-800', fill: 'bg-blue-500', sub: 'text-blue-400', free: 'text-blue-600 dark:text-blue-300' } },
                  { label: 'Desejos',       emoji: '🎯', target: desejosValue,      allocated: allocatedByRule.wants,
                    theme: { card: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', title: 'text-orange-500', amount: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-200 dark:bg-orange-800', fill: 'bg-orange-500', sub: 'text-orange-400', free: 'text-orange-600 dark:text-orange-300' } },
                  { label: 'Poupança',      emoji: '💰', target: poupancaValue,     allocated: allocatedByRule.savings,
                    theme: { card: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', title: 'text-emerald-500', amount: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-200 dark:bg-emerald-800', fill: 'bg-emerald-500', sub: 'text-emerald-400', free: 'text-emerald-600 dark:text-emerald-300' } },
                ].map(({ label, emoji, target, allocated, theme }) => {
                  const free = target - allocated;
                  const isOver = allocated > target;
                  const allocPct = target > 0 ? Math.min((allocated / target) * 100, 100) : 0;
                  return (
                    <div key={label} className={`rounded-xl p-3 border ${theme.card}`}>
                      <p className={`text-xs font-semibold mb-0.5 ${theme.title}`}>{emoji} {label}</p>
                      <p className={`text-base font-bold tabular-nums ${theme.amount}`}>{formatBRL.format(target)}</p>

                      <div className={`w-full h-1 rounded-full mt-2 mb-1.5 ${theme.bar}`}>
                        <div
                          className={`h-1 rounded-full transition-all ${isOver ? 'bg-rose-500' : theme.fill}`}
                          style={{ width: `${allocPct}%` }}
                        />
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className={theme.sub}>Definido</span>
                          <span className={`tabular-nums font-medium ${isOver ? 'text-rose-500' : theme.sub}`}>
                            {formatBRL.format(allocated)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={theme.sub}>Livre</span>
                          <span className={`tabular-nums font-semibold ${isOver ? 'text-rose-500' : theme.free}`}>
                            {isOver ? '−' : ''}{formatBRL.format(Math.abs(free))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-category limits + rule assignment */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Limites & Classificação</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Limites recorrentes para todos os meses. Classifique cada categoria para o relatório de alocação.
              </p>
            </div>

            {allCategories.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                Nenhuma categoria registrada. Adicione categorias nas Configurações.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {allCategories.map(category => {
                  const spent = categorySpending[category] ?? 0;
                  const limit = templateBudget?.categoryBudgets?.[category] ?? 0;
                  const rule = getCategoryRule(category);
                  const status = getBudgetStatus(spent, limit);
                  const colors = getStatusColor(status);
                  const pct = limit > 0 ? (spent / limit) * 100 : 0;

                  return (
                    <div key={category} className="px-4 py-3">
                      {/* Category name + rule badge + limit input */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 truncate flex-1">
                          {category}
                        </span>
                        {/* Rule selector */}
                        <div className="flex gap-1">
                          {Object.entries(RULE_LABELS).map(([key, { label, color }]) => (
                            <button
                              key={key}
                              onClick={() => setCategoryRule(category, key)}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                                rule === key
                                  ? color
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Spending / limit row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 w-24 shrink-0">
                          {formatBRL.format(spent)} gasto
                        </span>
                        <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
                        <CurrencyInput
                          value={limit}
                          onChange={v => setTemplateCategoryBudget(category, v)}
                          placeholder="sem limite"
                          className="w-28 px-2 py-1 text-xs text-right"
                        />
                        {limit > 0 && (
                          <>
                            <div className="flex-1">
                              <BudgetProgressBar pct={pct} colorClass={colors.bg} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums w-10 text-right shrink-0 ${colors.text}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </>
                        )}
                      </div>
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
