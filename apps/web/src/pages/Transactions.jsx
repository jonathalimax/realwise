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
import PageHeader from '../components/PageHeader';
import AddTransactionSheet from '../components/AddTransactionSheet';

export default function TransactionsPage() {
  const { t, language, categories, formatCurrency } = useSettings();
  const { ownerId } = useAccess();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank, getPaymentMonthKey } = useCards();
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { transactions } = useTransactions({}, { enabled: Boolean(ownerId) });

  // Get highlight ID from URL params
  const highlightId = searchParams.get('highlight');
  // Coming from an import summary: show only that import's rows (any month) so each one can be left out of the totals.
  const importFilter = searchParams.get('import');

  // Handle month and category params from URL (for deep linking)
  useEffect(() => {
    const monthParam = searchParams.get('month');
    if (monthParam && monthParam !== selectedMonth) {
      setSelectedMonth(monthParam);
    }
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategoryFilter(categoryParam);
      setShowFilters(true); // Show filters panel when category is pre-selected
    }
  }, [searchParams]);
  const [viewMode, setViewMode] = useState('payment');
  const [selectedBankFilter, setSelectedBankFilter] = useState('all');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const monthlyTransactions = useMemo(() => {
    if (!selectedMonth) return transactions;

    return transactions.filter(t => {
      if (selectedBankFilter !== 'all') {
        if (selectedBankFilter === 'cash') {
          if (t.bankId) return false;
        } else {
          const matchesDirectly = t.bankId === selectedBankFilter;
          const transactionUserBank = findUserBank(t.bankId);
          const matchesViaLookup = transactionUserBank && transactionUserBank.id === selectedBankFilter;

          if (!matchesDirectly && !matchesViaLookup) return false;
        }
      }

      if (selectedPaymentMethodFilter !== 'all') {
        if (selectedPaymentMethodFilter === 'cash') {
          if (t.bankId) return false;
        } else {
          const method = t.paymentMethod || 'credit';
          if (method !== selectedPaymentMethodFilter) return false;
          if (!t.bankId) return false;
        }
      }

      const date = new Date(t.date);
      const transactionMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (viewMode === 'purchase') {
        return transactionMonthKey === selectedMonth;
      } else {
        if (t.type === 'income') {
          return transactionMonthKey === selectedMonth;
        }
        if (t.investmentId) {
          return transactionMonthKey === selectedMonth;
        }
        const paymentKey = getPaymentMonthKey(t.date, t.bankId, t.paymentMethod);
        return paymentKey === selectedMonth;
      }
    });
  }, [transactions, selectedMonth, viewMode, selectedBankFilter, selectedPaymentMethodFilter, findUserBank, getPaymentMonthKey]);

  const filteredTransactions = useMemo(() => {
    if (importFilter) {
      return transactions.filter(t => t.importId === importFilter && (typeFilter === 'all' || t.type === typeFilter));
    }
    let result = typeFilter === 'all' ? monthlyTransactions : monthlyTransactions.filter(t => t.type === typeFilter);
    if (showUncategorized) {
      result = result.filter(t => t.category === 'Sem categoria');
    } else if (selectedCategoryFilter !== 'all') {
      result = result.filter(t => t.category === selectedCategoryFilter);
    }
    return result;
  }, [monthlyTransactions, transactions, importFilter, selectedCategoryFilter, showUncategorized, typeFilter]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of monthlyTransactions) {
      if (t.ignored) continue;
      if (t.type === 'income') income += t.amount; else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [monthlyTransactions]);

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

  const uncategorizedCount = useMemo(() => {
    return monthlyTransactions.filter(t => t.category === 'Sem categoria').length;
  }, [monthlyTransactions]);

  const activeFiltersCount = [
    viewMode !== 'payment',
    selectedBankFilter !== 'all',
    selectedPaymentMethodFilter !== 'all',
    selectedCategoryFilter !== 'all',
    showUncategorized
  ].filter(Boolean).length;

  const triggerRefresh = () => {};

  return (
    <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
      <PageHeader title={language === 'pt' ? 'Movimentos' : 'Activity'} right={(
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          aria-label={language === 'pt' ? 'Adicionar movimento' : 'Add entry'}
          className="w-9 h-9 rounded-full bg-[var(--rw-brand)] text-white flex items-center justify-center"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      )} />

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
        <section className="rw-hero rw-hero-violet flex flex-col gap-1 p-5 mb-3" aria-label={language === 'pt' ? 'Total do mês' : 'Month total'}>
          <span className="rw-eyebrow text-violet-300">{getMonthLabel(selectedMonth).toUpperCase()}</span>
          <span className="rw-num text-[44px] font-extrabold leading-[48px]">{totals.net >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(totals.net)).replace(/,00(?=\D*$)/, '')}</span>
          <span className="text-[15px] text-violet-100">
            {totals.net >= 0
              ? (language === 'pt' ? 'entrou mais do que saiu neste mês' : 'more came in than went out this month')
              : (language === 'pt' ? 'saiu mais do que entrou neste mês' : 'more went out than came in this month')}
          </span>
        </section>

        <div className="flex p-[3px] gap-0.5 rounded-[14px] bg-[var(--rw-raised)] mb-3" role="tablist" aria-label={language === 'pt' ? 'Filtrar por tipo' : 'Filter by type'}>
          {[['all', language === 'pt' ? 'Tudo' : 'All'], ['income', language === 'pt' ? 'Entradas' : 'In'], ['expense', language === 'pt' ? 'Saídas' : 'Out']].map(([key, label]) => (
            <button key={key} role="tab" aria-selected={typeFilter === key} onClick={() => setTypeFilter(key)}
              className={`flex-1 h-[38px] rounded-[11px] text-sm font-semibold ${typeFilter === key ? 'bg-[var(--rw-brand-soft)] text-[var(--rw-brand-ink)]' : 'text-[var(--rw-muted)]'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-[var(--rw-subtle)]">{filteredTransactions.length} {language === 'pt' ? 'itens' : 'items'}</span>
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
                  <option value="all">{language === 'pt' ? 'Todos os bancos' : 'All banks'}</option>
                  <option value="cash">{language === 'pt' ? 'Dinheiro (sem banco)' : 'Cash (no bank)'}</option>
                  {availableBanks.map(bank => (
                    <option key={bank.id} value={bank.id}>
                      {bank.icon} {bank.name}
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
                  <option value="all">{language === 'pt' ? 'Todos' : 'All'}</option>
                  <option value="credit">{language === 'pt' ? '💳 Crédito' : '💳 Credit'}</option>
                  <option value="debit">{language === 'pt' ? '🏦 Débito' : '🏦 Debit'}</option>
                  <option value="pix">⚡ PIX</option>
                  <option value="transfer">{language === 'pt' ? '↔️ Transferência' : '↔️ Transfer'}</option>
                  <option value="cash">{language === 'pt' ? '💵 Dinheiro' : '💵 Cash'}</option>
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
                    <option value="all">{language === 'pt' ? 'Todas' : 'All'}</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
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
          <TransactionList
            transactions={filteredTransactions}
            selectedMonth={selectedMonth}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSuccess={triggerRefresh}
            highlightId={highlightId}
          />
        </div>
      </main>
      {showAdd && <AddTransactionSheet onClose={() => setShowAdd(false)} />}
      <PageHelp
        title="Transações"
        text="Registre e filtre suas movimentações. Categorize cada transação para acompanhar onde seu dinheiro vai. Use o + para adicionar manualmente ou importe um extrato."
        hasFab={false}
      />
    </div>
  );
}
