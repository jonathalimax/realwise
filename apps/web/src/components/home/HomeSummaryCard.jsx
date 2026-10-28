import { useMemo } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/solid';
import { useSettings } from '../../contexts/SettingsContext';
import { useInvestments } from '../../contexts/InvestmentContext';
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
 * The month at a glance: balance, income, expenses (with the change from last month) and how much of the income
 * was spent. Elio's insights sit inside the same card because they are written from these same numbers.
 */
export default function HomeSummaryCard({ transactions, previousTransactions, carryoverSaldo = 0, selectedMonth, showInvestments, onIncomeClick, onExpensesClick, onInvestmentsClick }) {
  const { language, formatCurrency } = useSettings();
  const { investments, getTotalCurrentValue } = useInvestments();
  const pt = language === 'pt';

  const now = useMemo(() => totalsOf(transactions), [transactions]);
  const before = useMemo(() => totalsOf(previousTransactions ?? []), [previousTransactions]);
  const balance = now.income - now.expense + carryoverSaldo;
  const positive = balance >= 0;
  const spentPct = now.income > 0 ? (now.expense / now.income) * 100 : 0;
  const portfolio = showInvestments && investments.length > 0 ? getTotalCurrentValue() : 0;

  const [y, m] = selectedMonth.split('-').map(Number);
  const rawMonth = new Date(y, m - 1, 1).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' });
  const monthName = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  const prevName = new Date(y, m - 2, 1).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { month: 'short' }).replace('.', '');
  const barColor = spentPct > 100 ? '#F43F5E' : spentPct >= 85 ? '#F59E0B' : '#10B981';

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

      {now.income > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{spentPct > 100 ? (pt ? 'Você gastou mais do que recebeu' : 'You spent more than you earned') : pt ? 'Despesas sobre a receita' : 'Expenses vs income'}</span>
            <strong className="tabular-nums" style={{ color: barColor }}>{Math.round(spentPct)}%</strong>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, spentPct)}%`, backgroundColor: barColor }} />
          </div>
          {before.expense > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              {pt ? `Em ${prevName} foram` : `In ${prevName} it was`} {formatCurrency(before.expense)} {pt ? 'em despesas.' : 'in expenses.'}
            </p>
          )}
        </div>
      )}

      {portfolio > 0 && (
        <button onClick={onInvestmentsClick} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-blue-50 px-3 py-2 text-left hover:bg-blue-100 dark:bg-blue-900/15 dark:hover:bg-blue-900/25">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{pt ? 'Patrimônio' : 'Net worth'}</span>
          <span className="text-sm font-black tabular-nums text-blue-600 dark:text-blue-300">{formatCurrency(portfolio)}</span>
        </button>
      )}

      <div className="mt-4">
        <InsightsCard selectedMonth={selectedMonth} embedded />
      </div>
    </HomeCard>
  );
}
