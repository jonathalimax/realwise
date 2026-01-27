import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useSettings } from '../../contexts/SettingsContext';

// Category icons
const CATEGORY_ICONS = {
  'Housing': '🏠', 'Moradia': '🏠',
  'Food': '🍔', 'Alimentação': '🍔',
  'Transport': '🚗', 'Transporte': '🚗',
  'Vehicle': '🚗', 'Veículo': '🚗',
  'Entertainment': '🎮', 'Lazer': '🎮',
  'Leisure': '🎮',
  'Healthcare': '💊', 'Saúde': '💊',
  'Shopping': '🛍️', 'Compras': '🛍️',
  'Clothing': '👕', 'Vestuário': '👕',
  'Bills': '📄', 'Contas': '📄',
  'Education': '📚', 'Educação': '📚',
  'Travel': '✈️', 'Viagens': '✈️',
  'Subscriptions': '📺', 'Assinaturas': '📺',
  'Taxes': '🏛️', 'Impostos': '🏛️',
  'Church': '⛪', 'Igreja': '⛪',
  'Other': '📦', 'Diversos': '📦',
  'Investments': '📈', 'Investimentos': '📈',
};

// Vibrant color palette for the pie chart
const COLORS = [
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#84CC16', // Lime
  '#F97316', // Orange
  '#14B8A6', // Teal
];

const CustomTooltip = ({ active, payload }) => {
  const { formatCurrency } = useSettings();

  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{data.payload.icon}</span>
          <p className="font-semibold text-gray-900 dark:text-white">{data.name}</p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {formatCurrency(data.value)} <span className="text-xs">({data.payload.percentage}%)</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }) => {
  const { formatCurrency } = useSettings();

  if (!payload || payload.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {payload.map((entry, index) => (
        <div
          key={`legend-${index}`}
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
              {entry.icon} {entry.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(entry.amount)} ({entry.percentage}%)
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function ExpensesPieChart({ transactions }) {
  const { language, formatCurrency, categories } = useSettings();

  const chartData = useMemo(() => {
    const spending = {};

    // Calculate spending by category
    transactions
      .filter(tx => tx.type === 'expense' && !tx.ignored)
      .forEach(tx => {
        spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
      });

    const total = Object.values(spending).reduce((sum, val) => sum + val, 0);

    if (total === 0) return [];

    // Create data for pie chart
    const data = Object.entries(spending)
      .filter(([_, amount]) => amount > 0)
      .map(([category, amount], index) => ({
        name: category,
        value: amount,
        amount: amount,
        percentage: ((amount / total) * 100).toFixed(1),
        icon: CATEGORY_ICONS[category] || '💰',
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    return data;
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'expense' && !tx.ignored)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {language === 'pt' ? 'Gastos por Categoria' : 'Expenses by Category'}
        </h3>
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-sm">
            {language === 'pt' ? 'Nenhum gasto registrado' : 'No expenses recorded'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Gastos por Categoria' : 'Expenses by Category'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {language === 'pt' ? 'Total: ' : 'Total: '}
          <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totalExpenses)}</span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={500}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={180}
            innerRadius={100}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <CustomLegend payload={chartData} />
    </div>
  );
}
