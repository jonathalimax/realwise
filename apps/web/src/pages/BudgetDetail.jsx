import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import TransactionList from '../components/TransactionList';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import { useBudget } from '../contexts/BudgetContext';
import { useMonth } from '../contexts/MonthContext';
import useTransactions from '../hooks/useTransactions';
import useCategorySpending from '../components/home/useCategorySpending';
import useBudgetGroups from '../components/home/useBudgetGroups';
import { iconFor } from '../components/home/categoryMeta';
import { isUncategorized } from '../components/home/uncategorized';
import { trimCents } from '../components/home/format';

const ROSE = 'var(--rw-neg)';
const AMBER = 'var(--rw-warn)';
const BRAND = 'var(--rw-brand)';
const TREND_MONTHS = 6;
const GROUP_KEYS = ['needs', 'wants', 'savings'];

const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function Panel({ title, children }) {
  return (
    <section className="rounded-[20px] border border-[var(--rw-border)] bg-[var(--rw-surface)] p-4">
      {title && <h2 className="mb-3 text-[17px] font-bold leading-6 text-[var(--rw-ink)]">{title}</h2>}
      {children}
    </section>
  );
}

/** Spent against a limit: a big amount, a progress bar and one phrase saying what is left or how much it went over. */
function SpentSummary({ spent, limit, hasLimit, goal = false, tone, pt, money }) {
  const pct = hasLimit ? (spent / limit) * 100 : 0;
  const over = hasLimit && !goal && spent > limit;
  const color = over ? ROSE : tone ?? (pct >= 85 && !goal ? AMBER : BRAND);
  const remaining = limit - spent;
  const phrase = !hasLimit
    ? (pt ? 'Sem limite definido' : 'No limit set')
    : goal
      ? remaining > 0 ? `${pt ? 'Faltam' : 'To go'} ${money(remaining)}` : pt ? 'Meta batida' : 'Goal reached'
      : over ? `${pt ? 'Passou' : 'Over by'} ${money(Math.abs(remaining))}` : `${pt ? 'Sobram' : 'Left'} ${money(remaining)}`;
  return (
    <div>
      <p className="text-sm text-[var(--rw-muted)]">{goal ? (pt ? 'Guardado' : 'Saved') : (pt ? 'Gasto no mês' : 'Spent this month')}</p>
      <p className="rw-num mt-0.5 whitespace-nowrap text-[clamp(1.75rem,9vw,2.25rem)] font-extrabold leading-tight text-[var(--rw-ink)]">{money(spent)}</p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--rw-track)]">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, hasLimit ? Math.max(spent > 0 ? 2 : 0, pct) : 0)}%`, backgroundColor: color }} />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold" style={{ color: over ? ROSE : 'var(--rw-ink)' }}>{phrase}</span>
        {hasLimit && (
          <span className="tabular-nums text-[var(--rw-muted)]">
            {Math.round(pct)}% {pt ? 'de' : 'of'} {money(limit)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Simple bars for the last months; the selected one is highlighted. */
function Trend({ points, pt, locale, money }) {
  const max = Math.max(1, ...points.map((p) => p.amount));
  return (
    <div className="flex h-36 items-end gap-2" role="img" aria-label={pt ? 'Gasto dos últimos meses' : 'Spending in recent months'}>
      {points.map((p) => (
        <div key={p.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="w-full truncate text-center text-[10px] tabular-nums text-[var(--rw-muted)]">{p.amount > 0 ? money(p.amount) : ''}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md"
              style={{ height: `${p.amount > 0 ? Math.max(4, (p.amount / max) * 100) : 2}%`, backgroundColor: p.selected ? BRAND : 'var(--rw-track)' }}
            />
          </div>
          <span className={`text-[11px] ${p.selected ? 'font-bold text-[var(--rw-ink)]' : 'text-[var(--rw-muted)]'}`}>
            {new Date(`${p.month}-01T12:00:00`).toLocaleDateString(locale, { month: 'short' }).replace('.', '')}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BudgetDetailPage({ kind }) {
  const params = useParams();
  const navigate = useNavigate();
  const { language, formatCurrency } = useSettings();
  const { ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const { getCategoryRule } = useBudget();
  const { selectedMonth } = useMonth();
  const { transactions, loading } = useTransactions({}, { enabled: Boolean(ownerId) });
  const pt = language === 'pt';
  const locale = pt ? 'pt-BR' : 'en-US';
  const money = (v) => trimCents(formatCurrency(Math.round(Math.abs(v) * 100) / 100));

  const name = kind === 'category' ? decodeURIComponent(params.name ?? '') : '';
  const groupKey = kind === 'group' ? params.key : null;

  // Same month rule as the Home: purchase month for income, payment month for card expenses.
  const inMonth = useMemo(
    () => (monthKey) =>
      transactions.filter((t) => {
        const monthOfDate = monthKeyOf(new Date(t.date));
        if (t.type === 'income' || t.investmentId) return monthOfDate === monthKey;
        return getPaymentMonthKey(t.date, t.bankId, t.paymentMethod) === monthKey;
      }),
    [transactions, getPaymentMonthKey],
  );
  const monthly = useMemo(() => inMonth(selectedMonth), [inMonth, selectedMonth]);
  const { rows, total } = useCategorySpending(monthly, selectedMonth);
  const { model, isLoading: planLoading } = useBudgetGroups(monthly, selectedMonth);

  const group = useMemo(() => model?.groups.find((g) => g.key === groupKey) ?? null, [model, groupKey]);
  const groupRows = useMemo(
    () => (groupKey ? rows.filter((r) => !isUncategorized(r.category) && getCategoryRule(r.category) === groupKey && (r.hasSpending || r.hasLimit)) : []),
    [rows, groupKey, getCategoryRule],
  );
  const row = useMemo(() => (kind === 'category' ? rows.find((r) => r.category === name) ?? null : null), [rows, kind, name]);

  const matchesCategory = (t) => (isUncategorized(name) ? isUncategorized(t.category) : t.category === name);
  const categoryTx = useMemo(
    () => (kind === 'category' ? monthly.filter((t) => t.type === 'expense' && !t.ignored && matchesCategory(t)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthly, kind, name],
  );

  const trend = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const belongs = kind === 'category' ? matchesCategory : (t) => !isUncategorized(t.category) && getCategoryRule(t.category) === groupKey;
    return Array.from({ length: TREND_MONTHS }, (_, i) => {
      const key = monthKeyOf(new Date(y, m - 1 - (TREND_MONTHS - 1 - i), 1));
      const amount = inMonth(key).filter((t) => t.type === 'expense' && !t.ignored && belongs(t)).reduce((s, t) => s + t.amount, 0);
      return { month: key, amount, selected: key === selectedMonth };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inMonth, selectedMonth, kind, name, groupKey, getCategoryRule]);

  if (kind === 'group' && !GROUP_KEYS.includes(groupKey)) return <Navigate to="/dashboard" replace />;

  const title = kind === 'category' ? name : group?.label ?? (pt ? { needs: 'Necessidades', wants: 'Desejos', savings: 'Poupança' } : { needs: 'Needs', wants: 'Wants', savings: 'Savings' })[groupKey];
  const header = <PageHeader title={title} backTo="/dashboard" />;

  if (loading || (kind === 'group' && planLoading)) {
    return (
      <div className="min-h-screen bg-[var(--rw-bg)]">
        {header}
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 pb-24">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-[20px] bg-[var(--rw-surface)]" />)}
        </main>
      </div>
    );
  }

  const spent = kind === 'category' ? row?.amount ?? 0 : group?.used ?? groupRows.reduce((s, r) => s + r.amount, 0);
  const share = total > 0 ? (spent / total) * 100 : 0;
  const monthLabel = new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[var(--rw-bg)]">
      {header}
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4 pb-24">
        <Panel>
          <div className="mb-4 flex items-center gap-3">
            {kind === 'category' ? (
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--rw-raised)] text-2xl" aria-hidden>{iconFor(name)}</span>
            ) : (
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: group?.base }} aria-hidden />
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-[var(--rw-ink)]">{title}</p>
              <p className="text-sm capitalize text-[var(--rw-muted)]">{monthLabel}</p>
            </div>
          </div>
          {kind === 'category' ? (
            <SpentSummary spent={spent} limit={row?.limit ?? 0} hasLimit={Boolean(row?.hasLimit)} pt={pt} money={money} />
          ) : group ? (
            <SpentSummary spent={group.used} limit={group.planned} hasLimit={group.planned > 0} goal={group.goal} tone={group.bar} pt={pt} money={money} />
          ) : (
            <SpentSummary spent={spent} limit={0} hasLimit={false} pt={pt} money={money} />
          )}
        </Panel>

        <Panel title={pt ? 'Peso no mês' : 'Share of the month'}>
          <p className="text-sm text-[var(--rw-muted)]">
            <strong className="text-[var(--rw-ink)]">{share.toFixed(share >= 10 || share === 0 ? 0 : 1).replace('.', pt ? ',' : '.')}%</strong>{' '}
            {pt ? `dos ${money(total)} gastos neste mês` : `of the ${money(total)} spent this month`}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--rw-track)]">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, share)}%`, backgroundColor: group?.base ?? BRAND }} />
          </div>
        </Panel>

        <Panel title={pt ? 'Últimos 6 meses' : 'Last 6 months'}>
          <Trend points={trend} pt={pt} locale={locale} money={money} />
        </Panel>

        {kind === 'group' && (
          <Panel title={pt ? 'Categorias' : 'Categories'}>
            {groupRows.length === 0 ? (
              <p className="text-sm text-[var(--rw-muted)]">{pt ? 'Nenhuma categoria com gasto ou limite neste grupo.' : 'No category with spending or a limit in this group.'}</p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {groupRows.map((r) => {
                  const pct = Math.min(100, Math.max(r.hasSpending ? 2 : 0, r.usedPct));
                  return (
                    <li key={r.category}>
                      <button
                        type="button"
                        onClick={() => navigate(`/budget/category/${encodeURIComponent(r.category)}`)}
                        className="block min-h-[44px] w-full rounded-2xl px-2 py-2 text-left transition-colors active:bg-[var(--rw-raised)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-[var(--rw-ink)]">
                            <span aria-hidden>{iconFor(r.category)}</span>
                            <span className="truncate">{r.category}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-[15px] font-semibold tabular-nums text-[var(--rw-ink)]">
                            {money(r.amount)}
                            <ChevronRightIcon className="h-4 w-4 text-[var(--rw-subtle)]" aria-hidden />
                          </span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--rw-track)]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.over ? ROSE : group?.base ?? BRAND }} />
                        </div>
                        <p className={`mt-1 text-xs ${r.over ? 'font-semibold' : 'text-[var(--rw-muted)]'}`} style={r.over ? { color: ROSE } : undefined}>
                          {r.hasLimit
                            ? r.over
                              ? `${pt ? 'Passou' : 'Over by'} ${money(r.remaining)} · ${pt ? 'limite' : 'limit'} ${money(r.limit)}`
                              : `${pt ? 'Sobram' : 'Left'} ${money(r.remaining)} · ${pt ? 'limite' : 'limit'} ${money(r.limit)}`
                            : pt ? 'sem limite definido' : 'no limit set'}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {kind === 'category' && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-bold text-[var(--rw-ink)]">{pt ? 'Movimentos do mês' : "This month's entries"}</h2>
              <button
                type="button"
                onClick={() => navigate(`/transactions?${new URLSearchParams({ category: name, type: 'expense', month: selectedMonth })}`)}
                className="min-h-[44px] px-1 text-sm font-semibold text-[var(--rw-brand-ink)]"
              >
                {pt ? 'Ver em Movimentos' : 'See in Transactions'}
              </button>
            </div>
            {categoryTx.length === 0 ? (
              <Panel><p className="text-sm text-[var(--rw-muted)]">{pt ? 'Nenhum movimento nesta categoria neste mês.' : 'No entries in this category this month.'}</p></Panel>
            ) : (
              <TransactionList transactions={categoryTx} selectedMonth={selectedMonth} hideBulkEdit />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
