import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import { useMonth } from '../contexts/MonthContext';
import TransactionList from '../components/TransactionList';
import TransactionModal from '../components/TransactionModal';
import PageHeader from '../components/PageHeader';
import { AdjustmentsHorizontalIcon, PlusIcon, ListBulletIcon, ChartPieIcon } from '@heroicons/react/24/outline';

const ExpensesChartsView = lazy(() => import('../components/expenses/ExpensesChartsView'));

export default function ExpensesPage() {
  const { t, language } = useSettings();
  const { ownerId, canWrite } = useAccess();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank, getPaymentMonthKey } = useCards();
  const { selectedMonth } = useMonth();

  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('expenses_viewMode') ?? 'payment');
  const [selectedBankFilter, setSelectedBankFilter] = useState(() => sessionStorage.getItem('expenses_bankFilter') ?? 'all');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState(() => sessionStorage.getItem('expenses_paymentMethodFilter') ?? 'all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(() => sessionStorage.getItem('expenses_categoryFilter') ?? 'all');
  const [sortBy, setSortBy] = useState(() => sessionStorage.getItem('expenses_sortBy') ?? 'date');
  const [sortOrder, setSortOrder] = useState(() => sessionStorage.getItem('expenses_sortOrder') ?? 'desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [displayMode, setDisplayMode] = useState(() => sessionStorage.getItem('expenses_displayMode') ?? 'charts');

  const handleSetDisplayMode = (v) => { sessionStorage.setItem('expenses_displayMode', v); setDisplayMode(v); };

  const handleSetViewMode = (v) => { sessionStorage.setItem('expenses_viewMode', v); setViewMode(v); };
  const handleSetBankFilter = (v) => { sessionStorage.setItem('expenses_bankFilter', v); setSelectedBankFilter(v); };
  const handleSetPaymentMethodFilter = (v) => { sessionStorage.setItem('expenses_paymentMethodFilter', v); setSelectedPaymentMethodFilter(v); };
  const handleSetCategoryFilter = (v) => { sessionStorage.setItem('expenses_categoryFilter', v); setSelectedCategoryFilter(v); };
  const handleSetSortBy = (v) => { sessionStorage.setItem('expenses_sortBy', v); setSortBy(v); };
  const handleSetSortOrder = (v) => { sessionStorage.setItem('expenses_sortOrder', v); setSortOrder(v); };

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  useEffect(() => {
    if (!auth.currentUser || !ownerId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId),
      where('type', '==', 'expense')
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
        if (t.investmentId) {
          return transactionMonthKey === selectedMonth;
        }
        const paymentKey = getPaymentMonthKey(t.date, t.bankId, t.paymentMethod);
        return paymentKey === selectedMonth;
      }
    });
  }, [transactions, selectedMonth, viewMode, selectedBankFilter, selectedPaymentMethodFilter, findUserBank, getPaymentMonthKey]);

  const filteredTransactions = useMemo(() => {
    if (selectedCategoryFilter === 'all') {
      return monthlyTransactions;
    }
    return monthlyTransactions.filter(t => t.category === selectedCategoryFilter);
  }, [monthlyTransactions, selectedCategoryFilter]);

  const totalExpenses = useMemo(() => {
    return filteredTransactions
      .filter(t => !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const availableCategories = useMemo(() => {
    const cats = new Set();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  const availableBanks = useMemo(() => {
    return userBanks.map(ub => {
      const bankInfo = getBankInfo(ub.bankId);
      return {
        id: ub.id,
        bankId: ub.bankId,
        name: getBankDisplayName(ub),
        icon: bankInfo.icon
      };
    });
  }, [userBanks, getBankInfo, getBankDisplayName]);

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const activeFiltersCount = [
    viewMode !== 'payment',
    selectedBankFilter !== 'all',
    selectedPaymentMethodFilter !== 'all',
    selectedCategoryFilter !== 'all'
  ].filter(Boolean).length;

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={language === 'pt' ? 'Saída' : 'Expenses'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Summary Card */}
        <div className="mb-6 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-sm text-white/80 mb-1">{language === 'pt' ? 'Total de Saída' : 'Total Expenses'}</p>
          <p className="text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
          <p className="text-sm text-white/70 mt-1">{filteredTransactions.length} {language === 'pt' ? 'transações' : 'transactions'}</p>
        </div>

        {/* Transactions List Container */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
              {getMonthLabel(selectedMonth)}
            </h3>

            {/* List / Charts segmented toggle */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
              <button
                onClick={() => handleSetDisplayMode('list')}
                aria-label={language === 'pt' ? 'Lista' : 'List'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  displayMode === 'list'
                    ? 'bg-white dark:bg-slate-600 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ListBulletIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'pt' ? 'Lista' : 'List'}</span>
              </button>
              <button
                onClick={() => handleSetDisplayMode('charts')}
                aria-label={language === 'pt' ? 'Gráficos' : 'Charts'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  displayMode === 'charts'
                    ? 'bg-white dark:bg-slate-600 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ChartPieIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'pt' ? 'Gráficos' : 'Charts'}</span>
              </button>
            </div>
          </div>

          {/* Display mode: show charts OR list (not both) */}
          {displayMode === 'charts' ? (
            <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" /></div>}>
              <ExpensesChartsView
                transactions={filteredTransactions}
                formatCurrency={formatCurrency}
                language={language}
              />
            </Suspense>
          ) : (
            <>{/* Filters Panel — only shown in list mode */}
          {showFilters && (
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">
                  {language === 'pt' ? 'Visualizar por' : 'View by'}
                </label>
                <div className="flex p-1 bg-slate-200/50 dark:bg-slate-700 rounded-xl max-w-xs">
                  <button
                    onClick={() => handleSetViewMode('purchase')}
                    className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'purchase' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {t('cards.viewByPurchase')}
                  </button>
                  <button
                    onClick={() => handleSetViewMode('payment')}
                    className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      viewMode === 'payment' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {t('cards.viewByPayment')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Bank */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{language === 'pt' ? 'Banco' : 'Bank'}</label>
                  <select
                    value={selectedBankFilter}
                    onChange={(e) => handleSetBankFilter(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="all">{language === 'pt' ? 'Todos' : 'All'}</option>
                    <option value="cash">{language === 'pt' ? 'Dinheiro' : 'Cash'}</option>
                    {availableBanks.map(bank => <option key={bank.id} value={bank.id}>{bank.icon} {bank.name}</option>)}
                  </select>
                </div>

                {/* Method */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{language === 'pt' ? 'Pagamento' : 'Method'}</label>
                  <select
                    value={selectedPaymentMethodFilter}
                    onChange={(e) => handleSetPaymentMethodFilter(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="all">{language === 'pt' ? 'Todos' : 'All'}</option>
                    <option value="credit">💳 {language === 'pt' ? 'Crédito' : 'Credit'}</option>
                    <option value="debit">🏦 {language === 'pt' ? 'Débito' : 'Debit'}</option>
                    <option value="pix">⚡ PIX</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{t('charts.category')}</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => handleSetCategoryFilter(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="all">{language === 'pt' ? 'Todas' : 'All'}</option>
                    {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{language === 'pt' ? 'Ordenar' : 'Sort'}</label>
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => handleSetSortBy(e.target.value)}
                      className="flex-1 pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="date">{language === 'pt' ? 'Data' : 'Date'}</option>
                      <option value="amount">{language === 'pt' ? 'Valor' : 'Amount'}</option>
                    </select>
                    <button
                      onClick={() => handleSetSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl"
                    >
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                  </div>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={() => {
                    handleSetViewMode('payment');
                    handleSetBankFilter('all');
                    handleSetPaymentMethodFilter('all');
                    handleSetCategoryFilter('all');
                  }}
                  className="w-full py-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
                </button>
              )}
            </div>
          )}

          <TransactionList
            transactions={filteredTransactions}
            selectedMonth={selectedMonth}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSuccess={triggerRefresh}
            hideBulkEdit={true}
            filterButton={
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                <span className="font-bold text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
                {activeFiltersCount > 0 && (
                  <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full ${
                    showFilters ? 'bg-white text-violet-600' : 'bg-violet-600 text-white'
                  }`}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            }
          />
          </>
            )}

        </div>
      </main>

      <TransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultType="expense"
      />

      {canWrite && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl shadow-xl shadow-violet-600/20 flex items-center justify-center transition-all active:scale-90"
        >
          <PlusIcon className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
