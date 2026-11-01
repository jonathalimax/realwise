import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useSettings } from '../../contexts/SettingsContext';
import { useBudget } from '../../contexts/BudgetContext';
import { useMonth } from '../../contexts/MonthContext';
import usePlannerState, { getActivePlannerVersion } from '../../pages/planner/usePlannerState';
import { computeNetSalary } from '../../pages/planner/rendaCalc';

// Modern color palette
const COLORS = [
  { main: '#8B5CF6', light: '#A78BFA' }, // Purple
  { main: '#EC4899', light: '#F472B6' }, // Pink
  { main: '#06B6D4', light: '#22D3EE' }, // Cyan
  { main: '#F59E0B', light: '#FBBF24' }, // Amber
  { main: '#10B981', light: '#34D399' }, // Emerald
  { main: '#EF4444', light: '#F87171' }, // Red
  { main: '#3B82F6', light: '#60A5FA' }, // Blue
  { main: '#84CC16', light: '#A3E635' }, // Lime
];

const CATEGORY_ICONS = {
  'Housing': '🏠', 'Moradia': '🏠',
  'Food': '🍔', 'Alimentação': '🍔',
  'Transport': '🚗', 'Transporte': '🚗',
  'Vehicle': '🚗', 'Veículo': '🚗',
  'Entertainment': '🎮', 'Lazer': '🎮',
  'Leisure': '🎮',
  'Healthcare': '💊', 'Saúde': '💊',
  'Shopping': '🛍️', 'Compras': '🛍️',
  'Mercado': '🛒', 'Groceries': '🛒',
  'Esporte': '⚽', 'Sports': '⚽',
  'Beleza': '💅', 'Beauty': '💅',
  'Clothing': '👕', 'Vestuário': '👕',
  'Bills': '📄', 'Contas': '📄',
  'Education': '📚', 'Educação': '📚',
  'Travel': '✈️', 'Viagens': '✈️',
  'Subscriptions': '📺', 'Assinaturas': '📺',
  'Taxes': '🏛️', 'Impostos': '🏛️',
  'Church': '⛪', 'Igreja': '⛪',
  'Other': '📦', 'Diversos': '📦',
};

