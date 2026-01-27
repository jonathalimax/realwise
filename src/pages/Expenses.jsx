import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import TransactionList from '../components/TransactionList';
import TransactionModal from '../components/TransactionModal';
import MonthSelector from '../components/MonthSelector';
import { XMarkIcon, AdjustmentsHorizontalIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function ExpensesPage() {
  const { t, language, categories } = useSettings();
  const { ownerId, canWrite } = useAccess();
  const { userBanks, getBankInfo, getPaymentMonthKey } = useCards();

  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState('payment');
  const [selectedBankFilter, setSelectedBankFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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
          if (t.bankId !== selectedBankFilter) return false;
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
        const paymentKey = getPaymentMonthKey(t.date, t.bankId);
        return paymentKey === selectedMonth;
      }
    });
  }, [transactions, selectedMonth, viewMode, selectedBankFilter, getPaymentMonthKey]);

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
    return userBanks.map(ub => getBankInfo(ub.bankId));
  }, [userBanks, getBankInfo]);

  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  const activeFiltersCount = [
    viewMode !== 'payment',
    selectedBankFilter !== 'all',
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
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Saída' : 'Expenses'}
            </h1>
            {canWrite && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="hidden sm:inline">{language === 'pt' ? 'Nova Saída' : 'New Expense'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Summary Card */}
        <div className="mb-4 sm:mb-6 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg">
          <p className="text-sm text-white/80 mb-1">
            {language === 'pt' ? 'Total de Saída' : 'Total Expenses'}
          </p>
          <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(totalExpenses)}</p>
          <p className="text-sm text-white/70 mt-1">
            {filteredTransactions.length} {language === 'pt' ? 'transações' : 'transactions'}
          </p>
        </div>

        {/* Month Selector + Filters */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2">
            <MonthSelector
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onMonthChange={setSelectedMonth}
              locale={locale}
            />

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  setSelectedCategoryFilter('all');
                }}
                className="w-full py-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
              >
                {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {getMonthLabel(selectedMonth)}
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
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
        defaultType="expense"
      />
    </div>
  );
}
