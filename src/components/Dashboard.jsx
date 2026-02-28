import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useBills } from '../contexts/BillsContext';
import { useCards, BANKS } from '../contexts/CardsContext';
import { useIsMobile } from '../hooks/useIsMobile';
import BalanceSummary from './BalanceSummary';
import InvestmentsListModal from './InvestmentsListModal';
import WalletCards from './WalletCards';
import BudgetCategorySection from './BudgetCategorySection';
import TransactionList from './TransactionList';
import SettingsModal from './SettingsModal';
import ImportModal from './ImportModal';
import GoalsModal from './GoalsModal';
import CardsModal from './CardsModal';
import BudgetModal from './BudgetModal';
import TransactionModal from './TransactionModal';
import InvestmentModal from './InvestmentModal';
import BillModal from './BillModal';
import GoalProgress from './GoalProgress';
import RuleComparison from './RuleComparison';
import SpendingChart from './charts/SpendingChart';
import TrendChart from './charts/TrendChart';
import BillsList from './BillsList';
import TutorialModal from './TutorialModal';
import { PlusIcon, XMarkIcon, ChevronDownIcon, FunnelIcon, AdjustmentsHorizontalIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showInvestments, setShowInvestments] = useState(false);
  const [showInvestmentsList, setShowInvestmentsList] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showFullTransactions, setShowFullTransactions] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isFirstTimeTutorial, setIsFirstTimeTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or 'details'
  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState('payment'); // Default to payment view
  const [selectedBankFilter, setSelectedBankFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'description', 'amount'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  const { t, language, darkMode, toggleDarkMode, categories, tutorialCompleted, loading: settingsLoading } = useSettings();
  const { canWrite, ownerId } = useAccess();
  const { userBanks, getBankInfo, getBankDisplayName, findUserBank, getPaymentMonthKey } = useCards();
  const { bills, loading: billsLoading } = useBills();

  // Navigation handlers for mobile
  const handleOpenSettings = () => {
    if (isMobile) navigate('/settings');
    else setShowSettings(true);
  };

  const handleOpenGoals = () => {
    if (isMobile) navigate('/goals');
    else setShowGoals(true);
  };

  const handleOpenCards = () => {
    if (isMobile) navigate('/cards');
    else setShowCards(true);
  };

  const handleOpenBudget = () => {
    if (isMobile) navigate('/budget');
    else setShowBudget(true);
  };

  const handleOpenInvestments = () => {
    if (isMobile) navigate('/investments');
    else setShowInvestments(true);
  };

  const handleOpenInvestmentsList = () => {
    if (isMobile) navigate('/investments');
    else setShowInvestmentsList(true);
  };

  const handleOpenTransactions = () => {
    if (isMobile) navigate('/transactions');
    else setShowFullTransactions(true);
  };

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Show tutorial for first-time users
  useEffect(() => {
    if (!settingsLoading && !tutorialCompleted) {
      setIsFirstTimeTutorial(true);
      setShowTutorial(true);
    }
  }, [settingsLoading, tutorialCompleted]);

  useEffect(() => {
    if (!auth.currentUser || !ownerId) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', ownerId) // Use ownerId instead of currentUser.uid
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(data);
    });

    return () => unsubscribe();
  }, [refreshKey, ownerId]); // Add ownerId to dependencies

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
      // Filter by bank - supports both new (unique doc ID) and old (bank type) formats
      if (selectedBankFilter !== 'all') {
        if (selectedBankFilter === 'cash') {
          // Show only transactions without bank
          if (t.bankId) return false;
        } else {
          // Support both new format (unique document ID) and old format (bank type ID)
          const matchesDirectly = t.bankId === selectedBankFilter;
          const transactionUserBank = findUserBank(t.bankId);
          const matchesViaLookup = transactionUserBank && transactionUserBank.id === selectedBankFilter;

          if (!matchesDirectly && !matchesViaLookup) return false;
        }
      }

      // Get the transaction date key
      const date = new Date(t.date);
      const transactionMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (viewMode === 'purchase') {
        // Purchase view: use actual transaction date for all
        return transactionMonthKey === selectedMonth;
      } else {
        // Payment view: only apply payment month logic to EXPENSES with credit card bank
        // Income transactions always use their transaction date
        if (t.type === 'income') {
          return transactionMonthKey === selectedMonth;
        }
        // Investment transactions should always use their actual date
        if (t.investmentId) {
          return transactionMonthKey === selectedMonth;
        }
        // For other expenses, use payment month calculation (considers credit card closing/payment dates)
        const paymentKey = getPaymentMonthKey(t.date, t.bankId, t.paymentMethod);
        return paymentKey === selectedMonth;
      }
    });
  }, [transactions, selectedMonth, viewMode, selectedBankFilter, findUserBank, getPaymentMonthKey]);

  const filteredTransactions = useMemo(() => {
    if (selectedCategoryFilter === 'all') {
      return monthlyTransactions;
    }
    return monthlyTransactions.filter(t => t.category === selectedCategoryFilter);
  }, [monthlyTransactions, selectedCategoryFilter]);

  const availableCategories = useMemo(() => {
    const cats = new Set();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return monthlyTransactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const expenseCategories = useMemo(() => {
    return categories.expense || [];
  }, [categories]);

  const handleCategoryClick = (category) => {
    if (isMobile) {
      // On mobile, navigate to transactions page with category filter
      navigate(`/transactions?category=${encodeURIComponent(category)}&month=${selectedMonth}`);
    } else {
      // On desktop, filter in place
      setSelectedCategoryFilter(prev => prev === category ? 'all' : category);
    }
  };

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

  const activeFiltersCount = [
    viewMode !== 'payment', // Default is payment now
    selectedBankFilter !== 'all',
    selectedCategoryFilter !== 'all'
  ].filter(Boolean).length;

  // Get available banks (user's registered banks) with unique IDs for filtering
  const availableBanks = useMemo(() => {
    return userBanks.map(ub => {
      const bankInfo = getBankInfo(ub.bankId);
      return {
        id: ub.id, // Unique document ID for filtering
        bankId: ub.bankId,
        name: getBankDisplayName(ub),
        icon: bankInfo.icon
      };
    });
  }, [userBanks, getBankInfo, getBankDisplayName]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Blim Wallet</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => { setIsFirstTimeTutorial(false); setShowTutorial(true); }}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title={language === 'pt' ? 'Ajuda' : 'Help'}
              >
                <QuestionMarkCircleIcon className="w-5 h-5" />
              </button>

              <button
                onClick={toggleDarkMode}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
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
                onClick={handleOpenSettings}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              <button
                onClick={handleSignOut}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title={t('dashboard.signOut')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>

            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Header: Month Selector + Filters */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          {/* Month Selector + Filter Button - side by side on mobile */}
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
                className="flex-1 pl-3 pr-8 py-2 bg-white dark:bg-gray-800 rounded-xl font-semibold text-sm text-gray-900 dark:text-white border-0 shadow-sm focus:ring-2 focus:ring-rose-500 cursor-pointer text-center capitalize"
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
                  ? 'bg-rose-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
              <span className="font-medium text-sm hidden sm:inline">{language === 'pt' ? 'Filtros' : 'Filters'}</span>
              {activeFiltersCount > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  showFilters ? 'bg-white/20' : 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
                }`}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel - Improved mobile layout */}
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
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent"
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
                    className={`flex-1 pl-3 pr-10 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent ${
                      selectedCategoryFilter !== 'all'
                        ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
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
                      className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg"
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
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent"
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
                  className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent"
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
                className="w-full py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
              >
                {language === 'pt' ? 'Limpar todos os filtros' : 'Clear all filters'}
              </button>
            )}
          </div>
        )}

        {/* Balance Cards - Always visible on desktop, inside tabs on mobile */}
        <div className="hidden md:block mb-4 sm:mb-6">
          <BalanceSummary transactions={monthlyTransactions} onInvestmentsClick={handleOpenInvestmentsList} />
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-1 mb-4 sm:mb-6 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'summary'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {language === 'pt' ? '📊 Resumo' : '📊 Summary'}
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'details'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {language === 'pt' ? '📋 Detalhes' : '📋 Details'}
          </button>
        </div>

        {/* Tab Content: Summary */}
        {activeTab === 'summary' && (
          <>
            {/* Balance Cards - Mobile only */}
            <div className="md:hidden mb-4">
              <BalanceSummary transactions={monthlyTransactions} onInvestmentsClick={handleOpenInvestmentsList} />
            </div>

            {/* Expenses by Category + 50/30/20 Rule Comparison - Side by side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <BudgetCategorySection
                transactions={filteredTransactions}
                selectedMonth={selectedMonth}
                onConfigure={handleOpenBudget}
                onCategoryClick={handleCategoryClick}
              />
              <RuleComparison
                transactions={monthlyTransactions}
                totalIncome={totalIncome}
                onConfigure={handleOpenBudget}
              />
            </div>

            {/* Income vs Expenses Trend Chart */}
            <div className="mt-4 sm:mt-6 bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('charts.incomeVsExpenses')}</h3>
              <TrendChart transactions={transactions} selectedMonth={selectedMonth} viewMode={viewMode} />
            </div>
          </>
        )}

        {/* Tab Content: Details */}
        {activeTab === 'details' && (
          <>
            {/* Balance Cards - Mobile only */}
            <div className="md:hidden mb-4">
              <BalanceSummary transactions={monthlyTransactions} onInvestmentsClick={handleOpenInvestmentsList} />
            </div>

            {/* 1. Transactions List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">{t('transactionList.title')}</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredTransactions.length} {language === 'pt' ? 'itens' : 'items'}
                </span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
                <TransactionList
                  transactions={filteredTransactions.slice(0, 15)}
                  selectedMonth={selectedMonth}
                  compact
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSuccess={triggerRefresh}
                />
              </div>
              {filteredTransactions.length > 15 && (
                <button
                  onClick={handleOpenTransactions}
                  className="mt-3 w-full py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                >
                  {language === 'pt' ? `Ver todos (${filteredTransactions.length})` : `See all (${filteredTransactions.length})`}
                </button>
              )}
            </div>

            {/* 2. Expenses by Category (Detailed View) */}
            <div className="mt-4 sm:mt-6">
              <BudgetCategorySection
                transactions={filteredTransactions}
                selectedMonth={selectedMonth}
                onConfigure={handleOpenBudget}
                onCategoryClick={handleCategoryClick}
              />
            </div>

            {/* 3. Goals and Bills - Mobile: stacked, Desktop: side by side */}
            <div className="mt-4 sm:mt-6">
              {/* Mobile: stacked */}
              <div className="md:hidden space-y-4">
                <GoalProgress onManageGoals={handleOpenGoals} />
                <BillsList selectedMonth={selectedMonth} />
              </div>

              {/* Desktop: side by side */}
              <div className="hidden md:grid md:grid-cols-2 gap-6">
                <GoalProgress onManageGoals={handleOpenGoals} />
                <BillsList selectedMonth={selectedMonth} />
              </div>
            </div>

            {/* 4. Wallet Cards */}
            <div className="mt-4 sm:mt-6">
              <WalletCards onManageCards={handleOpenCards} />
            </div>
          </>
        )}
      </main>

      {/* FAB Menu Overlay - Only show for write access */}
      {canWrite && showFabMenu && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setShowFabMenu(false)}
        />
      )}

      {/* FAB Menu - Only show for write access */}
      {canWrite && <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
        {showFabMenu && (
          <>
            <button
              onClick={() => { setShowImport(true); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{t('dashboard.import')}</span>
            </button>

            <button
              onClick={() => { setShowTransactionModal(true); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{language === 'pt' ? 'Adicionar' : 'Add Manually'}</span>
            </button>

            <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1" />

            <button
              onClick={() => { handleOpenGoals(); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <span className="text-lg">🎯</span>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{t('goals.title')}</span>
            </button>

            <button
              onClick={() => { handleOpenBudget(); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{t('budget.title')}</span>
            </button>

            <button
              onClick={() => { handleOpenInvestments(); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-lg">📈</span>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{t('investments.title')}</span>
            </button>

            <button
              onClick={() => { handleOpenCards(); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
                <span className="text-lg">🏦</span>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{language === 'pt' ? 'Meus Bancos' : 'My Banks'}</span>
            </button>

            <button
              onClick={() => { setShowBillModal(true); setShowFabMenu(false); }}
              className="flex items-center gap-3 pl-4 pr-5 py-3 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all animate-fade-in"
            >
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{language === 'pt' ? 'Nova Conta' : 'New Bill'}</span>
            </button>
          </>
        )}

        <button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            showFabMenu
              ? 'bg-gray-800 dark:bg-gray-700 rotate-45'
              : 'bg-rose-500 hover:bg-rose-600'
          }`}
        >
          <PlusIcon className="w-7 h-7 text-white" />
        </button>
      </div>}

      {/* Modals */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
      <GoalsModal isOpen={showGoals} onClose={() => setShowGoals(false)} transactions={transactions} />
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
      <InvestmentModal
        isOpen={showInvestments}
        onClose={() => setShowInvestments(false)}
      />
      <InvestmentsListModal
        isOpen={showInvestmentsList}
        onClose={() => setShowInvestmentsList(false)}
      />
      <BillModal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
      />
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        isFirstTime={isFirstTimeTutorial}
      />

      {/* Full Transactions Modal */}
      {showFullTransactions && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFullTransactions(false)} />
          <div className="absolute inset-4 sm:inset-8 lg:inset-16 bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                {t('transactionList.title')} - {getMonthLabel(selectedMonth)}
              </h2>
              <button
                onClick={() => setShowFullTransactions(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <TransactionList
                transactions={filteredTransactions}
                selectedMonth={selectedMonth}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSuccess={triggerRefresh}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}