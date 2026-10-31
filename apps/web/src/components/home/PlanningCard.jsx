import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { useBudget } from '../../contexts/BudgetContext';
import usePlannerState from '../../pages/planner/usePlannerState';
import { computeTotalIncome } from '../../pages/planner/rendaCalc';
import HomeCard from './HomeCard';
import { compactMoney } from './format';
import { uncategorizedTotal, withoutUncategorized } from './uncategorized';

const AMBER = '#F59E0B';
const ROSE = '#F43F5E';

/**
 * "Orçamento": the month's plan as three plain rows (needs, wants, savings): a name, one phrase that says what is left
 * ("Sobram", "Passou", "Faltam") and a full-width bar. Spending with no category is kept out of the three buckets, so it
 * cannot make "Desejos" look broken, and shown on its own row instead.
 */
export default function PlanningCard({ transactions, selectedMonth }) {
  const { language, formatCurrency } = useSettings();
  const money = (v) => compactMoney(formatCurrency, Math.abs(v), language === 'pt');
  const { calculate50_30_20 } = useBudget();
  const { state, isLoading } = usePlannerState();
  const navigate = useNavigate();
  const pt = language === 'pt';

  const version = useMemo(() => state?.plannerVersions?.find((v) => v.from === selectedMonth) ?? null, [state?.plannerVersions, selectedMonth]);
  const uncategorized = useMemo(() => uncategorizedTotal(transactions), [transactions]);
  const totalExpense = useMemo(() => transactions.filter((t) => t.type === 'expense' && !t.ignored).reduce((s, t) => s + t.amount, 0), [transactions]);

  const model = useMemo(() => {
    if (!version) return null;
    const net = computeTotalIncome(version.salarioBruto, version.salarioDeductions, version.salarioBenefits);
    const alloc = version.allocation ?? { necessidades: 70, poupanca: 20, desejos: 10 };
    const spent = calculate50_30_20(withoutUncategorized(transactions), 0);
    const defs = [
      { key: 'needs', label: pt ? 'Necessidades' : 'Needs', pct: alloc.necessidades, base: '#60A5FA', goal: false },
      { key: 'wants', label: pt ? 'Desejos' : 'Wants', pct: alloc.desejos, base: '#F472B6', goal: false },
      { key: 'savings', label: pt ? 'Poupança' : 'Savings', pct: alloc.poupanca, base: '#5EEAD4', goal: true },
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

  if (isLoading) return <div className="h-48 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />;

  if (!model || model.net <= 0) {
    return (
      <HomeCard title={pt ? 'Orçamento' : 'Budget'} subtitle={pt ? 'Defina quanto planeja gastar e poupar' : 'Set how much you plan to spend and save'}>
        <button
          onClick={() => navigate('/planner?tab=alocacao')}
          className="w-full rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300"
        >
          {pt ? 'Criar meu planejamento' : 'Create my plan'}
        </button>
      </HomeCard>
    );
  }

  const goUncategorized = () => {
    sessionStorage.setItem('expenses_categoryFilter', pt ? 'Sem categoria' : 'Uncategorized');
    sessionStorage.removeItem('expenses_bankFilter');
    sessionStorage.removeItem('expenses_paymentMethodFilter');
    sessionStorage.setItem('expenses_viewMode', 'payment');
    navigate('/expenses');
  };

  const rows = model.groups.map((g) => {
    const phrase = g.goal
      ? g.remaining > 0 ? `${pt ? 'Faltam' : 'To go'} ${money(g.remaining)}` : pt ? 'Meta batida 🎉' : 'Goal reached 🎉'
      : g.over ? `${pt ? 'Passou' : 'Over by'} ${money(g.remaining)}` : `${pt ? 'Sobram' : 'Left'} ${money(g.remaining)}`;
    return { key: g.key, label: g.label, dot: g.base, phrase, phraseColor: g.over ? ROSE : null, fill: Math.min(100, Math.max(g.used > 0 ? 2 : 0, g.usedPct)), bar: g.bar };
  });
  if (uncategorized > 0) {
    rows.push({
      key: 'uncategorized',
      label: pt ? 'Sem categoria' : 'Uncategorized',
      dot: '#6B7280',
      phrase: money(uncategorized),
      phraseColor: null,
      fill: totalExpense > 0 ? Math.min(100, Math.max(2, (uncategorized / totalExpense) * 100)) : 0,
      bar: '#6B7280',
      onClick: goUncategorized,
    });
  }

  return (
    <HomeCard title={pt ? 'Orçamento' : 'Budget'} actionLabel={pt ? 'Ver tudo' : 'See all'} onAction={() => navigate('/planner?tab=alocacao')}>
      <div className="space-y-5">
        {rows.map((r) => {
          const Wrapper = r.onClick ? 'button' : 'div';
          return (
            <Wrapper key={r.key} onClick={r.onClick} className="block w-full text-left">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex min-w-0 items-center gap-3 text-base text-slate-800 dark:text-slate-100">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.dot }} />
                  <span className="truncate">{r.label}</span>
                </p>
                <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900 dark:text-white" style={r.phraseColor ? { color: r.phraseColor } : undefined}>
                  {r.phrase}
                </span>
              </div>
              <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
                <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${r.fill}%`, backgroundColor: r.bar }} />
              </div>
            </Wrapper>
          );
        })}
      </div>
    </HomeCard>
  );
}
