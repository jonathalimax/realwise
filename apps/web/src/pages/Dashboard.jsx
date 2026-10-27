import { useState, useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useFeature } from '../contexts/ClientConfigContext';
import { useCards } from '../contexts/CardsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { useMonth } from '../contexts/MonthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useTransactions from '../hooks/useTransactions';
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';
import BillsSummaryCard from '../components/BillsSummaryCard';
import IncomeVsExpensesCard from '../components/IncomeVsExpensesCard';
import AskChatBar from '../components/AskChatBar';
import InsightsCard from '../components/InsightsCard';
import PlannerSummaryCard from '../components/PlannerSummaryCard';
import ExpensesByCategoryCard from '../components/ExpensesByCategoryCard';
import TrendChart from '../components/charts/TrendChart';
import PageHeader from '../components/PageHeader';
import { useNeedsSetup } from '../hooks/useNeedsSetup';
import { SparklesIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { selectedMonth } = useMonth();
  const [viewMode] = useState('payment');
  const { t, language, monthlyRollover } = useSettings();
  const { ownerId, loading: accessLoading } = useAccess();
  const { getPaymentMonthKey, loading: cardsLoading } = useCards();
  const { transactions, loading: transactionsLoading } = useTransactions({}, { enabled: Boolean(ownerId) });
  const investmentsEnabled = useFeature('investments');
  // No bank account yet: Elio (the chat) sets the user up, so the dashboard has nothing to show.
  const needsSetup = useNeedsSetup();
  const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
    transactions, selectedMonth, viewMode, getPaymentMonthKey, { rollover: monthlyRollover }
  );
  useInvestments();

  const handleIncomeClick = () => navigate('/income');
  const handleExpensesClick = () => navigate('/expenses');

  const handleOpenInvestmentsList = () => {
    navigate('/investments');
  };

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  // Dashboard is hydrating until access resolves an owner, cards finish loading,
  // and the first transactions snapshot lands. Gating here prevents the
  // "everything shows 0" flash where totals are computed from empty arrays.
  const isHydrating = accessLoading || !ownerId || cardsLoading || transactionsLoading || needsSetup === null;

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


  if (needsSetup === true) return <Navigate to="/chat" replace />;

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <PageHeader title={t('dashboard.title')} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-40 rounded-2xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse ${
                  i === 0 ? 'lg:col-span-2' : ''
                }`}
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <PageHeader title={t('dashboard.title')} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        <AskChatBar />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Main Charts */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            <InsightsCard selectedMonth={selectedMonth} />

            {/* Income vs Expenses - HIGHLIGHTED */}
            <IncomeVsExpensesCard
              transactions={monthlyTransactions}
              onInvestmentsClick={handleOpenInvestmentsList}
              showInvestments={investmentsEnabled}
              onIncomeClick={handleIncomeClick}
              onExpensesClick={handleExpensesClick}
              carryoverSaldo={carryoverSaldo}
            />

            {/* Trend Chart - Expenses vs Income Over Time */}
            <div className="mt-2">
              <TrendChart
                transactions={transactions}
                selectedMonth={selectedMonth}
                viewMode={viewMode}
                cumulativeByMonth={cumulativeByMonth}
                rollover={monthlyRollover}
              />
            </div>
          </div>

          {/* Right Column - Summary Cards */}
          <div className="space-y-4 md:space-y-6">
            {/* Planner allocation summary */}
            <PlannerSummaryCard />

            {/* Bills Summary - Simple Card */}
            <BillsSummaryCard selectedMonth={selectedMonth} />

            {/* Expenses by category */}
            <ExpensesByCategoryCard transactions={monthlyTransactions} selectedMonth={selectedMonth} />
          </div>
        </div>
      </main>

      {/* The assistant is the only way to add data */}
      <button
        onClick={() => navigate('/chat')}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center bg-violet-500 hover:bg-violet-600 transition-all"
        aria-label={language === 'pt' ? 'Abrir assistente' : 'Open assistant'}
      >
        <SparklesIcon className="w-7 h-7 text-white" />
      </button>
      <PageHelp
        title="Dashboard"
        text="Visão geral das suas finanças. Acompanhe saldo, receitas e despesas do mês selecionado. Use as setas para navegar entre os meses."
        hasFab={true}
      />
    </div>
  );
}
