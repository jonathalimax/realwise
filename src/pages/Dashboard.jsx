import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useBills } from '../contexts/BillsContext';
import { useCards } from '../contexts/CardsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { useMonth } from '../contexts/MonthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';
import InvestmentsListModal from '../components/InvestmentsListModal';
import ExpensesPieChart from '../components/charts/ExpensesPieChart';
import BillsSummaryCard from '../components/BillsSummaryCard';
import IncomeVsExpensesCard from '../components/IncomeVsExpensesCard';
import CardsModal from '../components/CardsModal';
import BudgetModal from '../components/BudgetModal';
import TransactionModal from '../components/TransactionModal';
import InvestmentModal from '../components/InvestmentModal';
import BillModal from '../components/BillModal';
import GoalProgress from '../components/GoalProgress';
import RuleComparison from '../components/RuleComparison';
import PendingCategorizationCard from '../components/PendingCategorizationCard';
import TrendChart from '../components/charts/TrendChart';
import TutorialModal from '../components/TutorialModal';
import MonthSelector from '../components/MonthSelector';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [showCards, setShowCards] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showInvestments, setShowInvestments] = useState(false);
  const [showInvestmentsList, setShowInvestmentsList] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isFirstTimeTutorial, setIsFirstTimeTutorial] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { selectedMonth, setSelectedMonth } = useMonth();
  const [viewMode, setViewMode] = useState('payment');
  const { t, language, categories, tutorialCompleted, loading: settingsLoading } = useSettings();
  const { canWrite, ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
    transactions, selectedMonth, viewMode, getPaymentMonthKey
  );
  const { getTotalCurrentValue } = useInvestments();

  const handleOpenGoals = () => {
    navigate('/goals');
  };

  const handleOpenCards = () => {
    if (isMobile) navigate('/cards');
    else setShowCards(true);
  };

  const handleOpenBudget = () => {
    navigate('/budget');
  };

  const handleOpenInvestments = () => {
    if (isMobile) navigate('/investments');
    else setShowInvestments(true);
  };

  const handleOpenInvestmentsList = () => {
    if (isMobile) navigate('/investments');
    else setShowInvestmentsList(true);
  };

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

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
  }, [transactions, selectedMonth, viewMode, getPaymentMonthKey]);

  const totalIncome = useMemo(() => {
    return monthlyTransactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const expenseCategories = useMemo(() => {
    return categories.expense || [];
  }, [categories]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
              {t('dashboard.title')}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Enhanced Month Selector */}
        <div className="mb-6">
          <MonthSelector
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            onMonthChange={setSelectedMonth}
            locale={locale}
            enhanced
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Main Charts */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Income vs Expenses - HIGHLIGHTED */}
            <IncomeVsExpensesCard
              transactions={monthlyTransactions}
              onInvestmentsClick={handleOpenInvestmentsList}
              carryoverSaldo={carryoverSaldo}
            />

            {/* Expenses Pie Chart */}
            <ExpensesPieChart transactions={monthlyTransactions} />

            {/* Trend Chart - Expenses vs Income Over Time */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('charts.incomeVsExpenses')}</h3>
              <TrendChart
                transactions={transactions}
                selectedMonth={selectedMonth}
                viewMode={viewMode}
                cumulativeByMonth={cumulativeByMonth}
              />
            </div>
          </div>

          {/* Right Column - Summary Cards */}
          <div className="space-y-4 md:space-y-6">
            {/* Pending Categorization Alert */}
            <PendingCategorizationCard />

            {/* My Goals Progress - Clickable Card */}
            <GoalProgress onManageGoals={handleOpenGoals} />

            {/* Bills Summary - Simple Card */}
            <BillsSummaryCard selectedMonth={selectedMonth} />

            {/* Planning - 50/30/20 Rule */}
            <RuleComparison
              transactions={monthlyTransactions}
              totalIncome={totalIncome}
            />
          </div>
        </div>
      </main>

      {/* FAB Menu */}
      {canWrite && showFabMenu && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setShowFabMenu(false)}
        />
      )}

      {canWrite && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
          {showFabMenu && (
            <>
              <button
                onClick={() => { navigate('/import'); setShowFabMenu(false); }}
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
                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center">
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
                : 'bg-violet-500 hover:bg-violet-600'
            }`}
          >
            <PlusIcon className="w-7 h-7 text-white" />
          </button>
        </div>
      )}

      {/* Modals */}
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
