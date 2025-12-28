import { useSettings } from '../../contexts/SettingsContext';

export default function TrendChart({ transactions, selectedMonth }) {
  const { formatCurrency, t, language } = useSettings();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Format currency in compact form
  const formatCompact = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toFixed(0);
  };

  // Generate 6 months starting from selected month
  const getMonthsRange = () => {
    const [year, month] = (selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const months = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date(startDate);
      date.setMonth(startDate.getMonth() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString(locale, { month: 'short' });
      const fullLabel = date.toLocaleDateString(locale, { month: 'long' });
      months.push({ key, label, fullLabel, isCurrent: i === 0 });
    }

    return months;
  };

  const monthsRange = getMonthsRange();

  // Group transactions by month
  const monthlyData = transactions.reduce((acc, trans) => {
    if (trans.ignored) return acc;
    const date = new Date(trans.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!acc[monthKey]) {
      acc[monthKey] = { income: 0, expense: 0 };
    }

    if (trans.type === 'income') {
      acc[monthKey].income += trans.amount;
    } else {
      acc[monthKey].expense += trans.amount;
    }

    return acc;
  }, {});

  // Create data for the 6 months range
  const data = monthsRange.map(({ key, label, fullLabel, isCurrent }) => ({
    month: label,
    fullMonth: fullLabel,
    monthKey: key,
    income: monthlyData[key]?.income || 0,
    expense: monthlyData[key]?.expense || 0,
    balance: (monthlyData[key]?.income || 0) - (monthlyData[key]?.expense || 0),
    isCurrent,
  }));

  // Find max value for scaling bars
  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);

  const hasData = data.some(d => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p className="font-medium">{t('charts.noData')}</p>
        <p className="text-sm mt-1">{t('charts.addTransactionsToSee')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex justify-end gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-gray-500 dark:text-gray-400">{t('balance.income')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
          <span className="text-gray-500 dark:text-gray-400">{t('balance.expenses')}</span>
        </div>
      </div>

      {/* Month cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {data.map((item, index) => (
          <div
            key={item.monthKey}
            className={`relative p-3 rounded-xl border transition-all ${
              item.isCurrent
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
            }`}
          >
            {/* Month label */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-semibold capitalize ${
                item.isCurrent ? 'text-rose-600 dark:text-rose-400' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {item.month}
              </span>
              {item.isCurrent && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>

            {/* Visual bars */}
            <div className="space-y-2 mb-3">
              {/* Income bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(item.income / maxValue) * 100}%` }}
                  />
                </div>
              </div>
              {/* Expense bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${(item.expense / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Values */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  +{formatCompact(item.income)}
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  -{formatCompact(item.expense)}
                </span>
              </div>
              {/* Balance */}
              <div className={`text-center font-semibold pt-1 border-t border-gray-200 dark:border-gray-600 ${
                item.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {item.balance >= 0 ? '+' : ''}{formatCompact(item.balance)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
