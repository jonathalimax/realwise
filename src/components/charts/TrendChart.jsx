import { useSettings } from '../../contexts/SettingsContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label, formatCurrency, t }) => {
  if (active && payload && payload.length) {
    const income = payload.find(p => p.dataKey === 'income')?.value || 0;
    const expense = payload.find(p => p.dataKey === 'expense')?.value || 0;
    const balance = income - expense;

    return (
      <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 text-sm">
        <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
        <p className="text-emerald-500">{`${t('balance.income')}: ${formatCurrency(income)}`}</p>
        <p className="text-rose-500">{`${t('balance.expenses')}: ${formatCurrency(expense)}`}</p>
        <p className={`mt-1 font-medium ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {`${t('balance.totalBalance')}: ${formatCurrency(balance)}`}
        </p>
      </div>
    );
  }
  return null;
};

export default function TrendChart({ transactions, selectedMonth }) {
  const { formatCurrency, t, language } = useSettings();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

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
      months.push({ key, label });
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
  const chartData = monthsRange.map(({ key, label }) => ({
    name: label,
    income: monthlyData[key]?.income || 0,
    expense: monthlyData[key]?.expense || 0,
    balance: (monthlyData[key]?.income || 0) - (monthlyData[key]?.expense || 0),
  }));

  const hasData = chartData.some(d => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p className="font-medium">{t('charts.noData')}</p>
        <p className="text-sm mt-1">{t('charts.addTransactionsToSee')}</p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={chartData}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <XAxis dataKey="name" stroke="#6b7280" />
                              <YAxis
                                stroke="#6b7280"
                                tickFormatter={(value) => formatCurrency(value, { compact: true })}
                                domain={['auto', 'auto']}
                              />
                              <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} t={t} />} cursor={{ fill: 'rgba(0,0,0,0.1)' }} />
                              <Legend />
                              <Bar dataKey="income" name={t('balance.income')} fill="#10B981" animationDuration={800} />
                              <Bar dataKey="expense" name={t('balance.expenses')} fill="#EF4444" animationDuration={800} />
                              <Line type="monotone" dataKey="balance" name={t('balance.totalBalance')} stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} animationDuration={800} />
                            </BarChart>      </ResponsiveContainer>
    </div>
  );
}
