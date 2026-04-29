import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useBudget } from '../contexts/BudgetContext';
import usePlannerState, { getActivePlannerVersion } from '../pages/planner/usePlannerState';
import { computeNetSalary } from '../pages/planner/rendaCalc';

const COLORS = [
  '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#3B82F6', '#84CC16',
  '#F97316', '#14B8A6',
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
  'Investments': '📈', 'Investimentos': '📈',
};

export default function ExpensesByCategoryCard({ transactions, selectedMonth }) {
  const { language, formatCurrency } = useSettings();
  const { getTemplateBudget } = useBudget();
  const { state: plannerStateData } = usePlannerState();
  const navigate = useNavigate();

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

  const { rows, total } = useMemo(() => {
    const spending = {};
    transactions
      .filter(tx => tx.type === 'expense' && !tx.ignored)
      .forEach(tx => {
        spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
      });

    const total = Object.values(spending).reduce((s, v) => s + v, 0);
    if (total === 0) return { rows: [], total: 0 };

    const rows = Object.entries(spending)
      .filter(([, v]) => v > 0)
      .map(([cat, amount], i) => {
        const pctValue = categoryPct[cat] ?? 0;
        const pctLimit = pctValue > 0 ? liquidezFinal * (pctValue / 100) : 0;
        const templateLimit = categoryBudgets[cat] ?? 0;
        const limit = pctLimit > 0 ? pctLimit : templateLimit;
        const pct = limit > 0 ? (amount / limit) * 100 : 0;
        return {
          category: cat,
          amount,
          limit,
          pct,
          icon: CATEGORY_ICONS[cat] || '💰',
          color: COLORS[i % COLORS.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { rows, total };
  }, [transactions, categoryBudgets, categoryPct, liquidezFinal]);

  if (rows.length === 0) return null;

  const handleCategoryClick = (category) => {
    sessionStorage.setItem('expenses_categoryFilter', category);
    navigate('/expenses');
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Gastos por Categoria' : 'Expenses by Category'}
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">{formatCurrency(total)}</span>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <button
            key={row.category}
            onClick={() => handleCategoryClick(row.category)}
            className="w-full text-left hover:opacity-80 active:scale-[0.99] transition-all"
          >
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                {row.icon} {row.category}
              </span>
              <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums ml-2">
                {row.limit > 0 ? (
                  <>
                    {formatCurrency(row.amount)} / {formatCurrency(row.limit)} ({row.pct.toFixed(0)}%)
                  </>
                ) : (
                  formatCurrency(row.amount)
                )}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(row.pct, 100)}%`,
                  backgroundColor: row.color
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
