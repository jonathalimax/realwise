import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBills } from '../../contexts/BillsContext';
import { useSettings } from '../../contexts/SettingsContext';
import { buildMonthlyBillRows } from '../../lib/bills/occurrences';
import HomeCard from './HomeCard';
import { trimCents } from './format';

const PAID = '#10B981';
const UPCOMING = '#F59E0B';
const OVERDUE = '#F43F5E';

const dayOnly = (v) => String(v).slice(0, 10);

/**
 * The month's bills: one big "to pay" number, a single full-width bar split into paid / overdue / due soon, one legend
 * row per status, and the next ones due listed under it. Everything is one column so each number stays readable.
 */
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
  const statuses = [
    { key: 'paid', name: pt ? 'Pagas' : 'Paid', value: amounts.paid, color: PAID, count: paid.length },
    { key: 'overdue', name: pt ? 'Atrasadas' : 'Overdue', value: amounts.overdue, color: OVERDUE, count: overdue.length },
    { key: 'upcoming', name: pt ? 'A vencer' : 'Upcoming', value: amounts.upcoming, color: UPCOMING, count: upcoming.length },
  ];
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
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{pendingAmount > 0 ? (pt ? 'Falta pagar' : 'Left to pay') : pt ? 'Tudo em dia' : 'All up to date'}</p>
        <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">{pendingAmount > 0 ? formatCurrency(pendingAmount) : '🎉'}</p>
      </div>

      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60" role="img" aria-label={pt ? 'Contas pagas, atrasadas e a vencer' : 'Paid, overdue and upcoming bills'}>
        {statuses.filter((d) => d.value > 0).map((d) => (
          <div key={d.key} style={{ width: `${(d.value / totalAmount) * 100}%`, backgroundColor: d.color }} className="h-full border-r-2 border-white last:border-r-0 dark:border-slate-800" />
        ))}
      </div>

      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700/60">
        {statuses.map((d) => (
          <li key={d.key} className={`flex items-center justify-between gap-3 py-2.5 ${d.count === 0 ? 'opacity-40' : ''}`}>
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.name}</span>
              <span className="text-sm font-normal text-slate-400">· {d.count}</span>
            </span>
            <span className="shrink-0 text-base font-black tabular-nums text-slate-900 dark:text-white">{formatCurrency(d.value)}</span>
          </li>
        ))}
      </ul>

      {next.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{pt ? 'Próximas' : 'Next up'}</p>
          {next.map((b) => {
            const late = dayOnly(b.dueDate) < today;
            return (
              <button
                key={`${b.id}-${b.dueDate}`}
                onClick={() => navigate('/bills?status=pending')}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{b.name}</span>
                  <span className={`text-xs ${late ? 'font-semibold text-rose-500' : 'text-slate-400'}`}>
                    {dayOnly(b.dueDate).slice(8, 10)}/{dayOnly(b.dueDate).slice(5, 7)} · {dueLabel(b.dueDate)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{formatCurrency(Number(b.amount || 0))}</span>
              </button>
            );
          })}
        </div>
      )}
    </HomeCard>
  );
}
