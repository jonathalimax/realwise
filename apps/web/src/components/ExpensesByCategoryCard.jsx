import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useBudget } from '../contexts/BudgetContext';
import { useMonth } from '../contexts/MonthContext';
import { useAccess } from '../contexts/AccessContext';
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
  const { language, formatCurrency, categories } = useSettings();
  const { getTemplateBudget } = useBudget();
  const { selectedMonth: contextMonth } = useMonth();
  const { premiumFeatureLocks } = useAccess();
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

    const allCats = Array.from(new Set([
      ...(categories?.expense ?? []),
      ...Object.keys(spending),
    ]));

    const rows = allCats.map(cat => {
      const amount = spending[cat] ?? 0;
      const pctValue = categoryPct[cat] ?? 0;
      const pctLimit = pctValue > 0 ? liquidezFinal * (pctValue / 100) : 0;
      const templateLimit = categoryBudgets[cat] ?? 0;
      const limit = pctLimit > 0 ? pctLimit : templateLimit;
      const hasLimit = limit > 0;
      const hasSpending = amount > 0;
      const pct = hasLimit
        ? (amount / limit) * 100
        : (total > 0 ? (amount / total) * 100 : 0);
      return { category: cat, amount, pct, hasLimit, hasSpending, limit, icon: CATEGORY_ICONS[cat] || '💰' };
    });

    rows.sort((a, b) => {
      if (a.hasSpending !== b.hasSpending) return b.hasSpending ? 1 : -1;
      if (a.amount !== b.amount) return b.amount - a.amount;
      if (a.hasLimit !== b.hasLimit) return b.hasLimit ? 1 : -1;
      return a.category.localeCompare(b.category);
    });

    return { rows, total };
  }, [transactions, categories, categoryPct, categoryBudgets, liquidezFinal]);

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
  const isSpendGuidanceLocked = premiumFeatureLocks?.spendGuidance ?? false;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {language === 'pt' ? 'Gastos' : 'Expenses'}
        </h2>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{formatCurrency(total)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-6 gap-y-4">
        {visibleRows.map((row) => {
          const color = COLORS[rows.indexOf(row) % COLORS.length];
          const barWidth = Math.min(row.pct, 100);
          const isOver = row.hasLimit && row.pct > 100;
          const isDimmed = !row.hasSpending && !row.hasLimit;
          const remaining = row.limit - row.amount;

          return (
            <button
              key={row.category}
              onClick={() => handleCategoryClick(row.category)}
              className={`w-full text-left rounded-xl p-2 -m-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.99] transition-all group ${isDimmed ? 'opacity-40' : ''}`}
            >
              <div className="flex justify-between mb-1.5 items-center">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
                  <span className="text-base leading-none">{row.icon}</span>
                  {row.category}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums ml-2 shrink-0">
                  {formatCurrency(row.amount)}
                </span>
              </div>

              {(row.hasSpending || row.hasLimit) && (
                <>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: isOver ? '#EF4444' : color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    {row.hasLimit ? (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {row.pct.toFixed(0)}% de {formatCurrency(row.limit)}
                      </span>
                    ) : <span />}
                    {!isSpendGuidanceLocked && row.hasLimit && row.hasSpending && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                        isOver
                          ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                      }`}>
                        {isOver
                          ? `↑ ${formatCurrency(Math.abs(remaining))} acima`
                          : `↓ ${formatCurrency(remaining)} livres`}
                      </span>
                    )}
                    {!isSpendGuidanceLocked && row.hasLimit && !row.hasSpending && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
                        {formatCurrency(row.limit)} disponíveis
                      </span>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {isSpendGuidanceLocked && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">
            {language === 'pt' ? 'Planejamento Premium' : 'Premium Planning'}
          </p>
          <p className="mt-1">
            {language === 'pt'
              ? 'Você pode ver quanto já gastou por categoria. Desbloqueie o Premium para ver quanto ainda pode gastar com segurança.'
              : 'You can see how much you already spent by category. Unlock Premium to see how much you can still safely spend.'}
          </p>
        </div>
      )}

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
