import { useBudget, RULE_COLORS } from '../contexts/BudgetContext';
import { useSettings } from '../contexts/SettingsContext';

export default function BudgetSummary({ currentMonth, transactions }) {
  const {
    getBudgetForMonth,
    calculateCategorySpending,
    getBudgetStatus,
    getStatusColor,
    getCategoryRule,
  } = useBudget();
  const { formatCurrency, t } = useSettings();

  const budget = getBudgetForMonth(currentMonth);
  const spending = calculateCategorySpending(transactions);

  if (!budget || Object.keys(budget.categoryBudgets || {}).length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white mb-2">{t('budget.categoryBudget')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('budget.noBudget')}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('budget.setBudgetHint')}</p>
      </div>
    );
  }

  const categories = Object.keys(budget.categoryBudgets).filter(
    cat => budget.categoryBudgets[cat] > 0
  );

  // Sort by percentage spent (highest first)
  const sortedCategories = [...categories].sort((a, b) => {
    const percentA = (spending[a] || 0) / budget.categoryBudgets[a];
    const percentB = (spending[b] || 0) / budget.categoryBudgets[b];
    return percentB - percentA;
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('budget.categoryBudget')}</h3>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {sortedCategories.map(category => {
          const limit = budget.categoryBudgets[category];
          const spent = spending[category] || 0;
          const percentage = (spent / limit) * 100;
          const status = getBudgetStatus(spent, limit);
          const statusColors = getStatusColor(status);
          const rule = getCategoryRule(category);
          const ruleColors = RULE_COLORS[rule];
          const remaining = limit - spent;

          return (
            <div key={category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ruleColors.bg}`} />
                  <span className="font-medium text-gray-900 dark:text-white">{category}</span>
                </div>
                <span className={`text-xs font-medium ${statusColors.text}`}>
                  {percentage.toFixed(0)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${statusColors.bg} transition-all duration-500 rounded-full`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
                {percentage > 100 && (
                  <div
                    className="absolute top-0 h-full bg-rose-600 opacity-60"
                    style={{ left: '100%', width: `${Math.min(percentage - 100, 50)}%` }}
                  />
                )}
              </div>

              {/* Amounts */}
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatCurrency(spent)} / {formatCurrency(limit)}</span>
                <span className={remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {remaining >= 0
                    ? `${t('budget.remaining')}: ${formatCurrency(remaining)}`
                    : `${t('budget.exceeded')}: ${formatCurrency(Math.abs(remaining))}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total summary */}
      {budget.totalBudget > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('budget.totalBudget')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(budget.totalBudget)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
