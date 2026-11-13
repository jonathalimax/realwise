import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import HomeCard from './HomeCard';
import { compactMoney } from './format';
import { uncategorizedTotal } from './uncategorized';
import useBudgetGroups from './useBudgetGroups';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

const ROSE = 'var(--rw-neg)';

/**
 * "Orçamento": the month's plan as three plain rows (needs, wants, savings): a name, one phrase that says what is left
 * ("Sobram", "Passou", "Faltam") and a full-width bar. Spending with no category is kept out of the three buckets, so it
 * cannot make "Desejos" look broken, and shown on its own row instead.
 */
export default function PlanningCard({ transactions, selectedMonth }) {
  const { language, formatCurrency } = useSettings();
  const money = (v) => compactMoney(formatCurrency, Math.abs(v), language === 'pt');
  const navigate = useNavigate();
  const pt = language === 'pt';
  const { model, isLoading } = useBudgetGroups(transactions, selectedMonth);
  const uncategorized = useMemo(() => uncategorizedTotal(transactions), [transactions]);
  const totalExpense = useMemo(() => transactions.filter((t) => t.type === 'expense' && !t.ignored).reduce((s, t) => s + t.amount, 0), [transactions]);

  if (isLoading) return <div className="h-48 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />;

  if (!model || model.net <= 0) {
    return (
      <HomeCard title={pt ? 'Orçamento' : 'Budget'} subtitle={pt ? 'Defina quanto planeja gastar e poupar' : 'Set how much you plan to spend and save'}>
        <button
          onClick={() => navigate('/planning')}
          className="w-full rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300"
        >
          {pt ? 'Criar meu planejamento' : 'Create my plan'}
        </button>
      </HomeCard>
    );
  }

  const goUncategorized = () => {
    navigate(`/transactions?${new URLSearchParams({ category: pt ? 'Sem categoria' : 'Uncategorized', type: 'expense', month: selectedMonth })}`);
  };

  const rows = model.groups.map((g) => {
    const phrase = g.goal
      ? g.remaining > 0 ? `${pt ? 'Faltam' : 'To go'} ${money(g.remaining)}` : pt ? 'Meta batida 🎉' : 'Goal reached 🎉'
      : g.over ? `${pt ? 'Passou' : 'Over by'} ${money(g.remaining)}` : `${pt ? 'Sobram' : 'Left'} ${money(g.remaining)}`;
    return { key: g.key, onClick: () => navigate(`/budget/group/${g.key}`), label: g.label, dot: g.base, phrase, phraseColor: g.over ? ROSE : null, fill: Math.min(100, Math.max(g.used > 0 ? 2 : 0, g.usedPct)), bar: g.bar };
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
    <HomeCard title={pt ? 'Orçamento' : 'Budget'} actionLabel={pt ? 'Ver tudo' : 'See all'} onAction={() => navigate('/planning')}>
      <div className="space-y-2">
        {rows.map((r) => {
          return (
            <button key={r.key} type="button" onClick={r.onClick} className="-mx-2 block min-h-[44px] w-[calc(100%+1rem)] rounded-2xl px-2 py-1.5 text-left transition-colors active:bg-[var(--rw-raised)]">
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex min-w-0 items-center gap-3 text-base text-[var(--rw-ink)]">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.dot }} />
                  <span className="truncate">{r.label}</span>
                </p>
                <span className="flex shrink-0 items-center gap-1 text-base font-semibold tabular-nums text-[var(--rw-ink)]" style={r.phraseColor ? { color: r.phraseColor } : undefined}>
                  {r.phrase}
                  <ChevronRightIcon className="h-4 w-4 text-[var(--rw-subtle)]" aria-hidden />
                </span>
              </div>
              <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-[var(--rw-track)]">
                <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${r.fill}%`, backgroundColor: r.bar }} />
              </div>
            </button>
          );
        })}
      </div>
    </HomeCard>
  );
}
