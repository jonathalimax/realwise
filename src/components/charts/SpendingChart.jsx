import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart } from '@mui/x-charts/PieChart';
import { useSettings } from '../../contexts/SettingsContext';
import { useBudget } from '../../contexts/BudgetContext';
import usePlannerState, { getActivePlannerVersion } from '../../pages/planner/usePlannerState';
import { computeNetSalary } from '../../pages/planner/rendaCalc';

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

export default function SpendingChart({ transactions, onCategoryClick, selectedMonth }) {
  const { formatCurrency, t } = useSettings();
  const { getTemplateBudget } = useBudget();
  const { state: plannerStateData } = usePlannerState();
  const navigate = useNavigate();

  const goToCategory = (category) => {
    if (onCategoryClick) {
      onCategoryClick(category);
      return;
    }
    sessionStorage.setItem('expenses_categoryFilter', category);
    navigate('/expenses');
  };

  const templateBudget = getTemplateBudget();
  const categoryBudgets = useMemo(
    () => templateBudget?.categoryBudgets ?? {},
    [templateBudget]
  );
  const plannerVersion = useMemo(
    () => getActivePlannerVersion(plannerStateData?.plannerVersions, selectedMonth),
    [plannerStateData?.plannerVersions, selectedMonth]
  );
  const liquidezFinal = useMemo(
    () => computeNetSalary(plannerVersion?.salarioBruto, plannerVersion?.salarioDeductions),
    [plannerVersion]
  );
  const categoryPct = useMemo(
    () => plannerVersion?.categoryBudgetsPct ?? {},
    [plannerVersion]
  );

  const resolveLimit = (category) => {
    const pctValue = categoryPct[category] ?? 0;
    const pctLimit = pctValue > 0 ? liquidezFinal * (pctValue / 100) : 0;
    const templateLimit = categoryBudgets[category] ?? 0;
    return pctLimit > 0 ? pctLimit : templateLimit;
  };

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
      limit: resolveLimit(name),
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
    if (itemIdentifier?.dataIndex === undefined) return;
    const clickedItem = data[itemIdentifier.dataIndex];
    if (clickedItem) goToCategory(clickedItem.label);
  };

  return (
    <div className="space-y-6">
      {/* Donut Chart with Center Stats */}
      <div className="relative w-full flex items-center justify-center">
        <PieChart
          series={[{
            data,
            innerRadius: 78,
            outerRadius: 120,
            paddingAngle: 3,
            cornerRadius: 4,
            highlightScope: { fade: 'global', highlight: 'item' },
            valueFormatter: (item) => formatCurrency(item.value),
          }]}
          onItemClick={handleItemClick}
          slotProps={{
            legend: { hidden: true },
          }}
          height={300}
          margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
          sx={{ maxWidth: '100%' }}
        />

        {/* Center Stats */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      {/* Category Breakdown - 2-column grid below chart */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {data.map((item, index) => {
          const hasLimit = item.limit > 0;
          const pct = hasLimit ? (item.value / item.limit) * 100 : (total > 0 ? (item.value / total) * 100 : 0);
          const isOver = hasLimit && pct > 100;
          const barWidth = Math.min(pct, 100);
          const color = COLORS[index % COLORS.length];

          return (
            <button
              key={item.label}
              onClick={() => goToCategory(item.label)}
              className="w-full group text-left"
            >
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/70 transition-all duration-200">
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
                    <div className="flex flex-col items-end gap-0.5 ml-2">
                      <span className="font-bold text-gray-900 dark:text-white text-sm tabular-nums">
                        {formatCurrency(item.value)}
                      </span>
                      <span className={`text-[10px] tabular-nums ${isOver ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {pct.toFixed(0)}%{hasLimit ? ` / ${formatCurrency(item.limit)}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-600/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: isOver ? '#EF4444' : color.main,
                      }}
                    />
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
