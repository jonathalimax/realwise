import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useMonth } from '../contexts/MonthContext';
import TransactionList from '../components/TransactionList';
import { XMarkIcon, FunnelIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';

export default function TransactionsPage() {
  const { t, language, categories } = useSettings();
  const { ownerId } = useAccess();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank, getPaymentMonthKey } = useCards();
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get highlight ID from URL params
  const highlightId = searchParams.get('highlight');

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

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  useEffect(() => {
    if (!auth.currentUser || !ownerId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(data);
    });

    return () => unsubscribe();
  }, [refreshKey, ownerId]);

  const availableMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    const now = new Date();
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    return Array.from(months).sort().reverse();
  }, [transactions]);

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
    let result = monthlyTransactions;
    if (showUncategorized) {
      result = result.filter(t => !t.category);
    } else if (selectedCategoryFilter !== 'all') {
      result = result.filter(t => t.category === selectedCategoryFilter);
    }
    return result;
  }, [monthlyTransactions, selectedCategoryFilter, showUncategorized]);

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

  const goToPreviousMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    }
  };

  const goToNextMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    }
  };

  const canGoPrevious = availableMonths.indexOf(selectedMonth) < availableMonths.length - 1;
  const canGoNext = availableMonths.indexOf(selectedMonth) > 0;

  const uncategorizedCount = useMemo(() => {
    return monthlyTransactions.filter(t => !t.category).length;
  }, [monthlyTransactions]);

  const activeFiltersCount = [
    viewMode !== 'payment',
    selectedBankFilter !== 'all',
    selectedPaymentMethodFilter !== 'all',
    selectedCategoryFilter !== 'all',
    showUncategorized
  ].filter(Boolean).length;

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {t('transactionList.title')}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Month Selector + Filters */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2">
            {/* Month Selector */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={goToPreviousMonth}
                disabled={!canGoPrevious}
                className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-all flex-shrink-0"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 pl-3 pr-8 py-2 bg-white dark:bg-gray-800 rounded-xl font-semibold text-sm text-gray-900 dark:text-white border-0 shadow-sm focus:ring-2 focus:ring-violet-500 cursor-pointer text-center capitalize"
              >
                {availableMonths.map(month => (
                  <option key={month} value={month} className="capitalize">
                    {getMonthLabel(month)}
                  </option>
                ))}
              </select>

              <button
                onClick={goToNextMonth}
                disabled={!canGoNext}
                className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-all flex-shrink-0"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl shadow-sm transition-all flex-shrink-0 ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-violet-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              <span className="font-medium text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
              {activeFiltersCount > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  showFilters ? 'bg-white/20' : 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400'
                }`}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm space-y-3 sm:space-y-4">
            {/* View Mode Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {language === 'pt' ? 'Visualizar por' : 'View by'}
              </label>
              <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <button
                  onClick={() => setViewMode('purchase')}
                  className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    viewMode === 'purchase'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t('cards.viewByPurchase')}
                </button>
                <button
                  onClick={() => setViewMode('payment')}
                  className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    viewMode === 'payment'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
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
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              {language === 'pt' ? 'A Categorizar' : 'To Review'}
              {uncategorizedCount > 0 && (
                <span className={`ml-auto px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  showUncategorized
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {uncategorizedCount}
                </span>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              {/* Bank Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Banco' : 'Bank'}
                </label>
                <select
                  value={selectedBankFilter}
                  onChange={(e) => setSelectedBankFilter(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Forma de Pagamento' : 'Payment Method'}
                </label>
                <select
                  value={selectedPaymentMethodFilter}
                  onChange={(e) => setSelectedPaymentMethodFilter(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {t('charts.category')}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className={`flex-1 pl-3 pr-10 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent ${
                      selectedCategoryFilter !== 'all'
                        ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white'
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordenar por' : 'Sort by'}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  <option value="date">{language === 'pt' ? 'Data' : 'Date'}</option>
                  <option value="description">{language === 'pt' ? 'Descrição' : 'Description'}</option>
                  <option value="amount">{language === 'pt' ? 'Valor' : 'Amount'}</option>
                  <option value="createdAt">{language === 'pt' ? 'Data de Inserção' : 'Date of Insertion'}</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordem' : 'Order'}
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                className="w-full py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
              >
                {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white capitalize">
              {getMonthLabel(selectedMonth)}
            </h3>
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {filteredTransactions.length} {language === 'pt' ? 'itens' : 'items'}
            </span>
          </div>
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
      <PageHelp
        title="Transações"
        text="Registre e filtre suas movimentações. Categorize cada transação para acompanhar onde seu dinheiro vai. Use o + para adicionar manualmente ou importe um extrato."
        hasFab={false}
      />
    </div>
  );
}
