import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useBudget } from '../contexts/BudgetContext';
import { useMonth } from '../contexts/MonthContext';

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
  'Refund': '↩️', 'Reembolso': '↩️',
  'Uncategorized': '❓', 'Sem categoria': '❓',
};

export default function ExpensesByCategoryCard({ transactions }) {
  const { language, formatCurrency } = useSettings();
  const { getBudgetForMonth, getTemplateBudget, getStatusColor, getBudgetStatus } = useBudget();
  const { selectedMonth } = useMonth();
  const navigate = useNavigate();

  const budget = getBudgetForMonth(selectedMonth) || getTemplateBudget();
  const categoryBudgets = budget?.categoryBudgets || {};

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
        const pct = total > 0 ? (amount / total) * 100 : 0;

        return {
          category: cat,
          amount,
          pct,
          icon: CATEGORY_ICONS[cat] || '💰',
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { rows, total };
  }, [transactions, categoryBudgets, getBudgetStatus, getStatusColor]);

  if (rows.length === 0) return null;

  const handleCategoryClick = (category) => {
    sessionStorage.setItem('expenses_categoryFilter', category);
    sessionStorage.removeItem('expenses_bankFilter');
    sessionStorage.removeItem('expenses_paymentMethodFilter');
    sessionStorage.setItem('expenses_viewMode', 'payment');
    navigate('/expenses');
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {language === 'pt' ? 'Gastos por Categoria' : 'Expenses by Category'}
        </h2>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{formatCurrency(total)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-6 gap-y-4">
        {rows.map((row) => (
          <button
            key={row.category}
            onClick={() => handleCategoryClick(row.category)}
            className="w-full text-left hover:opacity-80 active:scale-[0.99] transition-all group"
          >
            <div className="flex justify-between mb-1.5 items-end">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
                <span className="text-base leading-none">{row.icon}</span>
                {row.category}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(row.amount)}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                  {row.pct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(row.pct, 100)}%`,
                  backgroundColor: COLORS[rows.findIndex(r => r.category === row.category) % COLORS.length]
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
