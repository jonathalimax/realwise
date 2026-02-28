import { useRef, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useCards } from '../../contexts/CardsContext';
import { BarChart } from '@mui/x-charts/BarChart';

export default function TrendChart({ transactions, selectedMonth, viewMode }) {
  const scrollContainerRef = useRef(null);
  const { formatCurrency, t, language, darkMode } = useSettings();
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

  const hasData = incomeData.some(d => d > 0) || expenseData.some(d => d > 0);

  // Scroll to show current month (index 5) on mobile when chart loads
  useEffect(() => {
    if (scrollContainerRef.current && hasData) {
      const container = scrollContainerRef.current;
      const containerWidth = container.clientWidth;
      const scrollWidth = container.scrollWidth;

      // Only scroll if content is wider than container (mobile/tablet)
      if (scrollWidth > containerWidth) {
        // Current month is at index 5 (6th position out of 12)
        // Calculate scroll position to center the current month
        const barWidth = scrollWidth / 12;
        const currentMonthCenter = barWidth * 5 + barWidth / 2;
        const scrollPosition = currentMonthCenter - containerWidth / 2;

        container.scrollLeft = Math.max(0, scrollPosition);
      }
    }
  }, [hasData]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
        <p className="font-medium">{t('charts.noData')}</p>
        <p className="text-sm mt-1">{t('charts.addTransactionsToSee')}</p>
      </div>
    );
  }

  // Format compact currency for Y-axis (e.g., "1k", "10k")
  const formatCompactValue = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  return (
    <div className="w-full">
      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('balance.income')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('balance.expenses')}</span>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={scrollContainerRef}
        className="h-64 sm:h-72 md:h-80 w-full overflow-x-auto scroll-smooth"
      >
        <div className="min-w-[800px] w-full h-full">
          <BarChart
            xAxis={[{
              scaleType: 'band',
              data: monthLabels,
              tickLabelStyle: {
                fontSize: 12,
                fill: textColor,
              },
            }]}
            yAxis={[{
              tickLabelStyle: {
                fontSize: 12,
                fill: textColor,
              },
              valueFormatter: formatCompactValue,
            }]}
            series={[
              {
                data: incomeData,
                color: '#10B981',
                valueFormatter: (value) => formatCurrency(value),
              },
              {
                data: expenseData,
                color: '#EF4444',
                valueFormatter: (value) => formatCurrency(value),
              },
            ]}
            slotProps={{
              legend: {
                hidden: true,
              },
            }}
            sx={{
              '& .MuiChartsAxis-tickLabel': {
                fill: textColor,
              },
              '& .MuiChartsAxis-line': {
                stroke: textColor,
              },
              '& .MuiChartsAxis-tick': {
                stroke: textColor,
              },
            }}
            margin={{ top: 10, right: 20, bottom: 30, left: 50 }}
          />
        </div>
      </div>
    </div>
  );
}
