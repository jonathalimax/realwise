import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useCards, CARD_ICONS } from '../contexts/CardsContext';
import { useBudget } from '../contexts/BudgetContext';
import BalanceSummary from './BalanceSummary';
import TransactionList from './TransactionList';
import SettingsModal from './SettingsModal';
import ImportModal from './ImportModal';
import GoalsModal from './GoalsModal';
import CardsModal from './CardsModal';
import BudgetModal from './BudgetModal';
import TransactionModal from './TransactionModal';
import GoalProgress from './GoalProgress';
import RuleComparison from './RuleComparison';
import SpendingChart from './charts/SpendingChart';
import TrendChart from './charts/TrendChart';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function Dashboard() {
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState('purchase'); // 'purchase' or 'payment'
  const [selectedCardFilter, setSelectedCardFilter] = useState('all'); // 'all', 'cash', or cardId
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all'); // 'all' or category name
  const { t, language, darkMode, toggleDarkMode, categories } = useSettings();
  const { cards, getCardById, getPaymentMonthKey } = useCards();
  const { loading: budgetLoading } = useBudget();

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(data);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Get available months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set();
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(key);
    });
    // Add current month if not present
    const now = new Date();
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // Filter transactions by selected month, view mode, card, and category
  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return transactions;

    return transactions.filter(t => {
      // Filter by card
      if (selectedCardFilter !== 'all') {
        if (selectedCardFilter === 'cash') {
          if (t.cardId) return false;
        } else {
          if (t.cardId !== selectedCardFilter) return false;
        }
      }

      // Filter by category
      if (selectedCategoryFilter !== 'all') {
        if (t.category !== selectedCategoryFilter) return false;
      }

      // Filter by month based on view mode
      if (viewMode === 'purchase') {
        // Filter by purchase/transaction date
        const date = new Date(t.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedMonth;
      } else {
        // Filter by payment month
        const card = t.cardId ? getCardById(t.cardId) : null;
        const paymentKey = getPaymentMonthKey(t.date, card);
        return paymentKey === selectedMonth;
      }
    });
  }, [transactions, selectedMonth, viewMode, selectedCardFilter, selectedCategoryFilter, getCardById, getPaymentMonthKey]);

  // Get unique categories from current month's transactions for filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Calculate total income for the filtered transactions
  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  // Get expense categories for budget modal
  const expenseCategories = useMemo(() => {
    return categories.expense || [];
  }, [categories]);

  // Handle category click from chart
  const handleCategoryClick = (category) => {
    setSelectedCategoryFilter(prev => prev === category ? 'all' : category);
  };

  // Get month label
  const getMonthLabel = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  };

  // Navigate months
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">Limas Finance</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCards(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <span className="text-lg">{CARD_ICONS.credit}</span>
                {t('cards.title')}
              </button>

              <button
                onClick={() => setShowBudget(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t('budget.title')}
              </button>

              <button
                onClick={() => setShowImport(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t('dashboard.import')}
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
                title={t('settings.title')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <span className="hidden sm:inline">{t('dashboard.signOut')}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Month Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">
            {t('auth.welcomeBack')}
          </h1>

          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button
              onClick={goToPreviousMonth}
              disabled={!canGoPrevious}
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 rounded-lg font-medium text-gray-900 dark:text-white border-0 focus:ring-0 cursor-pointer min-w-[180px] text-center capitalize"
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
              className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* View Mode Toggle and Card Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* View Mode Toggle */}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setViewMode('purchase')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'purchase'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t('cards.viewByPurchase')}
            </button>
            <button
              onClick={() => setViewMode('payment')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'payment'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t('cards.viewByPayment')}
            </button>
          </div>

          {/* Card Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('cards.filterByCard')}:</span>
            <select
              value={selectedCardFilter}
              onChange={(e) => setSelectedCardFilter(e.target.value)}
              className="px-4 py-2 pr-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none appearance-none bg-no-repeat bg-right"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
            >
              <option value="all">{t('cards.allCards')}</option>
              <option value="cash">{t('cards.cashNoCard')}</option>
              {cards.map(card => (
                <option key={card.id} value={card.id}>
                  {card.name} {card.lastDigits ? `****${card.lastDigits}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('charts.category')}:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className={`px-4 py-2 pr-8 border rounded-xl text-sm focus:ring-0 focus:outline-none appearance-none bg-no-repeat bg-right ${
                selectedCategoryFilter !== 'all'
                  ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
              } focus:border-gray-900 dark:focus:border-gray-500`}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
            >
              <option value="all">{language === 'pt' ? 'Todas' : 'All'}</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {selectedCategoryFilter !== 'all' && (
              <button
                onClick={() => setSelectedCategoryFilter('all')}
                className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                title={language === 'pt' ? 'Limpar filtro' : 'Clear filter'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Balance Cards */}
        <BalanceSummary transactions={filteredTransactions} />

        {/* 50/30/20 Rule Comparison */}
        <div className="mt-6">
          <RuleComparison
            transactions={filteredTransactions}
            totalIncome={totalIncome}
            onConfigure={() => setShowBudget(true)}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Spending Breakdown */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('charts.spendingByCategory')}</h3>
              {selectedCategoryFilter !== 'all' && (
                <span className="text-xs px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full">
                  {selectedCategoryFilter}
                </span>
              )}
            </div>
            <SpendingChart transactions={filteredTransactions} onCategoryClick={handleCategoryClick} />
          </div>

          {/* Goals Progress */}
          <GoalProgress onManageGoals={() => setShowGoals(true)} />
        </div>

        {/* Trend Chart */}
        <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('charts.incomeVsExpenses')}</h3>
          <TrendChart transactions={transactions} />
        </div>

        {/* Transactions Section */}
        <div className="mt-6">
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('transactionList.title')}</h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ({filteredTransactions.length} {language === 'pt' ? 'transações' : 'transactions'})
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${showTransactions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTransactions && (
            <div className="mt-2">
              <TransactionList transactions={filteredTransactions} selectedMonth={selectedMonth} />
            </div>
          )}
        </div>

        {/* Floating Add Button */}
        <button
          onClick={() => setShowTransactionModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      </main>

      {/* Modals */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      <GoalsModal isOpen={showGoals} onClose={() => setShowGoals(false)} />
      <CardsModal isOpen={showCards} onClose={() => setShowCards(false)} />
      <BudgetModal
        isOpen={showBudget}
        onClose={() => setShowBudget(false)}
        currentMonth={selectedMonth}
        totalIncome={totalIncome}
        expenseCategories={expenseCategories}
      />
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
      />
    </div>
  );
}
