import { useMemo } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { ArrowDownLeftIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';
import { compactMoney, trimCents } from './format';

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
  const today = new Date();
  const isCurrentMonth = selectedMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  // While the month is still running, last month is only counted up to the same day, so day 1 is not compared with a full month.
  const before = useMemo(
    () => totalsOf(isCurrentMonth ? (previousTransactions ?? []).filter((t) => new Date(t.date).getDate() <= today.getDate()) : (previousTransactions ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previousTransactions, isCurrentMonth],
  );
  const justStarted = isCurrentMonth && today.getDate() <= 10 && now.income === 0;
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

  const headline = justStarted
    ? (pt ? `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} está começando` : `${monthName} is just starting`)
    : positive
      ? (pt ? 'Você está no azul' : 'You are in the black')
      : (pt ? 'Atenção ao seu mês' : 'Watch your month');
  const money = (v) => formatCurrency(Math.abs(v)).replace(/,00(?=\D*$)/, '');

  return (
    <section className="rw-hero flex flex-col gap-4 px-5 pb-5 pt-6" aria-label={pt ? 'Seu mês' : 'Your month'}>
      <div className="flex flex-col gap-2">
        <span className="rw-eyebrow text-emerald-300">{pt ? 'SEU MÊS EM RESUMO' : 'YOUR MONTH AT A GLANCE'}</span>
        <h2 className="text-[32px] font-extrabold leading-[34px] tracking-tight">{headline}</h2>
      </div>
      <div className="flex flex-col">
        <span className="rw-num whitespace-nowrap text-[clamp(1.5rem,8.5vw,3rem)] font-extrabold leading-tight">{positive ? '' : '\u2212\u00A0'}{money(balance)}</span>
        <span className="text-[15px] text-emerald-200">
          {justStarted
            ? (pt ? `ainda sem entradas em ${monthName}` : `no income yet in ${monthName}`)
            : positive
            ? (pt ? `sobram até o fim de ${monthName}` : `left until the end of ${monthName}`)
            : (pt ? `a mais do que entrou em ${monthName}` : `more than came in during ${monthName}`)}
        </span>
      </div>
      {sentence && <p className="text-[15px] leading-snug text-emerald-50">{sentence}</p>}
      {carryoverSaldo !== 0 && (
        <p className="text-sm text-emerald-200/80">
          {pt ? 'inclui saldo anterior de' : 'includes previous balance of'} {compactMoney(formatCurrency, Math.abs(carryoverSaldo), pt)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onIncomeClick} className="flex min-h-[72px] min-w-0 flex-col items-start gap-1 rounded-2xl bg-black/25 p-3 text-left active:bg-black/40">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
            <ArrowDownLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
            {pt ? 'Entrou' : 'In'}
          </span>
          <span className="rw-num whitespace-nowrap text-[clamp(0.875rem,4.4vw,1.25rem)] font-extrabold leading-tight text-emerald-200">
            {trimCents(formatCurrency(now.income))}
          </span>
        </button>
        <button type="button" onClick={onExpensesClick} className="flex min-h-[72px] min-w-0 flex-col items-start gap-1 rounded-2xl bg-black/25 p-3 text-left active:bg-black/40">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-rose-300">
            <ArrowUpRightIcon className="h-4 w-4 shrink-0" aria-hidden />
            {pt ? 'Saiu' : 'Out'}
          </span>
          <span className="rw-num whitespace-nowrap text-[clamp(0.875rem,4.4vw,1.25rem)] font-extrabold leading-tight text-rose-200">
            {trimCents(formatCurrency(now.expense))}
          </span>
        </button>
      </div>
    </section>
  );
}
