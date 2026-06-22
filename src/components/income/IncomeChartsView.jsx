import SpendingChart from '@/components/charts/SpendingChart';

export default function IncomeChartsView({ transactions, language, onCategoryClick }) {
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} type="income" />
      </div>
    </div>
  );
}
