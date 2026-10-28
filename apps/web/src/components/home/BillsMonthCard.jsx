import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useBills } from '../../contexts/BillsContext';
import { useSettings } from '../../contexts/SettingsContext';
import { buildMonthlyBillRows } from '../../lib/bills/occurrences';
import HomeCard from './HomeCard';
import { trimCents } from './format';

const PAID = '#10B981';
const UPCOMING = '#F59E0B';
const OVERDUE = '#F43F5E';

const dayOnly = (v) => String(v).slice(0, 10);

/** The month's bills as a donut (paid / due soon / overdue, in reais) with the next ones due listed under it. */
export default function BillsMonthCard({ selectedMonth }) {
  const { bills, loading } = useBills();
  const { language, formatCurrency: formatFull } = useSettings();
  const formatCurrency = (v) => trimCents(formatFull(v));
  const navigate = useNavigate();
  const pt = language === 'pt';

  const model = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const rows = buildMonthlyBillRows(bills, selectedMonth).filter((b) => {
      const d = new Date(b.dueDate);
      return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
    });
    const today = new Date().toISOString().slice(0, 10);
    const sum = (list) => list.reduce((s, b) => s + Number(b.amount || 0), 0);
    const paid = rows.filter((b) => b.status === 'paid');
    const pending = rows.filter((b) => b.status !== 'paid');
    const overdue = pending.filter((b) => dayOnly(b.dueDate) < today);
    const upcoming = pending.filter((b) => dayOnly(b.dueDate) >= today);
    const next = [...pending].sort((a, b) => dayOnly(a.dueDate).localeCompare(dayOnly(b.dueDate))).slice(0, 3);
    return { rows, paid, overdue, upcoming, next, today, amounts: { paid: sum(paid), overdue: sum(overdue), upcoming: sum(upcoming) } };
  }, [bills, selectedMonth]);

  if (loading) return <div className="h-48 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800/70" />;

  const { rows, paid, overdue, upcoming, next, today, amounts } = model;
  if (rows.length === 0) {
    return (
      <HomeCard title={pt ? 'Contas do mês' : 'Monthly bills'} subtitle={pt ? 'Nenhuma conta neste mês' : 'No bills this month'} actionLabel={pt ? 'Ver contas' : 'Bills'} onAction={() => navigate('/bills')}>
        <p className="rounded-2xl bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
          {pt ? 'Peça ao Elio: "tenho aluguel todo dia 5, R$ 1.800" e ele cria o lembrete para você.' : 'Ask Elio: "rent is due on the 5th, $1,800" and it creates the reminder for you.'}
        </p>
      </HomeCard>
    );
  }

  const totalAmount = amounts.paid + amounts.overdue + amounts.upcoming;
  const pendingAmount = amounts.overdue + amounts.upcoming;
  const donut = [
    { key: 'paid', name: pt ? 'Pagas' : 'Paid', value: amounts.paid, color: PAID, count: paid.length },
    { key: 'overdue', name: pt ? 'Atrasadas' : 'Overdue', value: amounts.overdue, color: OVERDUE, count: overdue.length },
    { key: 'upcoming', name: pt ? 'A vencer' : 'Upcoming', value: amounts.upcoming, color: UPCOMING, count: upcoming.length },
  ];
  const slices = donut.filter((d) => d.value > 0);
  const paidPct = totalAmount > 0 ? Math.round((amounts.paid / totalAmount) * 100) : 0;

  const dueLabel = (iso) => {
    const diff = Math.round((new Date(`${dayOnly(iso)}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
    if (diff < 0) return pt ? `atrasada ${-diff}d` : `${-diff}d overdue`;
    if (diff === 0) return pt ? 'vence hoje' : 'due today';
    return pt ? `em ${diff}d` : `in ${diff}d`;
  };

  return (
    <HomeCard
      title={pt ? 'Contas do mês' : 'Monthly bills'}
      subtitle={`${paid.length}/${rows.length} ${pt ? 'pagas' : 'paid'} · ${paidPct}% ${pt ? 'do valor' : 'of the amount'}`}
      actionLabel={pt ? 'Ver contas' : 'Bills'}
      onAction={() => navigate('/bills')}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-[130px] w-[130px] shrink-0" role="img" aria-label={pt ? 'Contas pagas e a pagar' : 'Paid and unpaid bills'}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices.length ? slices : [{ key: 'none', value: 1, color: '#CBD5E1' }]} dataKey="value" innerRadius="66%" outerRadius="96%" paddingAngle={slices.length > 1 ? 3 : 0} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270} isAnimationActive animationDuration={700}>
                {(slices.length ? slices : [{ key: 'none', color: '#CBD5E1' }]).map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{pendingAmount > 0 ? (pt ? 'A pagar' : 'To pay') : pt ? 'Em dia' : 'Up to date'}</span>
            <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">{pendingAmount > 0 ? formatCurrency(pendingAmount) : '🎉'}</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {donut.map((d) => (
            <li key={d.key} className={`min-w-0 ${d.count === 0 ? 'opacity-40' : ''}`}>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} <span className="font-normal text-slate-400">· {d.count}</span>
              </p>
              <p className="pl-4 text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{formatCurrency(d.value)}</p>
            </li>
          ))}
        </ul>
      </div>

      {next.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{pt ? 'Próximas' : 'Next up'}</p>
          {next.map((b) => {
            const late = dayOnly(b.dueDate) < today;
            return (
              <button
                key={`${b.id}-${b.dueDate}`}
                onClick={() => navigate('/bills?status=pending')}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{b.name}</span>
                  <span className={`text-[11px] ${late ? 'font-semibold text-rose-500' : 'text-slate-400'}`}>
                    {dayOnly(b.dueDate).slice(8, 10)}/{dayOnly(b.dueDate).slice(5, 7)} · {dueLabel(b.dueDate)}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(Number(b.amount || 0))}</span>
              </button>
            );
          })}
        </div>
      )}
    </HomeCard>
  );
}
