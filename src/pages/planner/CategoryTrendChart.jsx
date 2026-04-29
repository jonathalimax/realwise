import { useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip';
import { useSettings } from '@/contexts/SettingsContext';

// Top N categories to show in the trend chart
const MAX_CATEGORIES = 6;

// Fixed color palette for consistent category colors
const CAT_COLORS = [
  '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#EF4444',
];

export default function CategoryTrendChart({ allTx, last6Months, getMonthKey }) {
  const { darkMode, formatCurrency } = useSettings();
  const textColor = darkMode ? '#e5e7eb' : '#374151';
  const [hiddenCats, setHiddenCats] = useState(() => new Set());

  const toggleCat = (cat) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Build { month: { category: total } } for the 6 months
  const grouped = {};
  for (const month of last6Months) {
    grouped[month] = {};
  }
  for (const tx of allTx) {
    if (tx.type !== 'expense' || tx.ignored) continue;
    const key = getMonthKey
      ? getMonthKey(tx.date, tx.bankId, tx.paymentMethod)
      : `${new Date(tx.date).getFullYear()}-${String(new Date(tx.date).getMonth() + 1).padStart(2, '0')}`;
    if (!grouped[key]) continue;
    grouped[key][tx.category] = (grouped[key][tx.category] || 0) + tx.amount;
  }

  // Find top categories by total across all 6 months
  const catTotals = {};
  for (const month of last6Months) {
    for (const [cat, val] of Object.entries(grouped[month])) {
      catTotals[cat] = (catTotals[cat] || 0) + val;
    }
  }
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CATEGORIES)
    .map(([cat]) => cat);

  if (topCats.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Sem dados de gastos nos últimos 6 meses
      </div>
    );
  }

  const allSeries = topCats.map((cat, i) => ({
    label: cat,
    data: last6Months.map(month => grouped[month][cat] || 0),
    color: CAT_COLORS[i % CAT_COLORS.length],
    valueFormatter: v => formatCurrency(v),
  }));
  const series = allSeries.filter(s => !hiddenCats.has(s.label));

  // Short month labels (e.g. "Mar/25")
  const xLabels = last6Months.map(m => {
    const [y, mo] = m.split('-');
    const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  });

  const sxDark = {
    '& .MuiChartsAxis-tickLabel': { fill: textColor },
    '& .MuiChartsAxis-line': { stroke: textColor },
    '& .MuiChartsAxis-tick': { stroke: textColor },
  };

  return (
    <div>
      {/* Legend - click to toggle series */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-2">
        {allSeries.map(s => {
          const hidden = hiddenCats.has(s.label);
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => toggleCat(s.label)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-opacity hover:bg-gray-100 dark:hover:bg-gray-700 ${
                hidden ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: hidden ? 'transparent' : s.color, border: `1.5px solid ${s.color}` }}
              />
              <span className={`text-xs ${hidden ? 'line-through text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-80 w-full overflow-visible">
        <BarChart
          xAxis={[{
            scaleType: 'band',
            data: xLabels,
            tickLabelStyle: { fontSize: 11, fill: textColor },
          }]}
          yAxis={[{
            tickLabelStyle: { fontSize: 11, fill: textColor },
            valueFormatter: v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
          }]}
          series={series}
          slotProps={{ legend: { hidden: true } }}
          sx={sxDark}
          margin={{ top: 10, right: 10, bottom: 30, left: 55 }}
        >
          <ChartsTooltip trigger="axis" />
        </BarChart>
      </div>
    </div>
  );
}
