import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import BottomSheet from '../chat/BottomSheet';
import HomeCard from './HomeCard';
import useCategorySpending from './useCategorySpending';
import { CATEGORY_COLORS, OTHERS_COLOR, iconFor } from './categoryMeta';
import { trimCents } from './format';

const TOP_ROWS = 5;
const STRIP_SEGMENTS = 5;

const AMBER = '#F59E0B';
const ROSE = '#F43F5E';
const barColor = (row, base) => (row.over ? ROSE : row.hasLimit && row.usedPct >= 75 ? AMBER : base);

/**
 * One compact row per category: what was spent, the limit, what is left and the percentage, with a bar that reads
 * at a glance (colour shifts to amber near the limit and rose when over it). Works for 5 categories or 30.
 */
function CategoryRow({ row, color, formatCurrency: formatFull, pt, onClick }) {
  const formatCurrency = (v) => trimCents(formatFull(v));
  const fill = Math.min(100, Math.max(row.hasSpending ? 2 : 0, row.usedPct));
  const pct = Math.round(row.usedPct);
  const note = row.hasLimit
    ? row.over
      ? `${pt ? 'Estourou' : 'Over by'} ${formatCurrency(Math.abs(row.remaining))}`
      : `${pt ? 'Sobra' : 'Left'} ${formatCurrency(row.remaining)}`
    : `${pt ? 'do total · sem limite definido' : 'of total · no limit set'}`;

  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-2xl p-2 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-700/40 dark:active:bg-slate-700/60 ${!row.hasSpending && !row.hasLimit ? 'opacity-50' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          <span className="text-base leading-none" aria-hidden>{iconFor(row.category)}</span>
          <span className="truncate">{row.category}</span>
        </span>
        <span className="shrink-0 text-[13px] tabular-nums text-slate-900 dark:text-white">
          <strong>{formatCurrency(row.amount)}</strong>
          {row.hasLimit && <span className="text-[11px] font-normal text-slate-400"> {pt ? 'de' : 'of'} {formatCurrency(row.limit)}</span>}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${fill}%`, backgroundColor: barColor(row, color) }} />
        </div>
        <span className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums" style={{ color: barColor(row, color) }}>
          {pct}%
        </span>
      </div>
      <p className={`mt-0.5 text-[11px] ${row.over ? 'font-semibold text-rose-500' : 'text-slate-400'}`}>
        {row.hasLimit ? note : `${pct}% ${note}`}
      </p>
    </button>
  );
}

export default function CategorySpendingCard({ transactions, selectedMonth }) {
  const { language, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const pt = language === 'pt';
  const { rows, total, totalLimit, spentWithLimit, overCount } = useCategorySpending(transactions, selectedMonth);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all | over | limit | none

  // Colours follow the ranking among categories that have spending, so the strip and the rows always agree.
  const colorOf = useMemo(() => {
    const map = new Map();
    rows.filter((r) => r.hasSpending).forEach((r, i) => map.set(r.category, CATEGORY_COLORS[i % CATEGORY_COLORS.length]));
    return (category) => map.get(category) ?? OTHERS_COLOR;
  }, [rows]);

  const spendingRows = rows.filter((r) => r.hasSpending);
  const strip = useMemo(() => {
    const top = spendingRows.slice(0, STRIP_SEGMENTS).map((r) => ({ key: r.category, label: r.category, amount: r.amount, color: colorOf(r.category) }));
    const rest = spendingRows.slice(STRIP_SEGMENTS).reduce((s, r) => s + r.amount, 0);
    return rest > 0 ? [...top, { key: '__rest', label: pt ? 'Outras' : 'Others', amount: rest, color: OTHERS_COLOR }] : top;
  }, [spendingRows, colorOf, pt]);

  if (rows.length === 0) return null;

  const goTo = (category) => {
    sessionStorage.setItem('expenses_categoryFilter', category);
    sessionStorage.removeItem('expenses_bankFilter');
    sessionStorage.removeItem('expenses_paymentMethodFilter');
    sessionStorage.setItem('expenses_viewMode', 'payment');
    navigate('/expenses');
  };

  const top = rows.filter((r) => r.hasSpending || r.hasLimit).slice(0, TOP_ROWS);
  const filters = [
    { key: 'all', label: pt ? 'Todas' : 'All', test: () => true },
    { key: 'over', label: pt ? `Estouraram (${overCount})` : `Over (${overCount})`, test: (r) => r.over },
    { key: 'limit', label: pt ? 'Com limite' : 'With limit', test: (r) => r.hasLimit },
    { key: 'none', label: pt ? 'Sem gasto' : 'No spending', test: (r) => !r.hasSpending },
  ];
  const sheetRows = rows.filter(filters.find((f) => f.key === filter).test);
  const overallPct = totalLimit > 0 ? Math.round((spentWithLimit / totalLimit) * 100) : null;

  return (
    <>
      <HomeCard
        title={pt ? 'Gastos' : 'Spending'}
        subtitle={
          overallPct !== null
            ? `${trimCents(formatCurrency(spentWithLimit))} ${pt ? 'de' : 'of'} ${trimCents(formatCurrency(totalLimit))} · ${overallPct}%`
            : trimCents(formatCurrency(total))
        }
        actionLabel={pt ? `Ver todas (${rows.length})` : `All (${rows.length})`}
        onAction={() => setOpen(true)}
      >
        {strip.length > 0 && (
          <div className="mb-3">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60" role="img" aria-label={pt ? 'Distribuição dos gastos' : 'Spending distribution'}>
              {strip.map((seg) => (
                <div key={seg.key} title={`${seg.label}: ${trimCents(formatCurrency(seg.amount))}`} style={{ width: `${(seg.amount / total) * 100}%`, backgroundColor: seg.color }} className="h-full border-r border-white/60 last:border-r-0 dark:border-slate-800" />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {strip.map((seg) => (
                <span key={seg.key} className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
                  {seg.label} <span className="tabular-nums text-slate-400">{Math.round((seg.amount / total) * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="-mx-2 space-y-0.5">
          {top.map((row) => (
            <CategoryRow key={row.category} row={row} color={colorOf(row.category)} formatCurrency={formatCurrency} pt={pt} onClick={() => goTo(row.category)} />
          ))}
        </div>
      </HomeCard>

      {open && (
        <BottomSheet
          title={pt ? 'Todas as categorias' : 'All categories'}
          subtitle={pt ? 'Gasto, limite, quanto sobra e a porcentagem usada.' : 'Spent, limit, what is left and the share used.'}
          onClose={() => setOpen(false)}
        >
          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
            {filters.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filter === f.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="-mx-2 space-y-0.5">
            {sheetRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">{pt ? 'Nenhuma categoria neste filtro.' : 'No categories in this filter.'}</p>
            ) : (
              sheetRows.map((row) => (
                <CategoryRow
                  key={row.category}
                  row={row}
                  color={colorOf(row.category)}
                  formatCurrency={formatCurrency}
                  pt={pt}
                  onClick={() => {
                    setOpen(false);
                    goTo(row.category);
                  }}
                />
              ))
            )}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
