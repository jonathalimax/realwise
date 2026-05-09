import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useMonth } from '../contexts/MonthContext';
import TransactionList from '../components/TransactionList';
import TransactionModal from '../components/TransactionModal';
import PageHeader from '../components/PageHeader';
import { AdjustmentsHorizontalIcon, PlusIcon, ListBulletIcon, ChartPieIcon } from '@heroicons/react/24/outline';

const IncomeChartsView = lazy(() => import('../components/income/IncomeChartsView'));

export default function IncomePage() {
  const { t, language } = useSettings();
  const { ownerId, canWrite } = useAccess();
  const { selectedMonth } = useMonth();

  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(() => sessionStorage.getItem('income_categoryFilter') ?? 'all');
  const [sortBy, setSortBy] = useState(() => sessionStorage.getItem('income_sortBy') ?? 'date');
  const [sortOrder, setSortOrder] = useState(() => sessionStorage.getItem('income_sortOrder') ?? 'desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [displayMode, setDisplayMode] = useState(() => sessionStorage.getItem('income_displayMode') ?? 'charts');

  const handleSetDisplayMode = (v) => { sessionStorage.setItem('income_displayMode', v); setDisplayMode(v); };
  const handleSetCategoryFilter = (v) => { sessionStorage.setItem('income_categoryFilter', v); setSelectedCategoryFilter(v); };
  const handleSetSortBy = (v) => { sessionStorage.setItem('income_sortBy', v); setSortBy(v); };
  const handleSetSortOrder = (v) => { sessionStorage.setItem('income_sortOrder', v); setSortOrder(v); };

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  useEffect(() => {
    if (!auth.currentUser || !ownerId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId),
      where('type', '==', 'income')
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
      const date = new Date(t.date);
      const transactionMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return transactionMonthKey === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    if (selectedCategoryFilter === 'all') {
      return monthlyTransactions;
    }
    return monthlyTransactions.filter(t => t.category === selectedCategoryFilter);
  }, [monthlyTransactions, selectedCategoryFilter]);

  const totalIncome = useMemo(() => {
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

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const activeFiltersCount = [
    selectedCategoryFilter !== 'all'
  ].filter(Boolean).length;

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(amount);
  };

  const filterButton = (
    <button
      onClick={() => setShowFilters(!showFilters)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
        showFilters || activeFiltersCount > 0
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      <AdjustmentsHorizontalIcon className="w-5 h-5" />
      <span className="font-bold text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
      {activeFiltersCount > 0 && (
        <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-full ${
          showFilters ? 'bg-white text-emerald-600' : 'bg-emerald-600 text-white'
        }`}>
          {activeFiltersCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={language === 'pt' ? 'Entrada' : 'Income'} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Summary Card */}
        <div className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-sm text-white/80 mb-1">{language === 'pt' ? 'Total de Entrada' : 'Total Income'}</p>
          <p className="text-3xl font-bold">{formatCurrency(totalIncome)}</p>
          <p className="text-sm text-white/70 mt-1">{filteredTransactions.length} {language === 'pt' ? 'transações' : 'transactions'}</p>
        </div>

        {/* Transactions Container */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          {/* Header row: month label + filter button + segmented toggle */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
              {getMonthLabel(selectedMonth)}
            </h3>

            <div className="flex items-center gap-2">
              {/* Filter toggle — visible in both modes */}
              {filterButton}

              {/* List / Charts segmented toggle */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                <button
                  onClick={() => handleSetDisplayMode('list')}
                  aria-label={language === 'pt' ? 'Lista' : 'List'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    displayMode === 'list'
                      ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm'
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
                      ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <ChartPieIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === 'pt' ? 'Gráficos' : 'Charts'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel — visible for BOTH chart and list views */}
          {showFilters && (
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{t('charts.category')}</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => handleSetCategoryFilter(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">{language === 'pt' ? 'Todas' : 'All'}</option>
                    {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{language === 'pt' ? 'Ordenar' : 'Sort'}</label>
                  <select
                    value={sortBy}
                    onChange={(e) => handleSetSortBy(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="date">{language === 'pt' ? 'Data' : 'Date'}</option>
                    <option value="amount">{language === 'pt' ? 'Valor' : 'Amount'}</option>
                  </select>
                </div>

                {/* Order */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-widest">{language === 'pt' ? 'Ordem' : 'Order'}</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => handleSetSortOrder(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="desc">{language === 'pt' ? 'Mais recente' : 'Newest first'}</option>
                    <option value="asc">{language === 'pt' ? 'Mais antigo' : 'Oldest first'}</option>
                  </select>
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={() => handleSetCategoryFilter('all')}
                  className="w-full py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
                </button>
              )}
            </div>
          )}

          {/* Content: Charts OR List */}
          {displayMode === 'charts' ? (
            <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full" /></div>}>
              <IncomeChartsView
                transactions={filteredTransactions}
                formatCurrency={formatCurrency}
                language={language}
              />
            </Suspense>
          ) : (
            <TransactionList
              transactions={filteredTransactions}
              selectedMonth={selectedMonth}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSuccess={triggerRefresh}
              hideBulkEdit={true}
            />
          )}
        </div>
      </main>

      <TransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultType="income"
      />

      {canWrite && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-xl shadow-emerald-600/20 flex items-center justify-center transition-all active:scale-90"
        >
          <PlusIcon className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
