import { PieChart } from '@mui/x-charts/PieChart';
import { useSettings } from '../../contexts/SettingsContext';

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
  'Clothing': '👕', 'Vestuário': '👕',
  'Bills': '📄', 'Contas': '📄',
  'Education': '📚', 'Educação': '📚',
  'Travel': '✈️', 'Viagens': '✈️',
  'Subscriptions': '📺', 'Assinaturas': '📺',
  'Taxes': '🏛️', 'Impostos': '🏛️',
  'Church': '⛪', 'Igreja': '⛪',
  'Other': '📦', 'Diversos': '📦',
};

export default function SpendingChart({ transactions, onCategoryClick }) {
  const { formatCurrency, t } = useSettings();

  // Group expenses by category (excluding ignored transactions)
  const categoryTotals = transactions
    .filter(t => t.type === 'expense' && !t.ignored)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const data = Object.entries(categoryTotals)
    .map(([name, value], index) => ({
      id: index,
      value,
      label: name,
      color: COLORS[index % COLORS.length].main,
    }))
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

  const handleItemClick = (event, itemIdentifier) => {
    if (onCategoryClick && itemIdentifier?.dataIndex !== undefined) {
      const clickedItem = data[itemIdentifier.dataIndex];
      if (clickedItem) {
        onCategoryClick(clickedItem.label);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Donut Chart with Center Stats */}
      <div className="relative w-full">
        <PieChart
          series={[{
            data,
            innerRadius: 60,
            outerRadius: 85,
            paddingAngle: 3,
            cornerRadius: 4,
            highlightScope: { fade: 'global', highlight: 'item' },
            valueFormatter: (item) => formatCurrency(item.value),
          }]}
          onItemClick={handleItemClick}
          slotProps={{
            legend: { hidden: true },
          }}
          height={220}
          margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
        />

        {/* Center Stats */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      {/* Category Breakdown - Scrollable */}
      <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
        {data.map((item, index) => {
          const percentage = ((item.value / total) * 100);
          const color = COLORS[index % COLORS.length];

          return (
            <button
              key={item.label}
              onClick={() => onCategoryClick?.(item.label)}
              className="w-full group"
            >
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200">
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
                    border: `1px solid ${color.main}30`
                  }}
                >
                  {getIcon(item.label)}
                </div>

                {/* Category Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {item.label}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white text-sm ml-2">
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
      </div>
    </div>
  );
}
