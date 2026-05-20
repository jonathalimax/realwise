import { useMemo } from 'react';
import SpendingChart from '@/components/charts/SpendingChart';

/**
 * ExpensesChartsView
 *
 * A lightweight wrapper that renders the SpendingChart for a filtered set of
 * expense transactions. It is used by Expenses.jsx when the user switches to
 * the "Charts" segment so that the chart logic lives in one place rather than
 * being duplicated across pages.
 *
 * Props:
 *   transactions — array of expense transaction objects already filtered for
 *                  the selected month / filters
 *   selectedMonth — "YYYY-MM" string (forwarded to charts that need it)
 *   formatCurrency — locale-aware formatter function (amount: number) => string
 *   language — "pt" | "en" from SettingsContext
 */
export default function ExpensesChartsView({ transactions, formatCurrency, language, onCategoryClick }) {
  const totalExpenses = useMemo(
    () => transactions.filter(t => !t.ignored).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <span className="text-4xl mb-3">📊</span>
        <p className="text-sm font-medium">
          {language === 'pt' ? 'Sem gastos para exibir no gráfico.' : 'No expenses to display in the chart.'}
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
          {formatCurrency(totalExpenses)}
        </p>
      </div>

      {/* Spending breakdown chart */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} />
      </div>
    </div>
  );
}
