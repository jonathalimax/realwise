import { useMemo } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
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

  const headline = positive
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
        <span className="rw-num text-5xl font-extrabold leading-[50px]">{positive ? '' : '-'}{money(balance)}</span>
        <span className="text-[15px] text-emerald-200">
          {positive
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
      <div className="flex flex-wrap gap-2">
        <button onClick={onIncomeClick} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold tabular-nums text-emerald-50">
          + {compactMoney(formatCurrency, now.income, pt)} {pt ? 'entraram' : 'in'}
        </button>
        <button onClick={onExpensesClick} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold tabular-nums text-emerald-50">
          {compactMoney(formatCurrency, now.expense, pt)} {pt ? 'saíram' : 'out'}
        </button>
      </div>
    </section>
  );
}
