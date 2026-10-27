import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowsPointingOutIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../../contexts/SettingsContext';
import { useCards } from '../../contexts/CardsContext';
import { useMonth } from '../../contexts/MonthContext';
import BottomSheet from '../chat/BottomSheet';

const COMPACT_MONTHS = 6;
const INCOME = '#10B981';
const EXPENSE = '#F43F5E';
const BALANCE = '#6366F1';

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const compact = (value) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (abs >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
};

/**
 * One chart used by both the compact card and the full-year sheet: grouped income/expense bars with the running
 * balance as a line. Touch is tap-only (no drag handling), so the page's own vertical scroll is never captured.
 */
function TrendBars({ data, selectedKey, onSelect, height, showAxis, darkMode, formatCurrency, labels }) {
  const grid = darkMode ? '#334155' : '#e2e8f0';
  const text = darkMode ? '#94a3b8' : '#64748b';
  const hasSelection = data.some((d) => d.key === selectedKey);

  return (
    <div role="img" aria-label={labels.aria} style={{ height, touchAction: 'pan-y' }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: showAxis ? 0 : 8 }}
          barGap={3}
          barCategoryGap="22%"
          onClick={(state) => {
            const i = Number(state?.activeTooltipIndex);
            if (Number.isInteger(i) && data[i]) onSelect(data[i].key);
          }}
        >
          <defs>
            <linearGradient id="trendIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor={INCOME} />
            </linearGradient>
            <linearGradient id="trendExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor={EXPENSE} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 4" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: text }} interval={0} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: text }}
            tickFormatter={compact}
            width={showAxis ? 38 : 0}
            hide={!showAxis}
          />
          {/* The balance line has its own hidden scale, so it never flattens the bars (exact values are in the card and list). */}
          <YAxis yAxisId="balance" orientation="right" hide domain={['dataMin', 'dataMax']} padding={{ top: 12, bottom: 12 }} />
          {/* Tooltip is only here to track the tapped month and draw the highlight band; the numbers show in the card. */}
          <Tooltip content={() => null} cursor={{ fill: darkMode ? 'rgba(148,163,184,0.12)' : 'rgba(99,102,241,0.08)', radius: 8 }} />
          <Bar dataKey="income" name={labels.income} fill="url(#trendIncome)" radius={[6, 6, 0, 0]} maxBarSize={showAxis ? 14 : 20} isAnimationActive animationDuration={600}>
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={!hasSelection || d.key === selectedKey ? 1 : 0.45} />
            ))}
          </Bar>
          <Bar dataKey="expense" name={labels.expense} fill="url(#trendExpense)" radius={[6, 6, 0, 0]} maxBarSize={showAxis ? 14 : 20} isAnimationActive animationDuration={600}>
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={!hasSelection || d.key === selectedKey ? 1 : 0.45} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="balance"
            yAxisId="balance"
            name={labels.balance}
            stroke={BALANCE}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <span className="sr-only">{data.map((d) => `${d.label}: ${formatCurrency(d.income)} / ${formatCurrency(d.expense)}`).join('; ')}</span>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-white/70 px-2 py-1.5 ring-1 ring-slate-200/70 dark:bg-slate-800/70 dark:ring-slate-700">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`whitespace-nowrap text-[12.5px] font-bold tracking-tight tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

