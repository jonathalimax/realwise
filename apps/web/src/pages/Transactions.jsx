import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useMonth } from '../contexts/MonthContext';
import useTransactions from '../hooks/useTransactions';
import TransactionList from '../components/TransactionList';
import { XMarkIcon, AdjustmentsHorizontalIcon, PlusIcon } from '@heroicons/react/24/outline';
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
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank, getPaymentMonthKey } = useCards();
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
  const [viewMode, setViewMode] = useState('payment');
  const [selectedBankFilter, setSelectedBankFilter] = useState('all');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(() => (categoryParam && !isUncategorized(categoryParam) ? categoryParam : 'all'));
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(Boolean(categoryParam));
  const [showUncategorized, setShowUncategorized] = useState(Boolean(categoryParam) && isUncategorized(categoryParam));
  const [typeFilter, setTypeFilter] = useState(['income', 'expense'].includes(typeParam) ? typeParam : 'all');
  const [showAdd, setShowAdd] = useState(false);
  const [displayMode, setDisplayMode] = useState('list');

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
  const paymentScope = useMemo(() => scope(['payment']), [scope]);

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
      const bankInfo = getBankInfo(ub.bankId);
      return {
        id: ub.id, // Unique document ID for filtering
        bankId: ub.bankId, // Bank type ID for icon lookup
        name: getBankDisplayName(ub), // Display name (custom name or default)
        icon: bankInfo.icon
      };
    });
  }, [userBanks, getBankInfo, getBankDisplayName]);

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const uncategorizedCount = useMemo(() => categoryScope.filter(isUncat).length, [categoryScope]);

  const activeFiltersCount = [
    viewMode !== 'payment',
    selectedBankFilter !== 'all',
    selectedPaymentMethodFilter !== 'all',
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

        <div className="flex p-[3px] gap-0.5 rounded-[14px] bg-[var(--rw-raised)] mb-3" role="tablist" aria-label={pt ? 'Filtrar por tipo' : 'Filter by type'}>
          {[['all', pt ? 'Tudo' : 'All'], ['income', pt ? 'Entradas' : 'In'], ['expense', pt ? 'Saídas' : 'Out']].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={typeFilter === key} onClick={() => setTypeFilter(key)}
              className={`flex-1 h-[38px] rounded-[11px] text-sm font-semibold ${typeFilter === key ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>
              {label} <span className="tabular-nums opacity-70">· {typeCounts[key]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--rw-subtle)]">{filteredTransactions.length} {language === 'pt' ? 'itens' : 'items'}</span>
              <div className="flex gap-0.5 rounded-full bg-[var(--rw-raised)] p-0.5" role="group" aria-label={language === 'pt' ? 'Modo de exibição' : 'Display mode'}>
                {[['list', language === 'pt' ? 'Lista' : 'List'], ['charts', language === 'pt' ? 'Gráfico' : 'Chart']].map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={displayMode === k} onClick={() => setDisplayMode(k)}
                    className={`h-8 rounded-full px-3 text-xs font-bold ${displayMode === k ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>{label}</button>
                ))}
              </div>
            </div>
            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl shadow-sm transition-all flex-shrink-0 ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-[var(--rw-brand)] text-white'
                  : 'bg-[var(--rw-surface)] text-[var(--rw-ink)] hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              <span className="font-medium text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
              {activeFiltersCount > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  showFilters ? 'bg-white/20' : 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]'
                }`}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-4 p-3 sm:p-4 bg-[var(--rw-surface)] rounded-xl shadow-sm space-y-3 sm:space-y-4">
            {/* View Mode Toggle */}
            <div>
              <label className="block text-xs font-medium text-[var(--rw-muted)] mb-2 uppercase tracking-wide">
                {language === 'pt' ? 'Visualizar por' : 'View by'}
              </label>
              <div className="flex p-1 bg-[var(--rw-raised)] rounded-lg">
                <button
                  onClick={() => setViewMode('purchase')}
                  className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    viewMode === 'purchase'
                      ? 'bg-[var(--rw-raised)] text-[var(--rw-ink)] shadow-sm'
                      : 'text-[var(--rw-muted)]'
                  }`}
                >
                  {t('cards.viewByPurchase')}
                </button>
                <button
                  onClick={() => setViewMode('payment')}
                  className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    viewMode === 'payment'
                      ? 'bg-[var(--rw-raised)] text-[var(--rw-ink)] shadow-sm'
                      : 'text-[var(--rw-muted)]'
                  }`}
                >
                  {t('cards.viewByPayment')}
                </button>
              </div>
            </div>

            {/* To Review Toggle */}
            <button
              onClick={() => {
                const turningOn = !showUncategorized;
                setShowUncategorized(turningOn);
                if (turningOn) setSelectedCategoryFilter('all');
              }}
              className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                showUncategorized
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  : 'bg-[var(--rw-raised)] text-[var(--rw-ink)] border border-[var(--rw-border)] hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              {language === 'pt' ? 'Sem categoria' : 'Uncategorized'}
              {uncategorizedCount > 0 && (
                <span className={`ml-auto px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  showUncategorized
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-[var(--rw-track)] text-[var(--rw-ink)]'
                }`}>
                  {uncategorizedCount}
                </span>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {/* Bank Filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Banco' : 'Bank'}
                </label>
                <select
                  value={selectedBankFilter}
                  onChange={(e) => setSelectedBankFilter(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                >
                  <option value="all">{language === 'pt' ? 'Todos os bancos' : 'All banks'} ({bankScope.length})</option>
                  <option value="cash">{language === 'pt' ? 'Dinheiro (sem banco)' : 'Cash (no bank)'} ({bankScope.filter((t) => bankMatch(t, 'cash')).length})</option>
                  {availableBanks.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.icon} {bank.name} ({bankScope.filter((t) => bankMatch(t, bank.id)).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Forma de Pagamento' : 'Payment Method'}
                </label>
                <select
                  value={selectedPaymentMethodFilter}
                  onChange={(e) => setSelectedPaymentMethodFilter(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                >
                  <option value="all">{language === 'pt' ? 'Todos' : 'All'} ({paymentScope.length})</option>
                  {[['credit', '💳 ' + PAYMENT_LABELS.credit], ['debit', '🏦 ' + PAYMENT_LABELS.debit], ['pix', '⚡ PIX'], ['transfer', '↔️ ' + PAYMENT_LABELS.transfer], ['cash', '💵 ' + PAYMENT_LABELS.cash]].map(([value, label]) => (
                    <option key={value} value={value}>{label} ({paymentScope.filter((t) => paymentMatch(t, value)).length})</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-2 uppercase tracking-wide">
                  {t('charts.category')}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className={`flex-1 pl-3 pr-10 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent ${
                      selectedCategoryFilter !== 'all'
                        ? 'bg-[var(--rw-brand-soft)] border-violet-200 dark:border-violet-800 text-[var(--rw-brand-ink)]'
                        : 'bg-[var(--rw-raised)] border-[var(--rw-border)] text-[var(--rw-ink)]'
                    }`}
                  >
                    <option value="all">{language === 'pt' ? 'Todas' : 'All'} ({categoryScope.length})</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat} ({categoryCounts.get(cat) || 0})</option>
                    ))}
                  </select>
                  {selectedCategoryFilter !== 'all' && (
                    <button
                      onClick={() => setSelectedCategoryFilter('all')}
                      className="p-2.5 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordenar por' : 'Sort by'}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                >
                  <option value="date">{language === 'pt' ? 'Data' : 'Date'}</option>
                  <option value="description">{language === 'pt' ? 'Descrição' : 'Description'}</option>
                  <option value="amount">{language === 'pt' ? 'Valor' : 'Amount'}</option>
                  <option value="createdAt">{language === 'pt' ? 'Data de Inserção' : 'Date of Insertion'}</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-medium text-[var(--rw-muted)] mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordem' : 'Order'}
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-lg text-sm text-[var(--rw-ink)] focus:ring-2 focus:ring-[var(--rw-brand)] focus:border-transparent"
                >
                  <option value="desc">{language === 'pt' ? 'Mais recente' : 'Newest first'}</option>
                  <option value="asc">{language === 'pt' ? 'Mais antigo' : 'Oldest first'}</option>
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setViewMode('payment');
                  setSelectedBankFilter('all');
                  setSelectedPaymentMethodFilter('all');
                  setSelectedCategoryFilter('all');
                  setShowUncategorized(false);
                }}
                className="w-full py-2 text-sm font-medium text-[var(--rw-brand-ink)] hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
              >
                {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Transactions List */}
        <div className="rw-card p-3 sm:p-5">
{displayMode === 'charts' ? (
            <Suspense fallback={<div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--rw-brand)] border-t-transparent" /></div>}>
              <ExpensesChartsView
                transactions={filteredTransactions}
                language={language}
                onCategoryClick={(cat) => { setSelectedCategoryFilter(cat); setShowFilters(true); setDisplayMode('list'); }}
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
