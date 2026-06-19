import { useRef, useEffect, useState, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCards } from '../../contexts/CardsContext';
import {
  ChartContainer,
  BarPlot,
  LinePlot,
  ChartsXAxis,
  ChartsYAxis,
} from '@mui/x-charts';

export default function TrendChart({ transactions, selectedMonth, viewMode, cumulativeByMonth = {} }) {
  const scrollContainerRef = useRef(null);
  const { formatCurrency, t, language, darkMode } = useSettings();
  const [tappedBar, setTappedBar] = useState(null); // { label, income, expense, balance }
  const { getPaymentMonthKey } = useCards();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const textColor = darkMode ? '#e5e7eb' : '#374151';

  // Generate 12 months centered around selected month (5 before + current + 6 after)
  const getMonthsRange = () => {
    const [year, month] = (selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).split('-');
    const centerDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const months = [];

    for (let i = -5; i <= 6; i++) {
      const date = new Date(centerDate);
      date.setMonth(centerDate.getMonth() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString(locale, { month: 'short' });
      months.push({ key, label });
    }

    return months;
  };

  const monthsRange = getMonthsRange();

  // Running balance data for the line series. null beyond last data month (no extrapolation).
  const lastDataMonth = Object.keys(cumulativeByMonth).sort().at(-1) ?? null;
  const balanceData = lastDataMonth
    ? (() => {
        let last = null;
        return monthsRange.map(({ key }) => {
          if (cumulativeByMonth[key] !== undefined) last = cumulativeByMonth[key];
          return key > lastDataMonth ? null : last;
        });
      })()
    : null;

  // Group transactions by month
  const monthlyData = transactions.reduce((acc, trans) => {
    if (trans.ignored) return acc;

    let monthKey;
    if (viewMode === 'purchase') {
      const date = new Date(trans.date);
      monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      if (trans.type === 'income' || trans.investmentId) {
        const date = new Date(trans.date);
        monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        monthKey = getPaymentMonthKey(trans.date, trans.bankId, trans.paymentMethod);
      }
    }

    if (!acc[monthKey]) {
      acc[monthKey] = { income: 0, expense: 0 };
    }

    if (trans.type === 'income') {
      acc[monthKey].income += trans.amount;
    } else {
      acc[monthKey].expense += trans.amount;
    }

    return acc;
  }, {});

  // Create data for the 12 months range
  const monthLabels = monthsRange.map(({ label }) => label);
  const incomeData = monthsRange.map(({ key }) => monthlyData[key]?.income || 0);
  const expenseData = monthsRange.map(({ key }) => monthlyData[key]?.expense || 0);

  const series = [
    {
      type: 'bar',
      data: incomeData,
      color: '#10B981',
      valueFormatter: (value) => formatCurrency(value),
      id: 'income',
    },
    {
      type: 'bar',
      data: expenseData,
      color: '#EF4444',
      valueFormatter: (value) => formatCurrency(value),
      id: 'expenses',
    },
    ...(balanceData ? [{
      type: 'line',
      data: balanceData,
      color: '#6366f1',
      valueFormatter: (value) => value !== null ? formatCurrency(value) : '',
      id: 'balance',
      showMark: false,
    }] : []),
  ];

  const hasData = incomeData.some(d => d > 0) || expenseData.some(d => d > 0);

  // Scroll to show current month (index 5) on mobile when chart loads
  useEffect(() => {
    const doScroll = () => {
      const container = scrollContainerRef.current;
      if (!container || !hasData) return;
      const containerWidth = container.clientWidth;
      const scrollWidth = container.scrollWidth;
      if (scrollWidth > containerWidth) {
        const barWidth = scrollWidth / 12;
        const currentMonthCenter = barWidth * 5 + barWidth / 2;
        container.scrollLeft = Math.max(0, currentMonthCenter - containerWidth / 2);
      }
    };
    // Use rAF to ensure chart is painted before measuring
    const raf = requestAnimationFrame(doScroll);
    return () => cancelAnimationFrame(raf);
  }, [hasData, selectedMonth]);

  if (!hasData) {
    return null;
  }

  // Format compact currency for Y-axis (e.g., "1k", "10k")
  const formatCompactValue = (value) => {
    const abs = Math.abs(value);
    if (abs >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    if (abs >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {language === 'pt' ? 'Panorama Anual' : 'Year Overview'}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {language === 'pt'
              ? 'Role horizontalmente no celular para explorar os meses.'
              : 'Swipe horizontally on mobile to explore the months.'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {tappedBar && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 capitalize self-end">
              {tappedBar.label}
            </span>
          )}
          <div className={`flex gap-2 transition-all duration-200 ${tappedBar ? 'flex-col items-stretch' : 'flex-nowrap items-center'}`}>
            <div className={`inline-flex items-center justify-between gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700 ${tappedBar ? 'ring-emerald-300 dark:ring-emerald-700' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]" />
                <span>{t('balance.income')}</span>
              </div>
              {tappedBar && (
                <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400 ml-2">
                  {formatCurrency(tappedBar.income)}
                </span>
              )}
            </div>
            <div className={`inline-flex items-center justify-between gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700 ${tappedBar ? 'ring-rose-300 dark:ring-rose-700' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]" />
                <span>{t('balance.expenses')}</span>
              </div>
              {tappedBar && (
                <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400 ml-2">
                  {formatCurrency(tappedBar.expense)}
                </span>
              )}
            </div>
            {balanceData && (
              <div className={`inline-flex items-center justify-between gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700 ${tappedBar ? 'ring-indigo-300 dark:ring-indigo-700' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-6 rounded-full bg-indigo-500" />
                  <span>{language === 'pt' ? 'Saldo' : 'Balance'}</span>
                </div>
                {tappedBar && tappedBar.balance !== null && (
                  <span className={`text-xs font-bold tabular-nums ml-2 ${tappedBar.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(tappedBar.balance)}
                  </span>
                )}
              </div>
            )}
          </div>
          {tappedBar && (
            <button
              onClick={() => setTappedBar(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors self-end"
            >
              {language === 'pt' ? 'Limpar' : 'Clear'} ×
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="relative h-72 w-full overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pinch-zoom' }}
      >
        <div className="relative h-full w-[980px] min-w-[980px] pr-4 sm:min-w-0 sm:w-full sm:pr-0">
          <ChartContainer
            series={series}
            xAxis={[{
              scaleType: 'band',
              data: monthLabels,
              id: 'x',
              tickLabelStyle: { fontSize: 12, fill: textColor },
            }]}
            yAxis={[{
              id: 'y',
              tickLabelStyle: { fontSize: 12, fill: textColor },
              valueFormatter: formatCompactValue,
            }]}
            sx={{
              '& .MuiChartsAxis-tickLabel': { fill: textColor },
              '& .MuiChartsAxis-line': { stroke: textColor },
              '& .MuiChartsAxis-tick': { stroke: textColor },
              '& .MuiBarElement-root': { rx: 8, ry: 8 },
              '& .MuiLineElement-root': { strokeWidth: 3 },
              '& svg': { pointerEvents: 'none', userSelect: 'none' },
            }}
            margin={{ top: 20, right: 20, bottom: 36, left: 50 }}
          >
            <BarPlot />
            <LinePlot />
            <ChartsXAxis />
            <ChartsYAxis />
          </ChartContainer>

          {/* Glass pane: captures clicks for bar selection, lets scroll pass through */}
          <div
            className="absolute inset-0 cursor-pointer"
            style={{ touchAction: 'pan-x pinch-zoom' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              // rect.left already reflects the element's viewport position after scroll —
              // do NOT add scrollLeft here (that would double-count the offset).
              const x = e.clientX - rect.left;
              const chartWidth = e.currentTarget.offsetWidth;
              const leftMargin = 50;
              const rightMargin = 20;
              const plotWidth = chartWidth - leftMargin - rightMargin;
              const barWidth = plotWidth / monthLabels.length;
              const dataIndex = Math.floor((x - leftMargin) / barWidth);
              if (dataIndex < 0 || dataIndex >= monthLabels.length) {
                setTappedBar(null);
                return;
              }
              const label = monthLabels[dataIndex];
              const income = incomeData[dataIndex] ?? 0;
              const expense = expenseData[dataIndex] ?? 0;
              const balance = balanceData ? (balanceData[dataIndex] ?? null) : null;
              setTappedBar(prev =>
                prev?.dataIndex === dataIndex ? null : { label, income, expense, balance, dataIndex }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
