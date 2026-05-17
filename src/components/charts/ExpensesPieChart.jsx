import { useMemo, useState, useEffect } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
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
  'Mercado': '🛒', 'Groceries': '🛒',
  'Esporte': '⚽', 'Sports': '⚽',
  'Beleza': '💅', 'Beauty': '💅',
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

export default function ExpensesPieChart({ transactions }) {
  const { language, formatCurrency } = useSettings();

  // Responsive chart dimensions based on screen width
  const [dimensions, setDimensions] = useState({
    innerRadius: 100,
    outerRadius: 180,
    height: 400,
    legendCols: 2
  });

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      if (width < 360) {
        // iPhone SE and very small screens
        setDimensions({ innerRadius: 50, outerRadius: 90, height: 220, legendCols: 1 });
      } else if (width < 480) {
        // Small phones
        setDimensions({ innerRadius: 60, outerRadius: 110, height: 260, legendCols: 1 });
      } else if (width < 640) {
        // Medium phones
        setDimensions({ innerRadius: 70, outerRadius: 130, height: 300, legendCols: 2 });
      } else {
        // Tablets and desktop
        setDimensions({ innerRadius: 100, outerRadius: 180, height: 400, legendCols: 2 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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
        id: index,
        value: amount,
        label: category,
        icon: CATEGORY_ICONS[category] || '💰',
        percentage: ((amount / total) * 100).toFixed(1),
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
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
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Gastos por Categoria' : 'Expenses by Category'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {language === 'pt' ? 'Total: ' : 'Total: '}
          <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(totalExpenses)}</span>
        </p>
      </div>

      <PieChart
        series={[{
          data: chartData,
          innerRadius: dimensions.innerRadius,
          outerRadius: dimensions.outerRadius,
          paddingAngle: 2,
          cornerRadius: 4,
          highlightScope: { fade: 'global', highlight: 'item' },
          valueFormatter: (item) => formatCurrency(item.value),
        }]}
        slotProps={{
          legend: { hidden: true },
        }}
        height={dimensions.height}
        margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
      />

      {/* Custom Legend */}
      <div className={`grid gap-2 mt-4 ${dimensions.legendCols === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {chartData.map((entry, index) => (
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
                {entry.icon} {entry.label}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                {formatCurrency(entry.value)} ({entry.percentage}%)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
