import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useBudget } from '../contexts/BudgetContext';
import { useMonth } from '../contexts/MonthContext';
import usePlannerState, { getActivePlannerVersion } from '../pages/planner/usePlannerState';
import { computeNetSalary } from '../pages/planner/rendaCalc';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

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
  'Refund': '↩️', 'Reembolso': '↩️',
  'Uncategorized': '❓', 'Sem categoria': '❓',
};

const MAX_VISIBLE = 7;

export default function ExpensesByCategoryCard({ transactions, selectedMonth }) {
  const { language, formatCurrency } = useSettings();
  const { getTemplateBudget } = useBudget();
  const { selectedMonth: contextMonth } = useMonth();
  const { state: plannerStateData } = usePlannerState();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const month = selectedMonth || contextMonth;

  const plannerVersion = useMemo(
    () => getActivePlannerVersion(plannerStateData?.plannerVersions, month),
    [plannerStateData?.plannerVersions, month]
  );
  const liquidezFinal = useMemo(
    () => computeNetSalary(plannerVersion?.salarioBruto, plannerVersion?.salarioDeductions),
    [plannerVersion]
  );
  const categoryPct = useMemo(
    () => plannerVersion?.categoryBudgetsPct ?? {},
    [plannerVersion]
  );
  const templateBudget = getTemplateBudget();
  const categoryBudgets = useMemo(() => templateBudget?.categoryBudgets ?? {}, [templateBudget]);

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
      .map(([cat, amount]) => {
        const pctValue = categoryPct[cat] ?? 0;
        const pctLimit = pctValue > 0 ? liquidezFinal * (pctValue / 100) : 0;
        const templateLimit = categoryBudgets[cat] ?? 0;
        const limit = pctLimit > 0 ? pctLimit : templateLimit;
        const hasLimit = limit > 0;
        const pct = hasLimit ? (amount / limit) * 100 : (amount / total) * 100;
        return { category: cat, amount, pct, hasLimit, limit, icon: CATEGORY_ICONS[cat] || '💰' };
      })
      .sort((a, b) => b.amount - a.amount);

    return { rows, total };
  }, [transactions, categoryPct, categoryBudgets, liquidezFinal]);

  if (rows.length === 0) return null;

  const handleCategoryClick = (category) => {
    sessionStorage.setItem('expenses_categoryFilter', category);
    sessionStorage.removeItem('expenses_bankFilter');
    sessionStorage.removeItem('expenses_paymentMethodFilter');
    sessionStorage.setItem('expenses_viewMode', 'payment');
    navigate('/expenses');
  };

  const visibleRows = expanded ? rows : rows.slice(0, MAX_VISIBLE);
  const hasMore = rows.length > MAX_VISIBLE;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {language === 'pt' ? 'Gastos' : 'Expenses'}
        </h2>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{formatCurrency(total)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-6 gap-y-4">
        {visibleRows.map((row, idx) => {
          const color = COLORS[rows.indexOf(row) % COLORS.length];
          const barWidth = Math.min(row.pct, 100);
          const isOver = row.hasLimit && row.pct > 100;

          return (
            <button
              key={row.category}
              onClick={() => handleCategoryClick(row.category)}
              className="w-full text-left rounded-xl p-2 -m-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.99] transition-all group"
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
                  <span className={`text-[10px] tabular-nums ${isOver ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                    {row.pct.toFixed(0)}%{row.hasLimit ? ` de ${formatCurrency(row.limit)}` : ''}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: isOver ? '#EF4444' : color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
        >
          {expanded ? (
            <><ChevronUpIcon className="w-4 h-4" />{language === 'pt' ? 'Ver menos' : 'Show less'}</>
          ) : (
            <><ChevronDownIcon className="w-4 h-4" />{language === 'pt' ? `Ver mais ${rows.length - MAX_VISIBLE}` : `Show ${rows.length - MAX_VISIBLE} more`}</>
          )}
        </button>
      )}
    </div>
  );
}
