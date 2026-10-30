import { useMemo } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import HomeCard from './HomeCard';
import { compactMoney } from './format';

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

/**
 * The month at a glance: the balance as one big number, a single plain sentence comparing spending with last month,
 * then what came in and what went out.
 */
export default function HomeSummaryCard({ transactions, previousTransactions, carryoverSaldo = 0, selectedMonth, onIncomeClick, onExpensesClick }) {
  const { language, formatCurrency } = useSettings();
  const pt = language === 'pt';
  const locale = pt ? 'pt-BR' : 'en-US';

  const now = useMemo(() => totalsOf(transactions), [transactions]);
  const before = useMemo(() => totalsOf(previousTransactions ?? []), [previousTransactions]);
  const balance = now.income - now.expense + carryoverSaldo;
  const positive = balance >= 0;

  const [y, m] = selectedMonth.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long' });
  const prevName = new Date(y, m - 2, 1).toLocaleDateString(locale, { month: 'long' });

  const pct = before.expense > 0 ? Math.round(((now.expense - before.expense) / before.expense) * 100) : null;
  let sentence = null;
  if (pct !== null && pct !== 0) {
    const less = pct < 0;
    sentence = pt
      ? `Você gastou ${Math.abs(pct)}% ${less ? 'menos' : 'mais'} que em ${prevName}.`
      : `You spent ${Math.abs(pct)}% ${less ? 'less' : 'more'} than in ${prevName}.`;
  }

  return (
    <HomeCard>
      <p className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {pt ? `Saldo de ${monthName}` : `${monthName} balance`}
      </p>
      <p className={`mt-1 text-5xl font-black tabular-nums tracking-tight ${positive ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
        {positive ? '' : '-'}{formatCurrency(Math.abs(balance)).replace(/,00(?=\D*$)/, '')}
      </p>
      {sentence && <p className="mt-2 text-lg leading-snug text-slate-500 dark:text-slate-400">{sentence}</p>}
      {carryoverSaldo !== 0 && (
        <p className="mt-1 text-sm text-slate-400">
          {pt ? 'inclui saldo anterior de' : 'includes previous balance of'} {compactMoney(formatCurrency, Math.abs(carryoverSaldo), pt)}
        </p>
      )}

      <div className="mt-4 flex gap-10 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
        <button onClick={onIncomeClick} className="text-left">
          <p className="text-base text-slate-500 dark:text-slate-400">{pt ? 'Entrou' : 'In'}</p>
          <p className="text-xl font-bold tabular-nums text-emerald-500 dark:text-emerald-400">+{compactMoney(formatCurrency, now.income, pt)}</p>
        </button>
        <button onClick={onExpensesClick} className="text-left">
          <p className="text-base text-slate-500 dark:text-slate-400">{pt ? 'Saiu' : 'Out'}</p>
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{compactMoney(formatCurrency, now.expense, pt)}</p>
        </button>
      </div>
    </HomeCard>
  );
}
