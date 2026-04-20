import { NumericFormat } from 'react-number-format';
import { BarChart } from '@mui/x-charts/BarChart';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL } from './usePlannerState';
import CurrencyInput from '@/components/ui/CurrencyInput';
import PercentInput from '@/components/ui/PercentInput';

const YEARS_LABELS = ['5a', '10a', '15a', '20a', '25a', '30a'];
const SUMMARY_YEARS = [5, 10, 20, 30];

function FieldInput({ label, value, onChange, type = 'number', suffix, decimalScale = 2, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
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
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
        />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const formatCompact = (value) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
};

export default function PatrimonioTab({ state, update, totalPatrimonio }) {
  const { darkMode } = useSettings();
  const textColor = darkMode ? '#e5e7eb' : '#374151';

  if (!totalPatrimonio || totalPatrimonio.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <p className="text-gray-500 dark:text-gray-400">Configure o planejamento para ver projeções de patrimônio.</p>
      </div>
    );
  }

  const summaryItems = SUMMARY_YEARS.map(y => totalPatrimonio.find(p => p.years === y)).filter(Boolean);

  const series = [
    {
      label: 'Invest. Livres',
      data: totalPatrimonio.map(p => Math.round(p.livresFV)),
      color: '#10B981',
      stack: 'total',
      valueFormatter: v => formatBRL.format(v),
    },
    {
      label: 'Reservas',
      data: totalPatrimonio.map(p => Math.round(p.reservasFV - p.apoFV)),
      color: '#3B82F6',
      stack: 'total',
      valueFormatter: v => formatBRL.format(v),
    },
    {
      label: 'Aposentadoria',
      data: totalPatrimonio.map(p => Math.round(p.apoFV)),
      color: '#8B5CF6',
      stack: 'total',
      valueFormatter: v => formatBRL.format(v),
    },
    {
      label: 'Imóvel',
      data: totalPatrimonio.map(p => Math.round(p.imovelFV)),
      color: '#F59E0B',
      stack: 'total',
      valueFormatter: v => formatBRL.format(v),
    },
    {
      label: 'Carro',
      data: totalPatrimonio.map(p => Math.round(p.carroFV)),
      color: '#EF4444',
      stack: 'total',
      valueFormatter: v => formatBRL.format(v),
    },
  ];

  const sxDark = {
    '& .MuiChartsAxis-tickLabel': { fill: textColor },
    '& .MuiChartsAxis-line': { stroke: textColor },
    '& .MuiChartsAxis-tick': { stroke: textColor },
  };

  return (
    <div className="space-y-4">
      {/* Input card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Parâmetros do Patrimônio
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FieldInput
            label="Valor atual do carro (R$)"
            value={state.carCurrentValue}
            onChange={v => update('carCurrentValue', v)}
            type="currency"
            hint="Deprecia ~15% ao ano"
          />
          <FieldInput
            label="Valorização imóvel (%/mês)"
            value={state.propertyAppreciationPct}
            onChange={v => update('propertyAppreciationPct', v)}
            type="percent"
            decimalScale={2}
            hint="Ex: 0,5% a.m. ≈ 6% a.a."
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryItems.map(p => (
          <div key={p.years} className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl p-3 border border-violet-100 dark:border-violet-800 text-center">
            <p className="text-xs font-semibold text-violet-500 uppercase">{p.years} anos</p>
            <p className="text-base font-bold text-violet-700 dark:text-violet-300 tabular-nums">
              {formatBRL.format(p.total)}
            </p>
            <p className="text-xs text-violet-400 mt-0.5 tabular-nums">
              +{formatBRL.format(p.imovelFV > 0 ? p.imovelFV : 0)} imóvel
            </p>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Evolução do Patrimônio Projetado
        </h3>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {series.map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="h-72">
          <BarChart
            xAxis={[{
              scaleType: 'band',
              data: YEARS_LABELS,
              tickLabelStyle: { fontSize: 12, fill: textColor },
            }]}
            yAxis={[{
              tickLabelStyle: { fontSize: 12, fill: textColor },
              valueFormatter: formatCompact,
            }]}
            series={series}
            slotProps={{ legend: { hidden: true } }}
            sx={sxDark}
            margin={{ top: 10, right: 20, bottom: 30, left: 60 }}
          />
        </div>
      </div>

      {/* Breakdown table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Detalhamento por categoria</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Categoria</th>
                {SUMMARY_YEARS.map(y => (
                  <th key={y} className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">{y}a</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Invest. Livres', color: 'text-emerald-600 dark:text-emerald-400', get: p => p.livresFV },
                { label: 'Reservas (excl. Apo)', color: 'text-blue-600 dark:text-blue-400', get: p => p.reservasFV - p.apoFV },
                { label: 'Aposentadoria', color: 'text-violet-600 dark:text-violet-400', get: p => p.apoFV },
                { label: 'Imóvel', color: 'text-amber-600 dark:text-amber-400', get: p => p.imovelFV },
                { label: 'Carro', color: 'text-red-600 dark:text-red-400', get: p => p.carroFV },
              ].map((row, i) => (
                <tr key={row.label} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-700/20'}`}>
                  <td className={`px-4 py-2.5 font-medium ${row.color}`}>{row.label}</td>
                  {SUMMARY_YEARS.map(y => {
                    const p = totalPatrimonio.find(x => x.years === y);
                    return (
                      <td key={y} className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {p ? formatBRL.format(row.get(p)) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 font-bold">
                <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                {SUMMARY_YEARS.map(y => {
                  const p = totalPatrimonio.find(x => x.years === y);
                  return (
                    <td key={y} className="px-4 py-3 text-right tabular-nums text-violet-700 dark:text-violet-300">
                      {p ? formatBRL.format(p.total) : '—'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
