import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../../contexts/SettingsContext';
import BottomSheet from '../chat/BottomSheet';
import HomeCard from './HomeCard';
import useCategorySpending from './useCategorySpending';
import { CATEGORY_COLORS, OTHERS_COLOR, iconFor } from './categoryMeta';
import { compactMoney, trimCents } from './format';
import { isUncategorized } from './uncategorized';

const TOP_ROWS = 3;
const STRIP_SEGMENTS = 3;
const UNCATEGORIZED_COLOR = '#4B5563';

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
  const tone = barColor(row, color);
  const note = row.hasLimit
    ? row.over
      ? `${pt ? 'Estourou' : 'Over by'} ${formatCurrency(Math.abs(row.remaining))} · ${pt ? 'limite' : 'limit'} ${formatCurrency(row.limit)}`
      : `${pt ? 'Sobram' : 'Left:'} ${formatCurrency(row.remaining)} · ${pt ? 'limite' : 'limit'} ${formatCurrency(row.limit)}`
    : pt ? 'sem limite definido' : 'no limit set';

  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-2xl p-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-700/40 dark:active:bg-slate-700/60 ${!row.hasSpending && !row.hasLimit ? 'opacity-50' : ''}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--rw-ink)]">
          <span className="text-lg leading-none" aria-hidden>{iconFor(row.category)}</span>
          <span className="truncate">{row.category}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--rw-ink)]">{formatCurrency(row.amount)}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${fill}%`, backgroundColor: tone }} />
      </div>
      <p className={`mt-1.5 text-xs ${row.over ? 'font-semibold text-rose-500' : 'text-[var(--rw-muted)]'}`}>
        {row.hasLimit ? (
          <>
            <strong style={{ color: tone }}>{pct}%</strong> · {note}
          </>
        ) : (
          <>
            <strong style={{ color: tone }}>{pct}%</strong> {pt ? 'do total' : 'of total'} · {note}
          </>
        )}
      </p>
    </button>
  );
}

export default function CategorySpendingCard({ transactions, selectedMonth }) {
  const { language, formatCurrency } = useSettings();
  const navigate = useNavigate();
  const pt = language === 'pt';
  const { rows, total, overCount } = useCategorySpending(transactions, selectedMonth);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // all | over | limit | none

  const uncategorizedRow = rows.find((r) => isUncategorized(r.category) && r.hasSpending);
  const uncategorized = uncategorizedRow?.amount ?? 0;
  // Real categories only: "no category" is its own grey segment and its own prompt, never a ranked category.
  const spendingRows = useMemo(() => rows.filter((r) => r.hasSpending && !isUncategorized(r.category)), [rows]);

  // Colours follow the ranking among real categories, so the strip, the list and the sheet always agree.
  const colorOf = useMemo(() => {
    const map = new Map();
    spendingRows.forEach((r, i) => map.set(r.category, CATEGORY_COLORS[i % CATEGORY_COLORS.length]));
    return (category) => (isUncategorized(category) ? UNCATEGORIZED_COLOR : map.get(category) ?? OTHERS_COLOR);
  }, [spendingRows]);

  const strip = useMemo(() => {
    const segs = [];
    if (uncategorized > 0) segs.push({ key: '__uncategorized', label: pt ? 'Sem categoria' : 'Uncategorized', amount: uncategorized, color: UNCATEGORIZED_COLOR });
    spendingRows.slice(0, STRIP_SEGMENTS).forEach((r) => segs.push({ key: r.category, label: r.category, amount: r.amount, color: colorOf(r.category) }));
    const rest = spendingRows.slice(STRIP_SEGMENTS).reduce((sum, r) => sum + r.amount, 0);
    if (rest > 0) segs.push({ key: '__rest', label: pt ? 'Outras' : 'Others', amount: rest, color: OTHERS_COLOR });
    return segs;
  }, [spendingRows, uncategorized, colorOf, pt]);

  if (rows.length === 0) return null;

  const goTo = (category) => {
    sessionStorage.setItem('expenses_categoryFilter', category);
    sessionStorage.removeItem('expenses_bankFilter');
    sessionStorage.removeItem('expenses_paymentMethodFilter');
    sessionStorage.setItem('expenses_viewMode', 'payment');
    navigate('/expenses');
  };

  const askElioToClassify = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const month = new Date(y, m - 1, 1).toLocaleDateString(pt ? 'pt-BR' : 'en-US', { month: 'long' });
    const text = pt ? `Categorize as minhas despesas sem categoria de ${month}.` : `Categorize my uncategorized expenses from ${month}.`;
    navigate(`/chat?q=${encodeURIComponent(text)}`);
  };

  const top = spendingRows.slice(0, TOP_ROWS);
  const filters = [
    { key: 'all', label: pt ? 'Todas' : 'All', test: () => true },
    { key: 'over', label: pt ? `Estouraram (${overCount})` : `Over (${overCount})`, test: (r) => r.over },
    { key: 'limit', label: pt ? 'Com limite' : 'With limit', test: (r) => r.hasLimit },
    { key: 'none', label: pt ? 'Sem gasto' : 'No spending', test: (r) => !r.hasSpending },
  ];
  const sheetRows = rows.filter(filters.find((f) => f.key === filter).test);
  const money = (v) => compactMoney(formatCurrency, v, pt);

  return (
    <>
      <HomeCard title={pt ? 'Onde foi o dinheiro' : 'Where the money went'} actionLabel={pt ? 'Ver tudo' : 'See all'} onAction={() => setOpen(true)}>
        {total === 0 ? (
          <p className="text-sm text-[var(--rw-muted)]">{pt ? 'Nenhum gasto neste mês.' : 'No spending this month.'}</p>
        ) : (
          <>
            <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={pt ? 'Distribuição dos gastos' : 'Spending distribution'}>
              {strip.map((seg) => (
                <div key={seg.key} title={`${seg.label}: ${money(seg.amount)}`} style={{ width: `${(seg.amount / total) * 100}%`, backgroundColor: seg.color }} className="h-full" />
              ))}
            </div>

            <ul className="mt-4 space-y-3">
              {top.map((row) => (
                <li key={row.category}>
                  <button onClick={() => goTo(row.category)} className="flex w-full items-baseline justify-between gap-3 text-left">
                    <span className="flex min-w-0 items-center gap-3 text-base text-[var(--rw-ink)]">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorOf(row.category) }} />
                      <span className="truncate">{row.category}</span>
                    </span>
                    <span className="shrink-0 text-base font-semibold tabular-nums text-[var(--rw-ink)]">{money(row.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {uncategorized > 0 && (
              <button
                onClick={askElioToClassify}
                className="mt-4 flex w-full items-start gap-3 rounded-2xl bg-violet-50 p-4 text-left text-base leading-snug text-slate-700 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-slate-200 dark:hover:bg-violet-500/15"
              >
                <SparklesIcon className="mt-1 h-5 w-5 shrink-0 text-violet-500 dark:text-violet-300" />
                <span>
                  {money(uncategorized)} {pt ? 'estão sem categoria.' : 'have no category.'}{' '}
                  <strong className="text-[var(--rw-brand-ink)]">{pt ? 'Elio classifica para você' : 'Let Elio sort them'}</strong>
                </span>
              </button>
            )}
          </>
        )}
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
