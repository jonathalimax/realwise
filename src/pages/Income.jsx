import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useMonth } from '../contexts/MonthContext';
import TransactionList from '../components/TransactionList';
import TransactionModal from '../components/TransactionModal';
import PageHeader from '../components/PageHeader';
import { XMarkIcon, AdjustmentsHorizontalIcon, PlusIcon } from '@heroicons/react/24/outline';

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={language === 'pt' ? 'Entrada' : 'Income'} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Summary Card */}

        <div className="mb-4 sm:mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg">
          <p className="text-sm text-white/80 mb-1">
            {language === 'pt' ? 'Total de Entrada' : 'Total Income'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(totalIncome)}</p>
          <p className="text-sm text-white/70 mt-1">
            {filteredTransactions.length} {language === 'pt' ? 'transações' : 'transactions'}
          </p>
        </div>

        {/* Filters */}
        <div className="flex justify-end mb-4 sm:mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl shadow-sm transition-all ${
              showFilters || activeFiltersCount > 0
                ? 'bg-emerald-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            <span className="font-medium text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
            {activeFiltersCount > 0 && (
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                showFilters ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
              }`}>
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {t('charts.category')}
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => handleSetCategoryFilter(e.target.value)}
                    className={`flex-1 pl-3 pr-10 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                      selectedCategoryFilter !== 'all'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
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
                      onClick={() => handleSetCategoryFilter('all')}
                      className="p-2.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg"
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
                  onChange={(e) => handleSetSortBy(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="date">{language === 'pt' ? 'Data' : 'Date'}</option>
                  <option value="description">{language === 'pt' ? 'Descrição' : 'Description'}</option>
                  <option value="amount">{language === 'pt' ? 'Valor' : 'Amount'}</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {language === 'pt' ? 'Ordem' : 'Order'}
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => handleSetSortOrder(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="desc">{language === 'pt' ? 'Mais recente' : 'Newest first'}</option>
                  <option value="asc">{language === 'pt' ? 'Mais antigo' : 'Oldest first'}</option>
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  handleSetCategoryFilter('all');
                }}
                className="w-full py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
              >
                {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white capitalize">
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
          />
        </div>
      </main>

      {/* Add Transaction Modal */}
      <TransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultType="income"
      />

      {/* FAB */}
      {canWrite && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label={language === 'pt' ? 'Nova Entrada' : 'New Income'}
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      )}
    </div>
  );
}