export default function TrendChart({ transactions, selectedMonth, viewMode, cumulativeByMonth = {}, rollover = true }) {
  const { formatCurrency, language, darkMode } = useSettings();
  const { getPaymentMonthKey } = useCards();
  const { setSelectedMonth } = useMonth();
  const pt = language === 'pt';
  const locale = pt ? 'pt-BR' : 'en-US';
  const [activeKey, setActiveKey] = useState(null); // month tapped on the compact chart
  const [open, setOpen] = useState(false);
  const [sheetYear, setSheetYear] = useState(null);
  const [sheetKey, setSheetKey] = useState(null);

  const baseMonth = selectedMonth || monthKeyOf(new Date());

  // Income/expense per month key, grouped the same way as before (purchase month vs. card payment month).
  const monthlyData = useMemo(
    () =>
      transactions.reduce((acc, trans) => {
        if (trans.ignored) return acc;
        let key;
        if (viewMode === 'purchase' || trans.type === 'income' || trans.investmentId) key = monthKeyOf(new Date(trans.date));
        else key = getPaymentMonthKey(trans.date, trans.bankId, trans.paymentMethod);
        if (!acc[key]) acc[key] = { income: 0, expense: 0 };
        if (trans.type === 'income') acc[key].income += trans.amount;
        else acc[key].expense += trans.amount;
        return acc;
      }, {}),
    [transactions, viewMode, getPaymentMonthKey],
  );

  const lastDataMonth = useMemo(() => Object.keys(cumulativeByMonth).sort().at(-1) ?? null, [cumulativeByMonth]);

  /** Chart rows for an ordered list of month keys; the balance line stops after the last month with data. */
  const buildRows = (keys) => {
    let last = null;
    return keys.map((key) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short' }).replace('.', '');
      let balance = null;
      if (lastDataMonth) {
        if (cumulativeByMonth[key] !== undefined) {
          last = cumulativeByMonth[key];
          balance = last;
        } else if (key <= lastDataMonth) {
          balance = rollover ? last : 0; // no rollover: a month without transactions nets zero
        }
      }
      return { key, label, income: monthlyData[key]?.income || 0, expense: monthlyData[key]?.expense || 0, balance };
    });
  };

  // Compact window: the selected month and the five before it.
  const compactRows = useMemo(() => {
    const [y, m] = baseMonth.split('-').map(Number);
    const keys = [];
    for (let i = COMPACT_MONTHS - 1; i >= 0; i -= 1) keys.push(monthKeyOf(new Date(y, m - 1 - i, 1)));
    return buildRows(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMonth, monthlyData, cumulativeByMonth, rollover, locale, lastDataMonth]);

  const years = useMemo(() => {
    const set = new Set([new Date().getFullYear(), Number(baseMonth.slice(0, 4))]);
    [...Object.keys(monthlyData), ...Object.keys(cumulativeByMonth)].forEach((k) => set.add(Number(k.slice(0, 4))));
    return [...set].filter(Number.isFinite).sort((a, b) => a - b);
  }, [monthlyData, cumulativeByMonth, baseMonth]);

  const year = sheetYear ?? Number(baseMonth.slice(0, 4));
  const yearRows = useMemo(
    () => buildRows(Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, monthlyData, cumulativeByMonth, rollover, locale, lastDataMonth],
  );

  const hasData = compactRows.some((r) => r.income > 0 || r.expense > 0) || years.some((y) => Object.keys(monthlyData).some((k) => k.startsWith(String(y))));
  if (!hasData) return null;

  const labels = {
    income: pt ? 'Entradas' : 'Income',
    expense: pt ? 'Saídas' : 'Expenses',
    balance: pt ? 'Saldo' : 'Balance',
    aria: pt ? 'Gráfico de entradas, saídas e saldo por mês' : 'Chart of income, expenses and balance by month',
  };

  const short = (v) => formatCurrency(v).replace(/,00$/, ''); // whole reais in the three small cards
  const selectedKey = activeKey && compactRows.some((r) => r.key === activeKey) ? activeKey : compactRows.at(-1).key;
  const selected = compactRows.find((r) => r.key === selectedKey);
  const longMonth = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };
  const balanceTone = (v) => (v === null ? 'text-slate-400' : v >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-400');

  const openSheet = () => {
    setSheetYear(Number(selectedKey.slice(0, 4)));
    setSheetKey(selectedKey);
    setOpen(true);
  };

  const sheetRow = yearRows.find((r) => r.key === sheetKey);
  const yearIndex = years.indexOf(year);

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{pt ? 'Panorama' : 'Overview'}</p>
          <p className="text-sm text-slate-600 first-letter:uppercase dark:text-slate-300">{longMonth(selectedKey)}</p>
        </div>
        <button
          onClick={openSheet}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-600 shadow-sm ring-1 ring-slate-200 hover:bg-violet-50 dark:bg-slate-800 dark:text-violet-300 dark:ring-slate-700"
        >
          <ArrowsPointingOutIcon className="h-4 w-4" />
          {pt ? 'Ver ano completo' : 'Full year'}
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <Stat label={labels.income} value={short(selected.income)} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label={labels.expense} value={short(selected.expense)} tone="text-rose-600 dark:text-rose-400" />
        <Stat label={labels.balance} value={selected.balance === null ? '—' : short(selected.balance)} tone={balanceTone(selected.balance)} />
      </div>

      <TrendBars
        data={compactRows}
        selectedKey={selectedKey}
        onSelect={setActiveKey}
        height={190}
        showAxis={false}
        darkMode={darkMode}
        formatCurrency={formatCurrency}
        labels={labels}
      />
      <p className="mt-1 text-center text-[11px] text-slate-400">{pt ? 'Toque em um mês para ver os valores' : 'Tap a month to see the values'}</p>

      {open && (
        <BottomSheet
          title={pt ? 'Panorama do ano' : 'Year overview'}
          subtitle={pt ? 'Entradas, saídas e saldo mês a mês' : 'Income, expenses and balance by month'}
          onClose={() => setOpen(false)}
        >
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => yearIndex > 0 && setSheetYear(years[yearIndex - 1])}
              disabled={yearIndex <= 0}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-25 dark:hover:bg-slate-800"
              aria-label={pt ? 'Ano anterior' : 'Previous year'}
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="min-w-[4rem] text-center text-lg font-black tabular-nums text-slate-900 dark:text-white">{year}</span>
            <button
              onClick={() => yearIndex < years.length - 1 && setSheetYear(years[yearIndex + 1])}
              disabled={yearIndex >= years.length - 1}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-25 dark:hover:bg-slate-800"
              aria-label={pt ? 'Próximo ano' : 'Next year'}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          <TrendBars
            data={yearRows}
            selectedKey={sheetKey}
            onSelect={setSheetKey}
            height={230}
            showAxis
            darkMode={darkMode}
            formatCurrency={formatCurrency}
            labels={labels}
          />

          <ul className="divide-y divide-slate-100 rounded-2xl bg-slate-50 dark:divide-slate-800 dark:bg-slate-800/50">
            {yearRows.map((r) => (
              <li key={r.key}>
                <button
                  onClick={() => setSheetKey(r.key)}
                  className={`grid w-full grid-cols-[3rem_1fr_1fr_1fr] items-center gap-2 px-3 py-2 text-left text-xs tabular-nums ${r.key === sheetKey ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
                >
                  <span className="font-bold capitalize text-slate-700 dark:text-slate-200">{r.label}</span>
                  <span className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(r.income)}</span>
                  <span className="text-right text-rose-600 dark:text-rose-400">{formatCurrency(r.expense)}</span>
                  <span className={`text-right font-semibold ${balanceTone(r.balance)}`}>{r.balance === null ? '—' : formatCurrency(r.balance)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-center text-[11px] text-slate-400">
            {labels.income} · {labels.expense} · {labels.balance}
          </p>

          {sheetRow && (
            <button
              onClick={() => {
                setSelectedMonth(sheetRow.key);
                setActiveKey(sheetRow.key);
                setOpen(false);
              }}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700"
            >
              {pt ? `Ir para ${longMonth(sheetRow.key)}` : `Go to ${longMonth(sheetRow.key)}`}
            </button>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