export default function SpendingChart({ transactions, onCategoryClick, selectedMonth, type = 'expense' }) {
  const { formatCurrency, t, categories, language } = useSettings();
  const { getTemplateBudget } = useBudget();
  const { state: plannerStateData } = usePlannerState();
  const { selectedMonth: contextMonth } = useMonth();
  const month = selectedMonth || contextMonth;
  const navigate = useNavigate();
  const [activeLabel, setActiveLabel] = useState(null); // slice tapped on the donut

  const goToCategory = (category) => {
    if (onCategoryClick) {
      onCategoryClick(category);
      return;
    }
    sessionStorage.setItem('expenses_categoryFilter', category);
    navigate('/expenses');
  };

  const templateBudget = getTemplateBudget();
  const categoryBudgets = useMemo(
    () => templateBudget?.categoryBudgets ?? {},
    [templateBudget]
  );
  const plannerVersion = useMemo(
    () => getActivePlannerVersion(plannerStateData?.plannerVersions, month),
    [plannerStateData?.plannerVersions, month]
  );
  const liquidezFinal = useMemo(
    () => computeNetSalary(plannerVersion?.salarioBruto, plannerVersion?.salarioDeductions),
    [plannerVersion]
  );
  const categoryPct = useMemo(
    () => plannerVersion?.categoryBudgetsPct ?? {},
    [plannerVersion]
  );

  const resolveLimit = (category) => {
    const pctValue = categoryPct[category] ?? 0;
    const pctLimit = pctValue > 0 ? liquidezFinal * (pctValue / 100) : 0;
    const templateLimit = categoryBudgets[category] ?? 0;
    return pctLimit > 0 ? pctLimit : templateLimit;
  };

  // Group expenses by category (excluding ignored transactions)
  const categoryTotals = transactions
    .filter(t => t.type === type && !t.ignored)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  // All categories: union of enabled list + any from actual spending
  const allCats = Array.from(new Set([
    ...(categories?.[type] ?? []),
    ...Object.keys(categoryTotals),
  ]));

  // Full legend data — all categories, sorted: spending desc → unspent with limit → unspent no limit
  const legendData = allCats
    .map((name, index) => {
      const value = categoryTotals[name] ?? 0;
      const limit = resolveLimit(name);
      return {
        id: index,
        value,
        label: name,
        color: COLORS[index % COLORS.length].main,
        limit,
        hasSpending: value > 0,
        hasLimit: limit > 0,
      };
    })
    .sort((a, b) => {
      if (a.hasSpending !== b.hasSpending) return b.hasSpending ? 1 : -1;
      if (a.value !== b.value) return b.value - a.value;
      if (a.hasLimit !== b.hasLimit) return b.hasLimit ? 1 : -1;
      return a.label.localeCompare(b.label);
    });

  // Pie chart only gets categories with actual spending (zero slices cause MUI artifacts)
  const pieData = legendData.filter(d => d.value > 0);

  if (pieData.length === 0 && legendData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <div className="w-16 h-16 rounded-full bg-[var(--rw-raised)] flex items-center justify-center mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <p className="font-medium text-[var(--rw-muted)]">
          {type === 'income'
            ? (language === 'pt' ? 'Sem entradas para exibir.' : 'No income to display.')
            : t('charts.noExpenses')}
        </p>
        <p className="text-sm mt-1 text-[var(--rw-subtle)]">
          {type === 'income'
            ? (language === 'pt' ? 'Adicione uma entrada para ver o gráfico.' : 'Add income to see the chart.')
            : t('charts.addExpenseToSee')}
        </p>
      </div>
    );
  }

  const getIcon = (categoryName) => {
    return CATEGORY_ICONS[categoryName] || '💰';
  };

  const activeSlice = pieData.find((d) => d.label === activeLabel) ?? null;

  return (
    <div className="space-y-6">
      {/* Donut: tap a slice to read it in the centre; the list below opens the category */}
      <div className="relative mx-auto h-[250px] w-full max-w-[320px]" style={{ touchAction: 'pan-y' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="92%"
              paddingAngle={pieData.length > 1 ? 3 : 0}
              cornerRadius={6}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={700}
              onClick={(entry) => setActiveLabel((prev) => (prev === entry?.label ? null : entry?.label ?? null))}
            >
              {pieData.map((d) => (
                <Cell key={d.label} fill={d.color} fillOpacity={!activeSlice || activeSlice.label === d.label ? 1 : 0.35} style={{ cursor: 'pointer', outline: 'none' }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          {activeSlice ? (
            <>
              <p className="max-w-full truncate text-xs font-semibold text-[var(--rw-muted)]">{activeSlice.label}</p>
              <p className="text-lg font-bold tabular-nums text-[var(--rw-ink)] sm:text-2xl">{formatCurrency(activeSlice.value)}</p>
              <p className="text-xs font-semibold tabular-nums" style={{ color: activeSlice.color }}>
                {total > 0 ? `${((activeSlice.value / total) * 100).toFixed(0)}%` : ''}
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{language === 'pt' ? 'Total' : 'Total'}</p>
              <p className="text-lg font-bold tabular-nums text-[var(--rw-ink)] sm:text-2xl">{formatCurrency(total)}</p>
            </>
          )}
        </div>
      </div>

      {/* Category Breakdown - 2-column grid below chart */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {legendData.map((item) => {
          const isDimmed = !item.hasSpending && !item.hasLimit;
          const color = COLORS[legendData.indexOf(item) % COLORS.length];

          if (type === 'income') {
            // Income: icon + name + value + % of total. No budget bars.
            return (
              <button
                key={item.label}
                onClick={() => goToCategory(item.label)}
                className={`w-full group text-left ${isDimmed ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/70 transition-all duration-200">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
                      border: `1px solid ${color.main}30`,
                    }}
                  >
                    {getIcon(item.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--rw-ink)] text-sm truncate">
                        {item.label}
                      </span>
                      <span className="font-bold text-[var(--rw-ink)] text-sm tabular-nums ml-2 shrink-0">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                    {item.hasSpending && total > 0 && (
                      <p className="text-[10px] text-[var(--rw-subtle)] mt-0.5">
                        {((item.value / total) * 100).toFixed(0)}% {language === 'pt' ? 'do total' : 'of total'}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          }

          // Expense: full budget/limit rendering (unchanged)
          const hasLimit = item.hasLimit;
          const hasSpending = item.hasSpending;
          const pct = hasLimit
            ? (item.value / item.limit) * 100
            : (total > 0 ? (item.value / total) * 100 : 0);
          const isOver = hasLimit && pct > 100;
          const barWidth = Math.min(pct, 100);
          const remaining = item.limit - item.value;

          return (
            <button
              key={item.label}
              onClick={() => goToCategory(item.label)}
              className={`w-full group text-left ${isDimmed ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/70 transition-all duration-200">
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
                    border: `1px solid ${color.main}30`,
                  }}
                >
                  {getIcon(item.label)}
                </div>

                {/* Category Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--rw-ink)] text-sm truncate">
                      {item.label}
                    </span>
                    <span className="font-bold text-[var(--rw-ink)] text-sm tabular-nums ml-2 shrink-0">
                      {formatCurrency(item.value)}
                    </span>
                  </div>

                  {(hasSpending || hasLimit) && (
                    <>
                      <div className="h-1.5 bg-[var(--rw-track)]/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: isOver ? '#EF4444' : color.main,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        {hasLimit ? (
                          <span className="text-[10px] text-[var(--rw-subtle)] tabular-nums">
                            {pct.toFixed(0)}% de {formatCurrency(item.limit)}
                          </span>
                        ) : <span />}
                        {hasLimit && hasSpending && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                            isOver
                              ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                          }`}>
                            {isOver
                              ? `↑ ${formatCurrency(Math.abs(remaining))} acima`
                              : `↓ ${formatCurrency(remaining)} livres`}
                          </span>
                        )}
                        {hasLimit && !hasSpending && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
                            {formatCurrency(item.limit)} disponíveis
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
