import { useMemo } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useBudget } from '../../contexts/BudgetContext';
import usePlannerState, { getActivePlannerVersion } from '../../pages/planner/usePlannerState';
import { computeNetSalary } from '../../pages/planner/rendaCalc';

/**
 * Spending per expense category for the month, next to the user's limit for it:
 * { category, amount, limit, hasLimit, hasSpending, share, usedPct, remaining, over }
 * - limit: the planner percentage of net income when set, otherwise the template budget.
 * - usedPct: amount / limit (when there is a limit), else the category's share of total spending.
 */
export default function useCategorySpending(transactions, month) {
  const { categories } = useSettings();
  const { getTemplateBudget } = useBudget();
  const { state: plannerState } = usePlannerState();

  const plannerVersion = useMemo(() => getActivePlannerVersion(plannerState?.plannerVersions, month), [plannerState?.plannerVersions, month]);
  const netIncome = useMemo(() => computeNetSalary(plannerVersion?.salarioBruto, plannerVersion?.salarioDeductions), [plannerVersion]);
  const categoryPct = useMemo(() => plannerVersion?.categoryBudgetsPct ?? {}, [plannerVersion]);
  const templateBudget = getTemplateBudget();
  const categoryBudgets = useMemo(() => templateBudget?.categoryBudgets ?? {}, [templateBudget]);

  return useMemo(() => {
    const spending = {};
    transactions
      .filter((tx) => tx.type === 'expense' && !tx.ignored)
      .forEach((tx) => {
        spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
      });
    const total = Object.values(spending).reduce((s, v) => s + v, 0);

    const names = Array.from(new Set([...(categories?.expense ?? []), ...Object.keys(spending)]));
    const rows = names.map((category) => {
      const amount = spending[category] ?? 0;
      const pctValue = categoryPct[category] ?? 0;
      const pctLimit = pctValue > 0 ? netIncome * (pctValue / 100) : 0;
      const limit = pctLimit > 0 ? pctLimit : categoryBudgets[category] ?? 0;
      const hasLimit = limit > 0;
      const share = total > 0 ? (amount / total) * 100 : 0;
      return {
        category,
        amount,
        limit,
        hasLimit,
        hasSpending: amount > 0,
        share,
        usedPct: hasLimit ? (amount / limit) * 100 : share,
        remaining: hasLimit ? limit - amount : null,
        over: hasLimit && amount > limit,
      };
    });

    rows.sort((a, b) => {
      if (a.hasSpending !== b.hasSpending) return b.hasSpending ? 1 : -1;
      if (a.amount !== b.amount) return b.amount - a.amount;
      if (a.hasLimit !== b.hasLimit) return b.hasLimit ? 1 : -1;
      return a.category.localeCompare(b.category);
    });

    const withLimit = rows.filter((r) => r.hasLimit);
    return {
      rows,
      total,
      totalLimit: withLimit.reduce((s, r) => s + r.limit, 0),
      spentWithLimit: withLimit.reduce((s, r) => s + r.amount, 0),
      overCount: rows.filter((r) => r.over).length,
    };
  }, [transactions, categories, categoryPct, categoryBudgets, netIncome]);
}
