import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useBills } from '../../contexts/BillsContext';
import { useSettings } from '../../contexts/SettingsContext';
import { compactMoney } from './format';

const dayOnly = (v) => String(v).slice(0, 10);

/**
 * Shows only when something is late (any month): how many, the oldest one and the total. One tap opens Contas on the
 * overdue filter. Nothing renders when nothing is overdue, so a healthy month has no alert at all.
 */
export default function OverdueBillsCard() {
  const { bills } = useBills();
  const { language, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const pt = language === 'pt';

  const overdue = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
    return bills
      .filter((b) => b.status !== 'paid' && !b.deletedAt && dayOnly(b.dueDate) < today)
      .sort((a, b) => dayOnly(a.dueDate).localeCompare(dayOnly(b.dueDate)));
  }, [bills]);

  if (overdue.length === 0) return null;

  const first = overdue[0];
  const total = overdue.reduce((s, b) => s + Number(b.amount || 0), 0);
  const when = new Date(first.dueDate).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
  const more = overdue.length - 1;
  const detail = pt
    ? `${first.name} · venceu ${when}${more > 0 ? ` e mais ${more}` : ''}`
    : `${first.name} · due ${when}${more > 0 ? ` and ${more} more` : ''}`;
  const title = pt
    ? `${overdue.length} ${overdue.length === 1 ? 'conta atrasada' : 'contas atrasadas'}`
    : `${overdue.length} overdue ${overdue.length === 1 ? 'bill' : 'bills'}`;

  return (
    <button
      onClick={() => navigate('/bills?status=overdue')}
      className="flex w-full items-center gap-3 rounded-3xl border border-rose-300/60 bg-rose-50 p-4 text-left transition-colors hover:bg-rose-100/70 dark:border-rose-500/30 dark:bg-rose-950/30 dark:hover:bg-rose-950/50"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 dark:bg-rose-500/15">
        <ExclamationCircleIcon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold text-slate-900 dark:text-white">{title}</span>
        <span className="block truncate text-sm text-slate-500 dark:text-slate-400">{detail}</span>
      </span>
      <span className="shrink-0 text-xl font-black tabular-nums text-slate-900 dark:text-white">{compactMoney(formatCurrency, total, pt)}</span>
    </button>
  );
}
