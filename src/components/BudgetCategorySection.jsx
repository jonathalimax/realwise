import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useBudget } from '../contexts/BudgetContext';
import { useAccess } from '../contexts/AccessContext';

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

// Category colors
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

export default function BudgetCategorySection({ transactions, selectedMonth, onConfigure, onCategoryClick }) {
  const { language, formatCurrency, categories } = useSettings();
  const { getBudgetForMonth, getBudgetStatus, getStatusColor } = useBudget();
  const { canWrite } = useAccess();

  const budget = getBudgetForMonth(selectedMonth);
  const categoryBudgets = budget?.categoryBudgets || {};

  // Calculate spending per category
  const categoryData = useMemo(() => {
    const spending = {};

    // Get spending from transactions
    transactions
      .filter(tx => tx.type === 'expense' && !tx.ignored)
      .forEach(tx => {
        spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
      });

    // Calculate total spending for percentage
    const total = Object.values(spending).reduce((sum, val) => sum + val, 0);

    // Get all expense categories from settings
    const allCategories = categories.expense || [];

    // Create data for all categories (even those without transactions)
    const data = allCategories.map((category, index) => {
      const spent = spending[category] || 0;
      const limit = categoryBudgets[category] || 0;
      const remaining = limit - spent;
      const budgetPercentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
      const spendingPercentage = total > 0 ? (spent / total) * 100 : 0;
      const status = getBudgetStatus(spent, limit);

      return {
        name: category,
        spent,
        limit,
        remaining,
        budgetPercentage,
        spendingPercentage,
        status,
        hasLimit: limit > 0,
        color: COLORS[index % COLORS.length],
        icon: CATEGORY_ICONS[category] || '💰',
      };
    });

    // Sort: categories with spending first, then by spent amount
    return data.sort((a, b) => {
      if (a.spent > 0 && b.spent === 0) return -1;
      if (a.spent === 0 && b.spent > 0) return 1;
      return b.spent - a.spent;
    });
  }, [transactions, categoryBudgets, categories.expense, getBudgetStatus]);

  const totalSpent = categoryData.reduce((sum, cat) => sum + cat.spent, 0);
  const totalBudget = categoryData.reduce((sum, cat) => sum + cat.limit, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Gastos por Categoria' : 'Expenses by Category'}
        </h3>
        {canWrite && (
          <button
            onClick={onConfigure}
            className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline"
          >
            {language === 'pt' ? 'Configurar' : 'Configure'}
          </button>
        )}
      </div>

      {/* Summary bar */}
      {totalBudget > 0 && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {language === 'pt' ? 'Total do mês' : 'Monthly total'}
            </span>
            <span className="text-sm font-semibold">
              <span className={totalSpent > totalBudget ? 'text-rose-600' : 'text-gray-900 dark:text-white'}>
                {formatCurrency(totalSpent)}
              </span>
              <span className="text-gray-400 dark:text-gray-500"> / {formatCurrency(totalBudget)}</span>
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalSpent > totalBudget ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {categoryData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <span className="text-3xl mb-2">📊</span>
          <p className="text-sm">{language === 'pt' ? 'Nenhuma categoria' : 'No categories'}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {categoryData.map((category) => {
            const statusColors = getStatusColor(category.status);

            return (
              <button
                key={category.name}
                onClick={() => onCategoryClick?.(category.name)}
                className="w-full group"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                  {/* Icon */}
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-lg sm:text-xl flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${category.color.light}20, ${category.color.main}30)`,
                      border: `1px solid ${category.color.main}30`
                    }}
                  >
                    {category.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                          {category.name}
                        </span>
                        {/* Show percentage badge on mobile if space allows */}
                        {totalSpent > 0 && category.spent > 0 && (
                          <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {((category.spent / totalSpent) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                          {formatCurrency(category.spent)}
                        </span>
                        {category.hasLimit && (
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            / {formatCurrency(category.limit)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 sm:h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        {category.hasLimit ? (
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${statusColors.bg}`}
                            style={{ width: `${category.budgetPercentage}%` }}
                          />
                        ) : category.spent > 0 ? (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${category.spendingPercentage}%`,
                              background: `linear-gradient(90deg, ${category.color.light}, ${category.color.main})`
                            }}
                          />
                        ) : null}
                      </div>

                      {category.hasLimit && (
                        <span className={`text-xs font-semibold ${statusColors.text} min-w-[60px] sm:min-w-[70px] text-right`}>
                          {category.budgetPercentage.toFixed(0)}% <span className="hidden sm:inline">{language === 'pt' ? 'usado' : 'used'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!totalBudget && canWrite && (
        <button
          onClick={onConfigure}
          className="w-full mt-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
        >
          {language === 'pt' ? 'Definir limites de orçamento' : 'Set budget limits'}
        </button>
      )}
    </div>
  );
}
