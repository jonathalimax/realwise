import { NumericFormat } from 'react-number-format';
import { formatBRL } from './usePlannerState';
import CurrencyInput from '@/components/ui/CurrencyInput';
import PercentInput from '@/components/ui/PercentInput';

function FieldInput({ label, value, onChange, type = 'number', suffix, decimalScale = 2, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--rw-ink)] mb-1">{label}</label>
      {type === 'currency' ? (
        <CurrencyInput value={value} onChange={onChange} className="text-sm py-2 px-3" />
      ) : type === 'percent' ? (
        <PercentInput value={value} onChange={onChange} decimalScale={decimalScale} className="text-sm" />
      ) : (
        <NumericFormat
          value={value}
          onValueChange={vals => onChange(vals.floatValue ?? 0)}
          decimalSeparator=","
          thousandSeparator="."
          suffix={suffix}
          decimalScale={decimalScale}
          allowNegative={false}
          className="w-full px-3 py-2 rounded-xl border border-[var(--rw-border)] bg-[var(--rw-raised)] text-[var(--rw-ink)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
        />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div className="w-full bg-[var(--rw-track)] rounded-full h-2">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function computeMortgage(financedAmount, annualRatePct, termYears) {
  const n = termYears * 12;
  // Convert nominal annual rate to effective monthly (Brazilian standard)
  const r = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;

  // PRICE — fixed installment
  const pricePMT = r > 0 ? financedAmount * r / (1 - Math.pow(1 + r, -n)) : financedAmount / n;
  const priceTotal = pricePMT * n;
  const priceInterest = priceTotal - financedAmount;

  // SAC — constant amortization, decreasing installment
  const sacAmort = financedAmount / n;
  const sacFirst = sacAmort + financedAmount * r;
  const sacLast = sacAmort + sacAmort * r;
  // Total SAC interest = r × Σ(remaining_k) = r × n × PV - r × sacAmort × n(n-1)/2
  const sacInterest = r * n * financedAmount - r * sacAmort * n * (n - 1) / 2;
  const sacTotal = financedAmount + sacInterest;

  return { r, n, pricePMT, priceTotal, priceInterest, sacFirst, sacLast, sacTotal, sacInterest };
}

export default function HouseSimulatorTab({ state, update, houseSimulationRows, selectedMonthOffset, isPhase2ForSelectedMonth }) {
  const { rows, downPaymentTarget } = houseSimulationRows;
  const lastRow = rows[rows.length - 1];

  const financedAmount = Math.max(0, state.propertyPrice - downPaymentTarget);
  const mortgage = computeMortgage(financedAmount, state.mortgageAnnualRate, state.mortgageTermYears);

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          Parâmetros do Imóvel
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FieldInput
            label="Valor do imóvel (R$)"
            value={state.propertyPrice}
            onChange={v => update('propertyPrice', v)}
            type="currency"
          />
          <FieldInput
            label="Entrada (%)"
            value={state.downPaymentPercent}
            onChange={v => update('downPaymentPercent', Math.min(100, Math.max(1, v)))}
            type="percent"
            decimalScale={0}
            hint={`Meta: ${formatBRL.format(downPaymentTarget)}`}
          />
          <FieldInput
            label="CDB mensal (%)"
            value={state.cdbMonthlyRate}
            onChange={v => update('cdbMonthlyRate', v)}
            type="percent"
            hint="Rendimento CDB/mês sobre saldo"
          />
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2 text-xs text-violet-600 dark:text-violet-400">
            💡 Aporte mensal definido na aba <strong>Investimentos</strong> (linha "Meta Entrada Casa")
          </div>
        </div>
      </div>

      {/* Phase contribution callout */}
      {(() => {
        const casaRow = state.savingsRows?.find(r => r.id === 'casa');
        if (!casaRow) return null;
        const activeContribution = isPhase2ForSelectedMonth ? casaRow.phase2 : casaRow.phase1;
        const phase = isPhase2ForSelectedMonth ? 2 : 1;
        return (
          <div className={`rounded-xl p-3 border text-xs font-bold ${
            isPhase2ForSelectedMonth
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400'
          }`}>
            Contribuição ativa (Fase {phase}): {formatBRL.format(activeContribution)}/mês
            {' '}— Mês {selectedMonthOffset} do plano
          </div>
        );
      })()}

      {/* Target summary */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-[var(--rw-ink)]">Meta de entrada</span>
          <span className="text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">
            {formatBRL.format(downPaymentTarget)}
          </span>
        </div>
        {lastRow && (
          <>
            <ProgressBar pct={lastRow.pct} />
            <p className="text-xs text-gray-400 mt-1">
              Projeção: atingir em ~{lastRow.month} meses ({(lastRow.month / 12).toFixed(1)} anos)
            </p>
          </>
        )}
      </div>

      {/* Milestone table */}
      <div className="bg-[var(--rw-surface)] rounded-2xl shadow-sm border border-[var(--rw-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--rw-border)]">
          <h3 className="text-sm font-bold text-[var(--rw-ink)]">Evolução mensal</h3>
          <p className="text-xs text-gray-400 mt-0.5">Fase 1 = durante quitação do carro · Fase 2 = após quitação</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--rw-raised)]">
                <th className="px-4 py-3 text-left font-bold text-[var(--rw-muted)]">Mês</th>
                <th className="px-4 py-3 text-center font-bold text-[var(--rw-muted)]">Fase</th>
                <th className="px-4 py-3 text-right font-bold text-[var(--rw-muted)]">Aporte</th>
                <th className="px-4 py-3 text-right font-bold text-[var(--rw-muted)]">Rend. CDB</th>
                <th className="px-4 py-3 text-right font-bold text-[var(--rw-muted)]">Saldo</th>
                <th className="px-4 py-3 text-center font-bold text-[var(--rw-muted)]">% Meta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isCurrent = row.month === selectedMonthOffset;
                return (
                <tr
                  key={`${row.month}-${i}`}
                  className={`border-t border-[var(--rw-border)] ${
                    isCurrent
                      ? 'ring-2 ring-inset ring-violet-400 dark:ring-violet-500 bg-violet-50/50 dark:bg-violet-900/10'
                      : row.isPhaseChange
                        ? 'border-t-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                        : i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-[var(--rw-ink)]">
                    {isCurrent && (
                      <span className="text-xs font-bold text-violet-500 block">→ Mês selecionado</span>
                    )}
                    {row.isPhaseChange && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 block">🚀 Carro quitado!</span>
                    )}
                    Mês {row.month}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      row.phase === 1
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      Fase {row.phase}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--rw-muted)]">
                    {formatBRL.format(row.contribution)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{formatBRL.format(row.cdbYield)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-[var(--rw-ink)]">
                    {formatBRL.format(row.balance)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs font-bold tabular-nums ${
                        row.pct >= 100
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : row.pct >= 50
                            ? 'text-violet-600 dark:text-violet-400'
                            : 'text-[var(--rw-muted)]'
                      }`}>
                        {row.pct.toFixed(1)}%
                      </span>
                      <div className="w-16 bg-[var(--rw-track)] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-violet-500"
                          style={{ width: `${Math.min(row.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mortgage simulation */}
      <div className="bg-[var(--rw-surface)] rounded-2xl p-4 shadow-sm border border-[var(--rw-border)]">
        <h3 className="text-sm font-bold text-[var(--rw-muted)] uppercase tracking-wide mb-3">
          Simulação do Financiamento (após entrada)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <FieldInput
            label="Taxa anual (%)"
            value={state.mortgageAnnualRate}
            onChange={v => update('mortgageAnnualRate', Math.min(30, Math.max(1, v)))}
            type="percent"
            hint={`≈ ${(mortgage.r * 100).toFixed(3)}% a.m.`}
          />
          <FieldInput
            label="Prazo (anos)"
            value={state.mortgageTermYears}
            onChange={v => update('mortgageTermYears', Math.min(35, Math.max(1, Math.floor(v))))}
            decimalScale={0}
            hint={`${state.mortgageTermYears * 12} parcelas`}
          />
          <div className="rounded-xl border border-[var(--rw-border)] bg-[var(--rw-raised)] px-3 py-2 flex flex-col justify-center">
            <p className="text-xs text-[var(--rw-muted)] mb-0.5">Valor financiado</p>
            <p className="text-sm font-bold text-[var(--rw-ink)] tabular-nums">
              {formatBRL.format(financedAmount)}
            </p>
            <p className="text-xs text-gray-400">
              {state.propertyPrice > 0 ? ((financedAmount / state.propertyPrice) * 100).toFixed(0) : 0}% do imóvel
            </p>
          </div>
        </div>

        {/* PRICE vs SAC comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* PRICE */}
          <div className="rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">
              Tabela PRICE — parcela fixa
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--rw-muted)]">Parcela mensal</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {formatBRL.format(mortgage.pricePMT)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--rw-muted)]">Total pago</span>
                <span className="text-xs font-bold text-[var(--rw-ink)] tabular-nums">
                  {formatBRL.format(mortgage.priceTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--rw-muted)]">Total de juros</span>
                <span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">
                  +{formatBRL.format(mortgage.priceInterest)}
                </span>
              </div>
            </div>
          </div>

          {/* SAC */}
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2">
              SAC — parcela decrescente
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--rw-muted)]">1ª parcela</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatBRL.format(mortgage.sacFirst)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--rw-muted)]">Última parcela</span>
                <span className="text-xs font-bold text-[var(--rw-ink)] tabular-nums">
                  {formatBRL.format(mortgage.sacLast)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--rw-muted)]">Total de juros</span>
                <span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">
                  +{formatBRL.format(mortgage.sacInterest)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          SAC paga menos juros no total — PRICE tem parcela inicial menor. Caixa e Bradesco geralmente oferecem ambos.
        </p>
      </div>
    </div>
  );
}
