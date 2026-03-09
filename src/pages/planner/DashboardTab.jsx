import { NumericFormat } from 'react-number-format';
import { formatBRL } from './usePlannerState';

function BRLInput({ value, onChange, label, id }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <NumericFormat
        id={id}
        value={value === 0 ? '' : value}
        onValueChange={vals => onChange(vals.floatValue ?? 0)}
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        allowNegative={false}
        placeholder="R$ 0,00"
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
      />
    </div>
  );
}

function SummaryRow({ label, value, highlight, negative }) {
  return (
    <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-violet-500 mt-2 pt-3' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${
        highlight
          ? 'text-violet-600 dark:text-violet-400 text-base'
          : negative
            ? 'text-red-500 dark:text-red-400'
            : 'text-gray-900 dark:text-white'
      }`}>
        {negative ? '- ' : ''}{formatBRL.format(value)}
      </span>
    </div>
  );
}

export default function DashboardTab({ state, update, simplesValue, despesasPJ, dizimoBase, dizimoValue, liquidezFinal }) {
  return (
    <div className="space-y-4">
      {/* Section A — Renda */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          A — Renda Bruta PJ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BRLInput
            id="rendaBruta"
            label="Faturamento bruto mensal"
            value={state.rendaBruta}
            onChange={v => update('rendaBruta', v)}
          />
          <div>
            <label htmlFor="simplesNacionalPct" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Simples Nacional (%)
            </label>
            <NumericFormat
              id="simplesNacionalPct"
              value={state.simplesNacionalPct}
              onValueChange={vals => update('simplesNacionalPct', Math.min(33, Math.max(6, vals.floatValue ?? 6)))}
              decimalSeparator=","
              suffix=" %"
              decimalScale={2}
              allowNegative={false}
              placeholder="6 %"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Faixa: 6% – 33%</p>
          </div>
        </div>
      </div>

      {/* Section B — Despesas PJ */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          B — Despesas PJ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <BRLInput
            id="planoSaude"
            label="Plano de Saúde"
            value={state.planoSaude}
            onChange={v => update('planoSaude', v)}
          />
          <BRLInput
            id="contabilidade"
            label="Contabilidade"
            value={state.contabilidade}
            onChange={v => update('contabilidade', v)}
          />
          <BRLInput
            id="internet"
            label="Internet"
            value={state.internet}
            onChange={v => update('internet', v)}
          />
        </div>
      </div>

      {/* Section C — Dízimo */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          C — Dízimo
        </h3>
        <div className="max-w-xs">
          <label htmlFor="dizimoPct" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Percentual do dízimo (%)
          </label>
          <NumericFormat
            id="dizimoPct"
            value={state.dizimoPct}
            onValueChange={vals => update('dizimoPct', vals.floatValue ?? 0)}
            decimalSeparator=","
            suffix=" %"
            decimalScale={1}
            allowNegative={false}
            placeholder="10 %"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Base: Renda – Simples – Despesas PJ = {formatBRL.format(dizimoBase)}
          </p>
        </div>
      </div>

      {/* Section D — Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          D — Resumo Financeiro
        </h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <SummaryRow label="Renda Bruta" value={state.rendaBruta} />
          <SummaryRow label={`Simples Nacional (${state.simplesNacionalPct}%)`} value={simplesValue} negative />
          <SummaryRow label="Despesas PJ (saúde + contab. + internet)" value={despesasPJ} negative />
          <SummaryRow label={`Dízimo (${state.dizimoPct}% sobre R$${dizimoBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`} value={dizimoValue} negative />
          <SummaryRow label="Liquidez Final" value={liquidezFinal} highlight />
        </div>
      </div>
    </div>
  );
}
