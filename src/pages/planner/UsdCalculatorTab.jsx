import { useMemo } from 'react';
import { NumericFormat } from 'react-number-format';
import { formatBRL } from './usePlannerState';

function countWeekdays(year, month) {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function FieldInput({ label, value, onChange, suffix, decimalScale = 2 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <NumericFormat
        value={value}
        onValueChange={vals => onChange(vals.floatValue ?? 0)}
        decimalSeparator=","
        thousandSeparator={suffix ? '' : '.'}
        suffix={suffix}
        decimalScale={decimalScale}
        allowNegative={false}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
      />
    </div>
  );
}

export default function UsdCalculatorTab({ state, update }) {
  const { hourlyRate, hoursPerDay, usdToBrl, platformFeePct } = state;

  const rows = useMemo(() => {
    const result = [];
    for (const year of [2025, 2026]) {
      for (let month = 1; month <= 12; month++) {
        const bDays = countWeekdays(year, month);
        const grossUSD = hourlyRate * hoursPerDay * bDays;
        const netUSD = grossUSD * (1 - platformFeePct / 100);
        const netBRL = netUSD * usdToBrl;
        result.push({
          year,
          month,
          label: `${MONTH_NAMES_PT[month - 1]}/${year}`,
          bDays,
          grossUSD,
          netUSD,
          netBRL,
        });
      }
    }
    return result;
  }, [hourlyRate, hoursPerDay, usdToBrl, platformFeePct]);

  const now = new Date();
  const formatUSD = v =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Parâmetros
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FieldInput
            label="Taxa horária (USD)"
            value={hourlyRate}
            onChange={v => update('hourlyRate', v)}
          />
          <FieldInput
            label="Horas/dia"
            value={hoursPerDay}
            onChange={v => update('hoursPerDay', v)}
            decimalScale={0}
          />
          <FieldInput
            label="USD → BRL"
            value={usdToBrl}
            onChange={v => update('usdToBrl', v)}
          />
          <FieldInput
            label="Taxa plataforma (%)"
            value={platformFeePct}
            onChange={v => update('platformFeePct', v)}
            suffix=" %"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Mês</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">Dias úteis (seg–sex)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Bruto (USD)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Líquido (USD)</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Líquido (BRL)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isCurrentCalendarMonth = row.year === now.getFullYear() && row.month === now.getMonth() + 1;
                return (
                <tr
                  key={row.label}
                  className={`border-t border-gray-100 dark:border-gray-700 ${
                    isCurrentCalendarMonth
                      ? 'ring-2 ring-inset ring-violet-400 dark:ring-violet-500 bg-violet-50/50 dark:bg-violet-900/10'
                      : i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'
                  } ${row.month === 1 ? 'border-t-2 border-violet-200 dark:border-violet-800' : ''}`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                    {isCurrentCalendarMonth && (
                      <span className="text-xs font-bold text-violet-500 block">→ Mês atual</span>
                    )}
                    {row.label}
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400 tabular-nums">
                    {row.bDays}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                    {formatUSD(row.grossUSD)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
                    {formatUSD(row.netUSD)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-violet-600 dark:text-violet-400 tabular-nums font-bold">
                    {formatBRL.format(row.netBRL)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
