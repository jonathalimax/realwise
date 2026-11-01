import SpendingChart from '@/components/charts/SpendingChart';

export default function ExpensesChartsView({ transactions, language, onCategoryClick }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--rw-subtle)]">
        <span className="text-4xl mb-3">📊</span>
        <p className="text-sm font-medium">
          {language === 'pt' ? 'Sem gastos para exibir no gráfico.' : 'No expenses to display in the chart.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} />
      </div>
    </div>
  );
}
