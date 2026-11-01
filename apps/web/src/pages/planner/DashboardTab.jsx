import CurrencyInput from '@/components/ui/CurrencyInput';
import { formatBRL } from './usePlannerState';

const MONTH_NAMES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function SummaryRow({ label, value, highlight, negative }) {
  return (
    <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-violet-500 mt-2 pt-3' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-[var(--rw-ink)]' : 'text-[var(--rw-muted)]'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${
        highlight
          ? 'text-violet-600 dark:text-violet-400 text-base'
          : negative
            ? 'text-red-500 dark:text-red-400'
            : 'text-[var(--rw-ink)]'
      }`}>
        {negative ? '- ' : ''}{formatBRL.format(value)}
      </span>
    </div>
  );
}

export default function DashboardTab({
  state,
  update,
  simplesValue,
  despesasPJ,
  liquidezFinal,
  computedRendaBruta,
  selectedMonthIncome,
  yearIncomeStats,
}) {
  const { minMonth, maxMonth } = yearIncomeStats;

  return (
    <div className="space-y-4">
      {/* Section A — Parâmetros USD */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          A — Parâmetros USD
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Taxa horária (USD)', key: 'hourlyRate', decimalScale: 2 },
            { label: 'Horas/dia', key: 'hoursPerDay', decimalScale: 0 },
            { label: 'USD → BRL', key: 'usdToBrl', decimalScale: 6 },
            { label: 'Taxa plataforma (%)', key: 'platformFeePct', decimalScale: 2, suffix: ' %' },
          ].map(({ label, key, decimalScale, suffix }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-[var(--rw-ink)] mb-1">{label}</label>
              <NumericFormat
                value={state[key]}
                onValueChange={vals => update(key, vals.floatValue ?? 0)}
                decimalSeparator=","
                thousandSeparator={suffix ? '' : '.'}
                decimalScale={decimalScale}
                suffix={suffix}
                allowNegative={false}
                className="w-full px-3 py-2 rounded-xl border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section B — Renda Computada */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          B — Renda Bruta PJ (USD calculada)
        </h3>

        {/* Scenario toggle */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[var(--rw-muted)] font-medium">Cenário:</span>
          <button
            onClick={() => update('useMinScenario', true)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              state.useMinScenario
                ? 'bg-amber-500 text-white'
                : 'bg-[var(--rw-raised)] text-[var(--rw-muted)]'
            }`}
          >
            Mínimo
          </button>
          <button
            onClick={() => update('useMinScenario', false)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
              !state.useMinScenario
                ? 'bg-violet-600 text-white'
                : 'bg-[var(--rw-raised)] text-[var(--rw-muted)]'
            }`}
          >
            Real ({selectedMonthIncome.bDays}d)
          </button>
        </div>

        {/* Computed income card */}
        <div className={`rounded-xl p-4 border ${
          state.useMinScenario
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800'
        }`}>
          <p className={`text-xs font-bold uppercase mb-1 ${
            state.useMinScenario ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400'
          }`}>
            {state.useMinScenario ? 'Pior cenário anual (mínimo)' : 'Mês selecionado (real)'}
          </p>
          <p className={`text-2xl font-bold tabular-nums ${
            state.useMinScenario ? 'text-amber-800 dark:text-amber-300' : 'text-violet-800 dark:text-violet-300'
          }`}>
            {formatBRL.format(computedRendaBruta)}
          </p>
        </div>

        {/* Year min/max reference */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase">Mínimo anual</p>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300 tabular-nums mt-0.5">
              {formatBRL.format(minMonth.netBRL)}
            </p>
            <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">
              {MONTH_NAMES_PT[minMonth.month - 1]} — {minMonth.bDays}d úteis
            </p>
          </div>
          <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase">Máximo anual</p>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 tabular-nums mt-0.5">
              {formatBRL.format(maxMonth.netBRL)}
            </p>
            <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-0.5">
              {MONTH_NAMES_PT[maxMonth.month - 1]} — {maxMonth.bDays}d úteis
            </p>
          </div>
        </div>
      </div>

      {/* Section B — Simples Nacional */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          C — Simples Nacional
        </h3>
        <div className="max-w-xs">
          <label htmlFor="simplesNacionalPct" className="block text-sm font-medium text-[var(--rw-ink)] mb-1">
            Alíquota (%)
          </label>
          <NumericFormat
            id="simplesNacionalPct"
            value={state.simplesNacionalPct}
            onValueChange={vals => update('simplesNacionalPct', vals.floatValue ?? 0)}
            decimalSeparator=","
            suffix=" %"
            decimalScale={2}
            allowNegative={false}
            placeholder="6 %"
            className="w-full px-3 py-2 rounded-xl border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Alíquota Simples Nacional</p>
        </div>
      </div>

      {/* Section C — Despesas PJ */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          D — Despesas PJ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'planoSaude', label: 'Plano de Saúde', key: 'planoSaude' },
            { id: 'contabilidade', label: 'Contabilidade', key: 'contabilidade' },
            { id: 'internet', label: 'Internet', key: 'internet' },
          ].map(({ id, label, key }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-[var(--rw-ink)] mb-1">
                {label}
              </label>
              <CurrencyInput
                id={id}
                value={state[key]}
                onChange={v => update(key, v)}
                className="px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section E — Summary */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          F — Resumo Financeiro
        </h3>
        <div className="divide-y divide-[var(--rw-border)]">
          <SummaryRow label="Renda Bruta (computada)" value={computedRendaBruta} />
          <SummaryRow label={`Simples Nacional (${state.simplesNacionalPct}%)`} value={simplesValue} negative />
          <SummaryRow label="Despesas PJ (saúde + contab. + internet)" value={despesasPJ} negative />
          <SummaryRow label="Liquidez Final" value={liquidezFinal} highlight />
        </div>
      </div>
    </div>
  );
}
