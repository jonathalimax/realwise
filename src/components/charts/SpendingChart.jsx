import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useSettings } from '../../contexts/SettingsContext';

// Modern gradient-inspired color palette
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
  'Clothing': '👕', 'Vestuário': '👕',
  'Bills': '📄', 'Contas': '📄',
  'Education': '📚', 'Educação': '📚',
  'Travel': '✈️', 'Viagens': '✈️',
  'Subscriptions': '📺', 'Assinaturas': '📺',
  'Taxes': '🏛️', 'Impostos': '🏛️',
  'Other': '📦', 'Diversos': '📦',
};

export default function SpendingChart({ transactions, onCategoryClick }) {
  const { formatCurrency, t } = useSettings();

  // Group expenses by category
  const categoryTotals = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const data = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <p className="font-medium text-gray-500 dark:text-gray-400">{t('charts.noExpenses')}</p>
        <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">{t('charts.addExpenseToSee')}</p>
      </div>
    );
  }

  const getIcon = (categoryName) => {
    return CATEGORY_ICONS[categoryName] || '💰';
  };

  return (
    <div className="space-y-6">
      {/* Donut Chart with Center Stats */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <defs>
              {COLORS.map((color, index) => (
                <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={color.light} />
                  <stop offset="100%" stopColor={color.main} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#gradient-${index % COLORS.length})`}
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer drop-shadow-sm"
                  onClick={() => onCategoryClick?.(entry.name)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Stats */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-3">
        {data.slice(0, 5).map((item, index) => {
          const percentage = ((item.value / total) * 100);
          const color = COLORS[index % COLORS.length];

          return (
            <button
              key={item.name}
              onClick={() => onCategoryClick?.(item.name)}
              className="w-full group"
            >
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
                    border: `1px solid ${color.main}30`
                  }}
                >
                  {getIcon(item.name)}
                </div>

                {/* Category Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {item.name}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm ml-2">
                      {formatCurrency(item.value)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          background: `linear-gradient(90deg, ${color.light}, ${color.main})`
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {/* Show more indicator */}
        {data.length > 5 && (
          <div className="text-center pt-2">
            <span className="text-sm text-gray-400 dark:text-gray-500">
              +{data.length - 5} {t('common.more') || 'more categories'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
