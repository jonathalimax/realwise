import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { useBudget } from '../../contexts/BudgetContext';
import usePlannerState from '../../pages/planner/usePlannerState';
import { computeTotalIncome } from '../../pages/planner/rendaCalc';
import HomeCard from './HomeCard';
import { trimCents } from './format';

const AMBER = '#F59E0B';
const ROSE = '#F43F5E';
const EMERALD = '#10B981';

/**
 * The month's plan as three stacked rows (needs, wants, savings), one per line so every number stays large on a phone:
 * name + share used, a full-width bar, then what was spent of the planned amount and what is left. Needs and wants are
 * limits (amber near it, rose when over); savings is a goal.
 */
export default function PlanningCard({ transactions, selectedMonth }) {
  const { language, formatCurrency: formatFull } = useSettings();
  const formatCurrency = (v) => trimCents(formatFull(v));
  const { calculate50_30_20 } = useBudget();
  const { state, isLoading } = usePlannerState();
  const navigate = useNavigate();
  const pt = language === 'pt';

  const version = useMemo(() => state?.plannerVersions?.find((v) => v.from === selectedMonth) ?? null, [state?.plannerVersions, selectedMonth]);

  const model = useMemo(() => {
    if (!version) return null;
    const net = computeTotalIncome(version.salarioBruto, version.salarioDeductions, version.salarioBenefits);
    const alloc = version.allocation ?? { necessidades: 70, poupanca: 20, desejos: 10 };
    const spent = calculate50_30_20(transactions, 0);
    const defs = [
      { key: 'needs', label: pt ? 'Necessidades' : 'Needs', pct: alloc.necessidades, base: '#3B82F6', goal: false },
      { key: 'wants', label: pt ? 'Desejos' : 'Wants', pct: alloc.desejos, base: '#8B5CF6', goal: false },
      { key: 'savings', label: pt ? 'Poupança' : 'Savings', pct: alloc.poupanca, base: EMERALD, goal: true },
    ];
    const groups = defs.map((d) => {
      const planned = (net * d.pct) / 100;
      const used = spent[d.key]?.spent ?? 0;
      const usedPct = planned > 0 ? (used / planned) * 100 : 0;
      const over = !d.goal && used > planned;
      const color = d.goal ? d.base : over ? ROSE : usedPct >= 85 ? AMBER : d.base;
      return { ...d, planned, used, usedPct, over, color, remaining: planned - used };
    });
    const totalUsed = groups.reduce((s, g) => s + g.used, 0);
    return { net, groups, totalUsed };
  }, [version, transactions, calculate50_30_20, pt]);

  if (isLoading) return <div className="h-48 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />;

  if (!model || model.net <= 0) {
    return (
      <HomeCard title={pt ? 'Planejamento' : 'Planning'} subtitle={pt ? 'Defina quanto planeja gastar e poupar' : 'Set how much you plan to spend and save'}>
        <button
          onClick={() => navigate('/planner?tab=alocacao')}
          className="w-full rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300"
        >
          {pt ? 'Criar meu planejamento' : 'Create my plan'}
        </button>
      </HomeCard>
    );
  }

  const { groups, net, totalUsed } = model;
  const incomeUsedPct = Math.round((totalUsed / net) * 100);

  return (
    <HomeCard
      title={pt ? 'Planejamento' : 'Planning'}
      subtitle={`${formatCurrency(net)} ${pt ? 'de renda planejada' : 'planned income'}`}
      actionLabel={pt ? 'Planejador' : 'Planner'}
      onAction={() => navigate('/planner?tab=alocacao')}
    >
      <div className="mb-4">
        <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
          {incomeUsedPct}%<span className="ml-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{pt ? 'da renda já usada' : 'of income used'}</span>
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatCurrency(totalUsed)} {pt ? 'de' : 'of'} {formatCurrency(net)}
        </p>
      </div>

      <div className="space-y-5">
        {groups.map((g) => {
          const fill = Math.min(100, Math.max(g.used > 0 ? 2 : 0, g.usedPct));
          const status = g.goal
            ? g.remaining > 0
              ? `${pt ? 'Faltam' : 'To go'} ${formatCurrency(g.remaining)} ${pt ? 'para a meta' : 'to the goal'}`
              : pt ? 'Meta batida 🎉' : 'Goal reached 🎉'
            : g.over
              ? `${pt ? 'Estourou' : 'Over by'} ${formatCurrency(-g.remaining)}`
              : `${pt ? 'Ainda sobram' : 'Left:'} ${formatCurrency(g.remaining)}`;
          return (
            <div key={g.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="truncate">{g.label}</span>
                </p>
                <span className="shrink-0 text-xl font-black tabular-nums" style={{ color: g.color }}>
                  {Math.round(g.usedPct)}%
                </span>
              </div>
              <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${fill}%`, backgroundColor: g.color }} />
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">{formatCurrency(g.used)}</strong> {pt ? 'de' : 'of'} {formatCurrency(g.planned)}
                <span className="text-slate-400"> · {g.pct}% {pt ? 'da renda' : 'of income'}</span>
              </p>
              <p className={`text-sm font-semibold ${g.over ? 'text-rose-500' : g.goal ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{status}</p>
            </div>
          );
        })}
      </div>
    </HomeCard>
  );
}
