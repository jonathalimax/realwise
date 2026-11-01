import { formatBRL, countWeekdays } from './usePlannerState';

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function UsdCalculatorTab({ state, selectedMonthIncome, yearIncomeStats }) {
  const { hourlyRate, hoursPerDay, usdToBrl, platformFeePct, selectedPlannerMonth } = state;
  const [selYear, selMonth] = selectedPlannerMonth.split('-').map(Number);

  const formatUSD = v =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-4">
      {/* Selected month hero card */}
      <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-4 shadow-sm border border-violet-200 dark:border-violet-800">
        <p className="text-xs font-bold text-violet-500 dark:text-violet-400 uppercase mb-2">
          Mês selecionado — {MONTH_NAMES_PT[selMonth - 1]}/{selYear} ({selectedMonthIncome.bDays} dias úteis)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-[var(--rw-muted)]">Bruto USD</p>
            <p className="text-base font-bold text-[var(--rw-ink)] tabular-nums">
              {formatUSD(selectedMonthIncome.grossUSD)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--rw-muted)]">Líquido USD</p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatUSD(selectedMonthIncome.netUSD)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--rw-muted)]">Líquido BRL</p>
            <p className="text-base font-bold text-violet-700 dark:text-violet-300 tabular-nums">
              {formatBRL.format(selectedMonthIncome.netBRL)}
            </p>
          </div>
        </div>
      </div>

      {/* Year overview table */}
      <div className="bg-[var(--rw-surface)] rounded-2xl shadow-sm border border-[var(--rw-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--rw-border)]">
          <h3 className="text-sm font-bold text-[var(--rw-ink)]">
            Visão anual — {new Date().getFullYear()}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Amarelo = mínimo · Verde = máximo · Violeta = mês selecionado
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--rw-raised)]">
                <th className="px-4 py-3 text-left font-bold text-[var(--rw-muted)]">Mês</th>
                <th className="px-4 py-3 text-center font-bold text-[var(--rw-muted)]">Dias úteis</th>
                <th className="px-4 py-3 text-right font-bold text-[var(--rw-muted)]">Bruto (USD)</th>
                <th className="px-4 py-3 text-right font-bold text-[var(--rw-muted)]">Líquido (USD)</th>
                <th className="px-4 py-3 text-right font-bold text-[var(--rw-muted)]">Líquido (BRL)</th>
              </tr>
            </thead>
            <tbody>
              {yearIncomeStats.months.map((row, i) => {
                const isMin = row.month === yearIncomeStats.minMonth.month;
                const isMax = row.month === yearIncomeStats.maxMonth.month;
                const isSelected = row.month === selMonth && row.year === selYear;
                const grossUSD = hourlyRate * hoursPerDay * row.bDays;
                const netUSD = grossUSD * (1 - platformFeePct / 100);

                let rowClass = i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20';
                if (isSelected) rowClass = 'ring-2 ring-inset ring-violet-400 dark:ring-violet-500 bg-violet-50/50 dark:bg-violet-900/10';
                else if (isMin) rowClass = 'bg-amber-50 dark:bg-amber-900/10';
                else if (isMax) rowClass = 'bg-emerald-50 dark:bg-emerald-900/10';

                return (
                  <tr key={row.month} className={`border-t border-[var(--rw-border)] ${rowClass}`}>
                    <td className="px-4 py-2.5 font-medium text-[var(--rw-ink)]">
                      {isSelected && <span className="text-xs font-bold text-violet-500 block">→ Selecionado</span>}
                      {isMin && !isSelected && <span className="text-xs font-bold text-amber-500 block">↓ Mínimo</span>}
                      {isMax && !isSelected && <span className="text-xs font-bold text-emerald-500 block">↑ Máximo</span>}
                      {MONTH_NAMES_PT[row.month - 1]}
                    </td>
                    <td className="px-4 py-2.5 text-center text-[var(--rw-muted)] tabular-nums">
                      {row.bDays}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--rw-muted)] tabular-nums">
                      {formatUSD(grossUSD)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
                      {formatUSD(netUSD)}
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
