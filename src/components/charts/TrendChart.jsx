import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useSettings } from '../../contexts/SettingsContext';

export default function TrendChart({ transactions }) {
  const { formatCurrency, t, language } = useSettings();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Group transactions by month
  const monthlyData = transactions.reduce((acc, trans) => {
    const date = new Date(trans.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString(locale, { month: 'short' });

    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthLabel, income: 0, expense: 0 };
    }

    if (trans.type === 'income') {
      acc[monthKey].income += trans.amount;
    } else {
      acc[monthKey].expense += trans.amount;
    }

    return acc;
  }, {});

  const data = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, values]) => values);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p className="font-medium">{t('charts.noData')}</p>
        <p className="text-sm mt-1">{t('charts.addTransactionsToSee')}</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-gray-100">
          <p className="font-semibold text-gray-900 capitalize mb-2">{label}</p>
          {payload.map((item) => (
            <p key={item.name} className="text-sm" style={{ color: item.color }}>
              {item.name === 'income' ? t('balance.income') : t('balance.expenses')}: {formatCurrency(item.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00A699" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00A699" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF385C" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FF385C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#717171' }}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="income"
            stroke="#00A699"
            strokeWidth={2}
            fill="url(#incomeGradient)"
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="#FF385C"
            strokeWidth={2}
            fill="url(#expenseGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00A699]" />
          <span className="text-sm text-gray-600">{t('balance.income')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF385C]" />
          <span className="text-sm text-gray-600">{t('balance.expenses')}</span>
        </div>
      </div>
    </div>
  );
}
