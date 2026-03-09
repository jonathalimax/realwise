import { NumericFormat } from 'react-number-format';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from './usePlannerState';

function FieldInput({ label, value, onChange, suffix, decimalScale = 2, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <NumericFormat
        value={value}
        onValueChange={vals => onChange(vals.floatValue ?? 0)}
        decimalSeparator=","
        thousandSeparator="."
        suffix={suffix}
        decimalScale={decimalScale}
        allowNegative={false}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CarSimulatorTab({ state, update, carSimulationRows, currentPlanMonth }) {
  const totalMonths = carSimulationRows.length;
  const totalBoletos = carSimulationRows.reduce((a, r) => a + r.boleto, 0);
  const totalParcelas = carSimulationRows.reduce((a, r) => a + r.parcela, 0);

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Parâmetros do Financiamento
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FieldInput
            label="Parcela mensal (R$)"
            value={state.carMonthlyPayment}
            onChange={v => update('carMonthlyPayment', v)}
          />
          <FieldInput
            label="Parcelas restantes"
            value={state.carRemainingMonths}
            onChange={v => update('carRemainingMonths', Math.max(1, Math.floor(v)))}
            decimalScale={0}
            hint="Quantidade atual de parcelas"
          />
          <FieldInput
            label="Taxa mensal do financ. (%)"
            value={state.carMonthlyRate}
            onChange={v => update('carMonthlyRate', v)}
            suffix=" %"
            hint="Usada para crescer o boleto"
          />
          <FieldInput
            label="Parcelas quitadas por boleto"
            value={state.carLastParcelasCount}
            onChange={v => update('carLastParcelasCount', Math.max(1, Math.floor(v)))}
            decimalScale={0}
            hint="Últimas N parcelas por boleto"
          />
          <FieldInput
            label="Valor inicial do boleto (R$)"
            value={state.carInitialBoleto}
            onChange={v => update('carInitialBoleto', v)}
            hint="Boleto no 1º mês"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-3 border border-violet-100 dark:border-violet-800 text-center">
          <p className="text-xs text-violet-500 font-semibold uppercase">Quitado em</p>
          <p className="text-xl font-bold text-violet-700 dark:text-violet-300">{totalMonths} meses</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total parcelas</p>
          <p className="text-base font-bold text-gray-700 dark:text-gray-300 tabular-nums">{formatBRL.format(totalParcelas)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500 font-semibold uppercase">Total boletos</p>
          <p className="text-base font-bold text-gray-700 dark:text-gray-300 tabular-nums">{formatBRL.format(totalBoletos)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Mês</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Parcela</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Boleto antecip.</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Total</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Restantes</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Boleto</th>
              </tr>
            </thead>
            <tbody>
              {carSimulationRows.map((row, i) => {
                const isCurrent = row.month === currentPlanMonth;
                return (
                <tr
                  key={row.month}
                  className={`border-t border-gray-100 dark:border-gray-700 ${
                    isCurrent
                      ? 'ring-2 ring-inset ring-violet-400 dark:ring-violet-500 bg-violet-50/50 dark:bg-violet-900/10'
                      : i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                    {isCurrent && (
                      <span className="text-xs font-bold text-violet-500 block">→ Mês atual</span>
                    )}
                    Mês {row.month}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                    {formatBRL.format(row.parcela)}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                    row.isBoletoAlto
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-violet-600 dark:text-violet-400'
                  }`}>
                    {formatBRL.format(row.boleto)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                    {formatBRL.format(row.total)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-500 dark:text-gray-400 tabular-nums">
                    {row.remaining}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {row.isBoletoAlto ? (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs">
                        1 parcela
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{row.effectiveParcelas} parcelas</Badge>
                    )}
                  </td>
                </tr>
                );
              })}
              {/* Final row */}
              <tr className="border-t-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20">
                <td colSpan={4} className="px-4 py-3 font-bold text-violet-700 dark:text-violet-300">
                  🎉 QUITADO após {totalMonths} meses
                </td>
                <td className="px-4 py-3 text-center font-bold text-violet-700 dark:text-violet-300">0</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant="default" className="bg-emerald-500 text-white border-0 text-xs">Quitado</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
