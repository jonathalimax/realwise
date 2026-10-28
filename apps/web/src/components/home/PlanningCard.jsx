import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
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
 * The month's plan as three rings (needs, wants, savings): each ring is how much of its planned slice is used,
 * with the numbers under it. Needs and wants are limits (turn amber near it, rose when over); savings is a goal.
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
  // Outer ring first: needs, then wants, then savings.
  const ringData = [...groups].reverse().map((g) => ({ name: g.label, value: Math.min(100, g.usedPct), fill: g.color }));
  const incomeUsedPct = Math.round((totalUsed / net) * 100);

  return (
    <HomeCard
      title={pt ? 'Planejamento' : 'Planning'}
      subtitle={`${formatCurrency(net)} ${pt ? 'de renda planejada' : 'planned income'}`}
      actionLabel={pt ? 'Planejador' : 'Planner'}
      onAction={() => navigate('/planner?tab=alocacao')}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-[150px] w-[150px] shrink-0" role="img" aria-label={pt ? 'Anéis do planejamento' : 'Planning rings'}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart data={ringData} innerRadius="38%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={13}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} angleAxisId={0} />
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'rgba(148,163,184,0.2)' }} isAnimationActive animationDuration={700} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{incomeUsedPct}%</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{pt ? 'da renda' : 'of income'}</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {groups.map((g) => (
            <li key={g.key} className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="truncate">{g.label}</span>
                </span>
                <span className="shrink-0 text-[13px] font-black tabular-nums" style={{ color: g.color }}>{Math.round(g.usedPct)}%</span>
              </div>
              <p className="pl-4 text-[11px] text-slate-400">{g.pct}% · {formatCurrency(g.planned)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 divide-y divide-slate-100 rounded-2xl bg-slate-50 dark:divide-slate-700/60 dark:bg-slate-900/30">
        {groups.map((g) => (
          <div key={g.key} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{g.label}</p>
              <p className={`text-[11px] font-semibold ${g.over ? 'text-rose-500' : g.goal ? 'text-emerald-500' : 'text-slate-400'}`}>
                {g.goal
                  ? g.remaining > 0
                    ? `${pt ? 'faltam' : 'to go'} ${formatCurrency(g.remaining)}`
                    : pt ? 'meta batida 🎉' : 'goal reached 🎉'
                  : g.over
                    ? `${pt ? 'estourou' : 'over by'} ${formatCurrency(-g.remaining)}`
                    : `${pt ? 'sobra' : 'left'} ${formatCurrency(g.remaining)}`}
              </p>
            </div>
            <p className="shrink-0 text-right text-[13px] tabular-nums text-slate-400">
              <strong className="text-slate-900 dark:text-white">{formatCurrency(g.used)}</strong>
              <span className="text-[11px]"> / {formatCurrency(g.planned)}</span>
            </p>
          </div>
        ))}
      </div>
    </HomeCard>
  );
}
