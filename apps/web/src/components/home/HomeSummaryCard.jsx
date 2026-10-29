import { useMemo } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/solid';
import { useSettings } from '../../contexts/SettingsContext';
import InsightsCard from '../InsightsCard';
import HomeCard from './HomeCard';

const totalsOf = (transactions) => {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.ignored) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
};

/** % change from `before` to `now`; null when there is nothing to compare with. */
const change = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

function Delta({ pct, goodWhenUp, label }) {
  if (pct === null || Math.abs(pct) < 1) return null;
  const up = pct > 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${good ? 'text-emerald-500' : 'text-rose-500'}`} title={label}>
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(Math.round(pct))}%
    </span>
  );
}

/**
 * The month at a glance: balance, income and expenses (with the change from last month). Elio's insights sit
 * inside the same card because they are written from these same numbers.
 */
export default function HomeSummaryCard({ transactions, previousTransactions, carryoverSaldo = 0, selectedMonth, onIncomeClick, onExpensesClick }) {
  const { language, formatCurrency } = useSettings();
  const pt = language === 'pt';

  const now = useMemo(() => totalsOf(transactions), [transactions]);
  const before = useMemo(() => totalsOf(previousTransactions ?? []), [previousTransactions]);
  const balance = now.income - now.expense + carryoverSaldo;
  const positive = balance >= 0;

  const [y, m] = selectedMonth.split('-').map(Number);
  const rawMonth = new Date(y, m - 1, 1).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' });
  const monthName = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  const prevName = new Date(y, m - 2, 1).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { month: 'short' }).replace('.', '');

  return (
    <HomeCard title={pt ? 'Resumo' : 'Summary'} subtitle={monthName}>
      <div className={`rounded-2xl p-4 ${positive ? 'bg-emerald-50 dark:bg-emerald-900/15' : 'bg-rose-50 dark:bg-rose-900/15'}`}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{pt ? 'Saldo do mês' : 'Balance'}</p>
        <p className={`mt-0.5 text-3xl font-black tabular-nums ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {positive ? '' : '-'}{formatCurrency(Math.abs(balance))}
        </p>
        {carryoverSaldo !== 0 && (
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {pt ? 'inclui saldo anterior de' : 'includes previous balance of'} {formatCurrency(carryoverSaldo)}
          </p>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={onIncomeClick} className="rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900/50">
          <p className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {pt ? 'Receitas' : 'Income'}
            <Delta pct={change(now.income, before.income)} goodWhenUp label={`${pt ? 'vs' : 'vs'} ${prevName}`} />
          </p>
          <p className="mt-0.5 text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(now.income)}</p>
        </button>
        <button onClick={onExpensesClick} className="rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900/50">
          <p className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {pt ? 'Despesas' : 'Expenses'}
            <Delta pct={change(now.expense, before.expense)} goodWhenUp={false} label={`${pt ? 'vs' : 'vs'} ${prevName}`} />
          </p>
          <p className="mt-0.5 text-base font-black tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(now.expense)}</p>
        </button>
      </div>

      <div className="mt-4">
        <InsightsCard selectedMonth={selectedMonth} embedded />
      </div>
    </HomeCard>
  );
}
