import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import CtaButton from './CtaButton';
import { billingResource } from '@/lib/api/resources/billing';
import { landingAnalytics } from '../../landingAnalytics';

const INCLUDED = [
  'John, seu assistente de IA, no chat',
  'Importação de extratos e faturas (PDF, foto, CSV, OFX)',
  'Categorização que aprende com você',
  'Transferências entre suas contas fora dos totais',
  'Insights e respostas sobre os seus gastos',
];

const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// The API rounds the discount to a whole number, so "mais de X%" is only claimed when the number is strictly above a
// multiple of ten (31 → "mais de 30%"); exactly 30 stays "Economize 30%". The claim therefore stays true if prices change.
const discountLabel = (percent) =>
  percent >= 21 && percent % 10 !== 0 ? `Mais de ${Math.floor(percent / 10) * 10}% de desconto` : `Economize ${percent}%`;

function PlanCard({ plan, monthlyPlan, highlight, loading, onStart }) {
  const monthlyEquivalent = plan?.interval === 'year' ? plan.amount / 12 : null;
  // What the same 12 months cost paying month by month: shown struck through, only when the annual plan really is cheaper.
  const payingMonthly = plan?.interval === 'year' && monthlyPlan ? monthlyPlan.amount * 12 : null;
  const showComparison = payingMonthly && payingMonthly > plan.amount;
  const isAnnual = plan?.interval === 'year';
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-7 ${
        highlight
          ? 'border-2 border-violet-500 bg-violet-50/60 dark:bg-violet-950/30 shadow-xl shadow-violet-500/10'
          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
      }`}
    >
      {isAnnual && plan?.savingsPercent ? (
        <span className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white">
          {discountLabel(plan.savingsPercent)}
        </span>
      ) : null}
      <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{isAnnual ? 'Anual' : 'Mensal'}</h3>

      <div className="mt-3 min-h-[6rem]">
        {loading ? (
          <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
        ) : plan ? (
          <>
            <p className="text-4xl font-bold tabular-nums">
              {brl(plan.amount)}
              <span className="ml-1 text-base font-medium text-slate-500">/{isAnnual ? 'ano' : 'mês'}</span>
            </p>
            {monthlyEquivalent ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">equivale a {brl(monthlyEquivalent)} por mês</p> : null}
            {showComparison ? (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                <span className="line-through">{brl(payingMonthly)}</span> pagando mês a mês
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-lg font-semibold text-slate-500">Valores ao entrar no app</p>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
        {INCLUDED.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>

      <CtaButton onClick={onStart} tone={highlight ? 'primary' : 'dark'} className="mt-7 w-full">
        Começar teste grátis
      </CtaButton>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">3 dias grátis, sem cartão · você só paga depois do teste</p>
    </div>
  );
}

export default function PricingSection() {
  const [plans, setPlans] = useState(null); // null = loading, [] = unavailable
  useEffect(() => {
    let active = true;
    billingResource
      .listPublicPlans()
      .then((rows) => active && setPlans(Array.isArray(rows) ? rows : []))
      .catch(() => active && setPlans([]));
    return () => {
      active = false;
    };
  }, []);

  const start = () => {
    landingAnalytics.trackCtaClicked('Começar teste grátis', 'pricing');
    sessionStorage.setItem('__rw_show_login', '1');
    window.location.href = '/login';
  };

  const loading = plans === null;
  const monthly = plans?.find((p) => p.interval === 'month') ?? null;
  const annual = plans?.find((p) => p.interval === 'year') ?? null;

  return (
    <section id="preco" data-section="pricing" className="bg-slate-50/70 dark:bg-slate-900/60 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Um plano simples</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Teste 3 dias sem cadastrar cartão e sem pagar nada. Só depois do teste você escolhe um plano e paga. Cancele quando quiser.</p>
        </div>

        {/* No scroll-reveal here on purpose: pricing must always be visible, even if an animation never fires. */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <PlanCard plan={monthly} loading={loading} onStart={start} />
          <PlanCard plan={annual} monthlyPlan={monthly} loading={loading} highlight onStart={start} />
        </div>
      </div>
    </section>
  );
}
