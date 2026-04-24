import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { useFeature } from '../contexts/ClientConfigContext';
import { useMonth } from '../contexts/MonthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';
import InvestmentsListModal from '../components/InvestmentsListModal';
import ExpensesPieChart from '../components/charts/ExpensesPieChart';
import CategoryTrendChart from './planner/CategoryTrendChart';
import BillsSummaryCard from '../components/BillsSummaryCard';
import IncomeVsExpensesCard from '../components/IncomeVsExpensesCard';
import CardsModal from '../components/CardsModal';
import TransactionModal from '../components/TransactionModal';
import BillModal from '../components/BillModal';
import GoalProgress from '../components/GoalProgress';
import PlannerSummaryCard from '../components/PlannerSummaryCard';
import ExpensesByCategoryCard from '../components/ExpensesByCategoryCard';
import TrendChart from '../components/charts/TrendChart';
import PageHeader from '../components/PageHeader';
import TutorialModal from '../components/TutorialModal';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [showCards, setShowCards] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showInvestmentsList, setShowInvestmentsList] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [refreshKey] = useState(0);
  const { selectedMonth } = useMonth();
  const [viewMode] = useState('payment');
  const { t, language, tutorialCompleted, loading: settingsLoading } = useSettings();
  const { canWrite, ownerId } = useAccess();
  const hasGoals = useFeature('goals');
  const { getPaymentMonthKey } = useCards();
  const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
    transactions, selectedMonth, viewMode, getPaymentMonthKey
  );
  useInvestments();

  const handleOpenCards = () => {
    if (isMobile) navigate('/cards');
    else setShowCards(true);
  };

  const handleOpenInvestmentsList = () => {
    if (isMobile) navigate('/investments');
    else setShowInvestmentsList(true);
  };

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const showTutorial = !settingsLoading && !tutorialCompleted && !tutorialDismissed;

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

  const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${selectedMonth}-01`);
    d.setMonth(d.getMonth() - (5 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }), [selectedMonth]);

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


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={t('dashboard.title')} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
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

            {/* Category Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {locale === 'pt-BR' ? 'Tendência por Categoria' : 'Spending by Category'}
              </h3>
              <CategoryTrendChart
                allTx={transactions}
                last6Months={last6Months}
                getMonthKey={getPaymentMonthKey}
              />
            </div>
          </div>

          {/* Right Column - Summary Cards */}
          <div className="space-y-4 md:space-y-6">
            {/* My Goals Progress - only when feature is enabled */}
            {hasGoals && <GoalProgress onManageGoals={() => navigate('/goals')} />}

            {/* Bills Summary - Simple Card */}
            <BillsSummaryCard selectedMonth={selectedMonth} />

            {/* Planner allocation summary */}
            <PlannerSummaryCard />

            {/* Expenses by category */}
            <ExpensesByCategoryCard transactions={monthlyTransactions} />
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
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
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
        onClose={() => setTutorialDismissed(true)}
        isFirstTime={true}
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
      <PageHelp
        title="Dashboard"
        text="Visão geral das suas finanças. Acompanhe saldo, receitas e despesas do mês selecionado. Use as setas para navegar entre os meses."
        hasFab={true}
      />
    </div>
  );
}
