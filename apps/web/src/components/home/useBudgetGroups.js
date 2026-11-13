import { useMemo } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useBudget } from '../../contexts/BudgetContext';
import usePlannerState from '../../pages/planner/usePlannerState';
import { computeTotalIncome } from '../../pages/planner/rendaCalc';
import { withoutUncategorized } from './uncategorized';

const AMBER = 'var(--rw-warn)';
const ROSE = 'var(--rw-neg)';

/**
 * The month's plan as three groups (needs, wants, savings): planned amount, used amount, remaining and bar colour.
 * Shared by the Home "Orçamento" card and the group detail screen so both always agree.
 * `model` is null while there is no plan for the month.
 */
export default function useBudgetGroups(transactions, selectedMonth) {
  const { language } = useSettings();
  const pt = language === 'pt';
  const { calculate50_30_20 } = useBudget();
  const { state, isLoading } = usePlannerState();

  const version = useMemo(() => state?.plannerVersions?.find((v) => v.from === selectedMonth) ?? null, [state?.plannerVersions, selectedMonth]);

  const model = useMemo(() => {
    if (!version) return null;
    const net = computeTotalIncome(version.salarioBruto, version.salarioDeductions, version.salarioBenefits);
    const alloc = version.allocation ?? { necessidades: 70, poupanca: 20, desejos: 10 };
    const spent = calculate50_30_20(withoutUncategorized(transactions), 0);
    const defs = [
      { key: 'needs', label: pt ? 'Necessidades' : 'Needs', pct: alloc.necessidades, base: 'var(--rw-needs)', goal: false },
      { key: 'wants', label: pt ? 'Desejos' : 'Wants', pct: alloc.desejos, base: 'var(--rw-wants)', goal: false },
      { key: 'savings', label: pt ? 'Poupança' : 'Savings', pct: alloc.poupanca, base: 'var(--rw-save)', goal: true },
    ];
    const groups = defs.map((d) => {
      const planned = (net * d.pct) / 100;
      const used = spent[d.key]?.spent ?? 0;
      const usedPct = planned > 0 ? (used / planned) * 100 : 0;
      const over = !d.goal && used > planned;
      const bar = d.goal ? d.base : over ? ROSE : usedPct >= 85 ? AMBER : d.base;
      return { ...d, planned, used, usedPct, over, bar, remaining: planned - used };
    });
    return { net, groups };
  }, [version, transactions, calculate50_30_20, pt]);

  return { model, isLoading };
}
