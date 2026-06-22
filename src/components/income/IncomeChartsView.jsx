import { useMemo } from 'react';
import SpendingChart from '@/components/charts/SpendingChart';

/**
 * IncomeChartsView
 *
 * Renders a chart breakdown for income transactions. Used by Income.jsx when
 * the user switches to the "Charts" segment. Mirrors the structure of
 * ExpensesChartsView so both pages behave consistently.
 *
 * Props:
 *   transactions — array of income transaction objects already filtered for
 *                  the selected month / filters
 *   formatCurrency — locale-aware formatter function (amount: number) => string
 *   language — "pt" | "en" from SettingsContext
 */
export default function IncomeChartsView({ transactions, formatCurrency, language, onCategoryClick }) {
  const totalIncome = useMemo(
    () => transactions.filter(t => !t.ignored).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <span className="text-4xl mb-3">📊</span>
        <p className="text-sm font-medium">
          {language === 'pt' ? 'Sem entradas para exibir no gráfico.' : 'No income to display in the chart.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          {language === 'pt' ? 'Total no período' : 'Period total'}
        </p>
        <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
          {formatCurrency(totalIncome)}
        </p>
      </div>

      {/* Income breakdown chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} type="income" />
      </div>
    </div>
  );
}
