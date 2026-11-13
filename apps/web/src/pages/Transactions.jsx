import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useMonth } from '../contexts/MonthContext';
import useTransactions from '../hooks/useTransactions';
import TransactionList from '../components/TransactionList';
import BottomSheet from '../components/chat/BottomSheet';
import { XMarkIcon, AdjustmentsHorizontalIcon, PlusIcon, ListBulletIcon, ChartPieIcon } from '@heroicons/react/24/outline';
import { Shimmer } from '../components/ui/shimmer';
import PageHeader from '../components/PageHeader';
import { isUncategorized } from '../components/home/uncategorized';
import AddTransactionSheet from '../components/AddTransactionSheet';
import { lazy, Suspense } from 'react';
const ExpensesChartsView = lazy(() => import('../components/expenses/ExpensesChartsView'));

/**
 * A category link (the home's category list, the charts) must open the movements with EVERY other filter cleared and only
 * that category applied. Keying the view by the link's category remounts it with fresh state read from the URL, whether
 * the user arrives from another screen or taps a second category while already here.
 */
export default function TransactionsPage() {
  const [searchParams] = useSearchParams();
  return <TransactionsView key={searchParams.get('category') ?? ''} />;
}

function TransactionsView() {
  const { t, language, formatCurrency } = useSettings();
  const { ownerId } = useAccess();
  const { userBanks, getBankDisplayName, findUserBank, getPaymentMonthKey } = useCards();
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { transactions, loading } = useTransactions({}, { enabled: Boolean(ownerId) });

  // Get highlight ID from URL params
  const highlightId = searchParams.get('highlight');
  // Coming from an import summary: show only that import's rows (any month) so each one can be left out of the totals.
  const importFilter = searchParams.get('import');

  // Filters start from the URL: a category link means "that category, nothing else".
  const categoryParam = searchParams.get('category');
  const typeParam = searchParams.get('type');
  const [viewMode] = useState('payment');
  const [selectedBankFilter, setSelectedBankFilter] = useState('all');
  const [selectedPaymentMethodFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(() => (categoryParam && !isUncategorized(categoryParam) ? categoryParam : 'all'));
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showUncategorized, setShowUncategorized] = useState(Boolean(categoryParam) && isUncategorized(categoryParam));
  const [typeFilter, setTypeFilter] = useState(['income', 'expense'].includes(typeParam) ? typeParam : 'all');
  const [showAdd, setShowAdd] = useState(false);
  // The chart is the landing view. Anything that points at specific rows (a category, an import, a highlighted entry)
  // opens the list instead, with that filter already applied.
  const [displayMode, setDisplayMode] = useState(() => (categoryParam || importFilter || highlightId ? 'list' : 'charts'));

  // The month is shared app-wide (MonthContext), so a deep link only has to select it.
  const monthParam = searchParams.get('month');
  useEffect(() => {
    if (monthParam) setSelectedMonth(monthParam);
  }, [monthParam, setSelectedMonth]);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const pt = language === 'pt';

  const isUncat = (t) => !t.ignored && isUncategorized(t.category);
  const bankMatch = (t, id) => {
    if (id === 'all') return true;
    if (id === 'cash') return !t.bankId;
    return t.bankId === id || findUserBank(t.bankId)?.id === id;
  };
  const paymentMatch = (t, method) => {
    if (method === 'all') return true;
    if (method === 'cash') return !t.bankId;
    return (t.paymentMethod || 'credit') === method && Boolean(t.bankId);
  };

  // One place decides what each filter lets through. `scope(skip)` is "everything the user picked EXCEPT these
  // filters", which gives the list itself (skip nothing) and the per-option counts (skip the filter being counted).
  const scope = useMemo(() => {
    const inMonth = (t) => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (viewMode === 'purchase') return key === selectedMonth;
      if (t.type === 'income' || t.investmentId) return key === selectedMonth;
      return getPaymentMonthKey(t.date, t.bankId, t.paymentMethod) === selectedMonth;
    };
    const tests = {
      bank: (t) => bankMatch(t, selectedBankFilter),
      payment: (t) => paymentMatch(t, selectedPaymentMethodFilter),
      category: (t) => (showUncategorized ? isUncat(t) : selectedCategoryFilter === 'all' || t.category === selectedCategoryFilter),
      type: (t) => typeFilter === 'all' || t.type === typeFilter,
    };
    return (skip = []) => {
      // Coming from an import summary: that import's rows only (any month), so each can be left out of the totals.
      if (importFilter) return transactions.filter((t) => t.importId === importFilter && (skip.includes('type') || tests.type(t)));
      return transactions.filter((t) => (!selectedMonth || inMonth(t)) && Object.keys(tests).every((k) => skip.includes(k) || tests[k](t)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, importFilter, selectedMonth, viewMode, selectedBankFilter, selectedPaymentMethodFilter, selectedCategoryFilter, showUncategorized, typeFilter, findUserBank, getPaymentMonthKey]);

  const filteredTransactions = useMemo(() => scope(), [scope]);
  const typeScope = useMemo(() => scope(['type']), [scope]);
  const categoryScope = useMemo(() => scope(['category']), [scope]);
  const bankScope = useMemo(() => scope(['bank']), [scope]);

  const sumOf = (list) => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    for (const t of list) {
      if (t.type === 'income') incomeCount += 1; else if (t.type === 'expense') expenseCount += 1;
      if (t.ignored) continue;
      if (t.type === 'income') income += t.amount; else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, net: income - expense, incomeCount, expenseCount };
  };
  // The summary follows the filtered list: with nothing picked it is the whole month, with a category/bank/type it is
  // only those items.
  const totals = useMemo(() => sumOf(filteredTransactions), [filteredTransactions]);
  const typeCounts = useMemo(() => ({ all: typeScope.length, income: typeScope.filter((t) => t.type === 'income').length, expense: typeScope.filter((t) => t.type === 'expense').length }), [typeScope]);
  const categoryCounts = useMemo(() => {
    const m = new Map();
    for (const t of categoryScope) m.set(t.category, (m.get(t.category) || 0) + 1);
    return m;
  }, [categoryScope]);

  const availableCategories = useMemo(() => {
    const cats = new Set();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Return userBanks with their display info for the filter dropdown
  // Each item includes the unique document ID for filtering
  const availableBanks = useMemo(() => {
    return userBanks.map(ub => {
      return {
        id: ub.id, // Unique document ID for filtering
        bankId: ub.bankId, // Bank type ID for icon lookup
        name: getBankDisplayName(ub), // Display name (custom name or default)
      };
    });
  }, [userBanks, getBankDisplayName]);

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const uncategorizedCount = useMemo(() => categoryScope.filter(isUncat).length, [categoryScope]);

  const activeFiltersCount = [
    selectedBankFilter !== 'all',
    selectedCategoryFilter !== 'all',
    showUncategorized
  ].filter(Boolean).length;

  const PAYMENT_LABELS = { credit: pt ? 'Crédito' : 'Credit', debit: pt ? 'Débito' : 'Debit', pix: 'PIX', transfer: pt ? 'Transferência' : 'Transfer', cash: pt ? 'Dinheiro' : 'Cash' };
  const filterLabels = [];
  if (importFilter) filterLabels.push(pt ? 'Importação' : 'Import');
  if (showUncategorized) filterLabels.push(pt ? 'Sem categoria' : 'Uncategorized');
  else if (selectedCategoryFilter !== 'all') filterLabels.push(selectedCategoryFilter);
  if (selectedBankFilter !== 'all') filterLabels.push(selectedBankFilter === 'cash' ? (pt ? 'Dinheiro' : 'Cash') : availableBanks.find((b) => b.id === selectedBankFilter)?.name ?? '');
  if (selectedPaymentMethodFilter !== 'all') filterLabels.push(PAYMENT_LABELS[selectedPaymentMethodFilter] ?? selectedPaymentMethodFilter);
  if (typeFilter !== 'all') filterLabels.push(typeFilter === 'income' ? (pt ? 'Entradas' : 'In') : (pt ? 'Saídas' : 'Out'));
  const money = (v) => formatCurrency(v).replace(/,00(?=\D*$)/, '');
  const headline = typeFilter === 'income' ? money(totals.income) : typeFilter === 'expense' ? money(totals.expense) : `${totals.net >= 0 ? '+ ' : '- '}${money(Math.abs(totals.net))}`;
  const headlineNote = typeFilter === 'income'
    ? (pt ? 'recebidos' : 'received')
    : typeFilter === 'expense'
      ? (pt ? 'gastos' : 'spent')
      : totals.net >= 0
        ? (pt ? 'entrou mais do que saiu' : 'more came in than went out')
        : (pt ? 'saiu mais do que entrou' : 'more went out than came in');

  const triggerRefresh = () => {};

  // First load with nothing cached yet: a skeleton, never "R$ 0" or an empty list that looks like missing data.
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
        <PageHeader title={language === 'pt' ? 'Movimentos' : 'Activity'} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 pb-24" aria-busy="true" aria-label={language === 'pt' ? 'Carregando' : 'Loading'}>
          <Shimmer className="mb-3 h-[150px] w-full rounded-[28px]" />
          <Shimmer className="mb-3 h-[44px] w-full rounded-[14px]" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 7 }, (_, i) => <Shimmer key={i} className="h-[64px] w-full rounded-2xl" />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
      <PageHeader title={language === 'pt' ? 'Movimentos' : 'Activity'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-4 pb-24">
        {importFilter && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[16px] bg-[var(--rw-brand-soft)] px-4 py-3">
            <p className="text-[13px] font-semibold text-[var(--rw-brand-ink)]">
              {language === 'pt'
                ? `Itens desta importação (${filteredTransactions.length}). Toque em "Ignorar" para deixar um de fora dos totais.`
                : `Items from this import (${filteredTransactions.length}). Tap "Ignore" to leave one out of the totals.`}
            </p>
            <button type="button" onClick={() => setSearchParams({})} className="shrink-0 min-h-[44px] text-sm font-bold text-[var(--rw-brand-ink)]">
              {language === 'pt' ? 'Ver tudo' : 'See all'}
            </button>
          </div>
        )}
        <section className="rw-hero rw-hero-violet flex flex-col gap-1 p-5 mb-3" aria-label={pt ? 'Resumo' : 'Summary'}>
          <span className="rw-eyebrow text-violet-300">
            {getMonthLabel(selectedMonth).toUpperCase()}
            {filterLabels.length > 0 && ` · ${pt ? 'FILTRADO' : 'FILTERED'}`}
          </span>
          {filterLabels.length > 0 && <span className="text-[13px] font-semibold text-violet-100">{filterLabels.join(' · ')}</span>}
          <span className="rw-num text-[44px] font-extrabold leading-[48px]">{headline}</span>
          <span className="text-[15px] text-violet-100">
            {headlineNote} · {filteredTransactions.length} {pt ? (filteredTransactions.length === 1 ? 'movimento' : 'movimentos') : (filteredTransactions.length === 1 ? 'entry' : 'entries')}
          </span>
          {typeFilter === 'all' && (
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <div>
                <span className="block text-xs font-semibold text-violet-200">{pt ? 'Entradas' : 'In'} · {totals.incomeCount}</span>
                <span className="rw-num text-lg font-bold text-emerald-300">{money(totals.income)}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-violet-200">{pt ? 'Saídas' : 'Out'} · {totals.expenseCount}</span>
                <span className="rw-num text-lg font-bold text-rose-300">{money(totals.expense)}</span>
              </div>
            </div>
          )}
        </section>

        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto sm:gap-2 [scrollbar-width:none]" role="tablist" aria-label={pt ? 'Filtrar por tipo' : 'Filter by type'}>
          {[['all', pt ? 'Tudo' : 'All'], ['income', pt ? 'Entradas' : 'In'], ['expense', pt ? 'Saídas' : 'Out']].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={typeFilter === key} onClick={() => setTypeFilter(key)}
              className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold sm:px-3.5 sm:text-sm ${typeFilter === key ? 'border-transparent bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'border-[var(--rw-border)] text-[var(--rw-muted)]'} ${typeCounts[key] === 0 && typeFilter !== key ? 'opacity-40' : ''}`}>
              {label} <span className="ml-0.5 text-[13px] font-normal tabular-nums opacity-70">{typeCounts[key]}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-sm text-[var(--rw-subtle)]">{filteredTransactions.length} {pt ? 'itens' : 'items'}</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 rounded-[10px] bg-[var(--rw-raised)] p-0.5" role="group" aria-label={pt ? 'Modo de exibição' : 'Display mode'}>
              {[['list', pt ? 'Lista' : 'List', <ListBulletIcon key="l" className="h-5 w-5" />], ['charts', pt ? 'Gráfico' : 'Chart', <ChartPieIcon key="c" className="h-5 w-5" />]].map(([k, label, icon]) => (
                <button key={k} type="button" aria-label={label} aria-pressed={displayMode === k} onClick={() => setDisplayMode(k)}
                  className={`flex h-8 w-[34px] items-center justify-center rounded-[8px] ${displayMode === k ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>
                  {icon}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label={pt ? 'Filtros' : 'Filters'}
              onClick={() => setShowFilters(true)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-[10px] ${activeFiltersCount > 0 ? 'bg-[var(--rw-brand)] text-white' : 'bg-[var(--rw-raised)] text-[var(--rw-muted)]'}`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--rw-brand-ink)] px-1 text-[10px] font-bold text-white">{activeFiltersCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel: only what people actually reach for. Sorting is one choice; view-by and payment method stay at their defaults. */}
        {showFilters && (
          <BottomSheet
            title={pt ? 'Filtros' : 'Filters'}
            onClose={() => setShowFilters(false)}
            footer={
              <div className="flex gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedBankFilter('all'); setSelectedCategoryFilter('all'); setShowUncategorized(false); }}
                    className="h-12 rounded-xl px-4 text-sm font-bold text-[var(--rw-brand-ink)]"
                  >
                    {pt ? 'Limpar' : 'Clear'}
                  </button>
                )}
                <button type="button" onClick={() => setShowFilters(false)} className="h-12 flex-1 rounded-xl bg-[var(--rw-brand)] text-sm font-bold text-white">
                  {pt ? `Ver ${filteredTransactions.length} movimentos` : `Show ${filteredTransactions.length} entries`}
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-1.5 uppercase tracking-wide">{t('charts.category')}</label>
                <select
                  value={showUncategorized ? '__none' : selectedCategoryFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setShowUncategorized(v === '__none');
                    setSelectedCategoryFilter(v === '__none' ? 'all' : v);
                  }}
                  className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                >
                  <option value="all">{pt ? 'Todas' : 'All'} ({categoryScope.length})</option>
                  {uncategorizedCount > 0 && <option value="__none">{pt ? 'Sem categoria' : 'Uncategorized'} ({uncategorizedCount})</option>}
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat} ({categoryCounts.get(cat) || 0})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-1.5 uppercase tracking-wide">{pt ? 'Banco' : 'Bank'}</label>
                <select value={selectedBankFilter} onChange={(e) => setSelectedBankFilter(e.target.value)} className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent">
                  <option value="all">{pt ? 'Todos os bancos' : 'All banks'} ({bankScope.length})</option>
                  <option value="cash">{pt ? 'Dinheiro (sem banco)' : 'Cash (no bank)'} ({bankScope.filter((t) => bankMatch(t, 'cash')).length})</option>
                  {availableBanks.map((bank) => (
                    <option key={bank.id} value={bank.id}>{bank.name} ({bankScope.filter((t) => bankMatch(t, bank.id)).length})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-1.5 uppercase tracking-wide">{pt ? 'Ordenar' : 'Sort'}</label>
                <select
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => { const [by, order] = e.target.value.split(':'); setSortBy(by); setSortOrder(order); }}
                  className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                >
                  <option value="date:desc">{pt ? 'Mais recentes' : 'Newest first'}</option>
                  <option value="date:asc">{pt ? 'Mais antigos' : 'Oldest first'}</option>
                  <option value="amount:desc">{pt ? 'Maior valor' : 'Highest amount'}</option>
                  <option value="amount:asc">{pt ? 'Menor valor' : 'Lowest amount'}</option>
                </select>
              </div>
            </div>

          </BottomSheet>
        )}

        {/* Transactions List */}
        <div className={displayMode === 'charts' ? '' : 'rw-card p-3 sm:p-5'}>
{displayMode === 'charts' ? (
            <Suspense fallback={<div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--rw-brand)] border-t-transparent" /></div>}>
              <ExpensesChartsView
                transactions={filteredTransactions}
                language={language}
                onlyWithItems
                onCategoryClick={(cat) => { setSelectedCategoryFilter(cat); setDisplayMode('list'); }}
              />
            </Suspense>
          ) : (
                    <TransactionList
            transactions={filteredTransactions}
            selectedMonth={selectedMonth}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSuccess={triggerRefresh}
            highlightId={highlightId}
            hideBulkEdit
          />
          )}
        </div>
      </main>
      <button
        type="button"
        onClick={() => setShowAdd(true)}
        aria-label={language === 'pt' ? 'Adicionar movimento' : 'Add entry'}
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rw-brand)] text-white shadow-lg shadow-black/30 active:scale-95 bottom-[calc(24px+env(safe-area-inset-bottom))]"
      >
        <PlusIcon className="h-7 w-7" />
      </button>
      {showAdd && <AddTransactionSheet onClose={() => setShowAdd(false)} />}
      <PageHelp
        title="Transações"
        text="Registre e filtre suas movimentações. Categorize cada transação para acompanhar onde seu dinheiro vai. Use o + para adicionar manualmente ou importe um extrato."
        hasFab={false}
      />
    </div>
  );
}
