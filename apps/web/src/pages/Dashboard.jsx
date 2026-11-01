import { useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { useMonth } from '../contexts/MonthContext';
import useTransactions from '../hooks/useTransactions';
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';
import HomeSummaryCard from '../components/home/HomeSummaryCard';
import PlanningCard from '../components/home/PlanningCard';
import OverdueBillsCard from '../components/home/OverdueBillsCard';
import InsightsCard from '../components/home/InsightsCard';
import CategorySpendingCard from '../components/home/CategorySpendingCard';
import TrendChart from '../components/charts/TrendChart';
import PageHeader from '../components/PageHeader';
import { useNeedsSetup } from '../hooks/useNeedsSetup';
import { SparklesIcon } from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const navigate = useNavigate();

  const { selectedMonth } = useMonth();
  const [viewMode] = useState('payment');
  const { t, language, monthlyRollover } = useSettings();
  const { ownerId, loading: accessLoading } = useAccess();
  const { getPaymentMonthKey, loading: cardsLoading } = useCards();
  const { transactions, loading: transactionsLoading } = useTransactions({}, { enabled: Boolean(ownerId) });
  // No bank account yet: Elio (the chat) sets the user up, so the dashboard has nothing to show.
  const needsSetup = useNeedsSetup();
  const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
    transactions, selectedMonth, viewMode, getPaymentMonthKey, { rollover: monthlyRollover }
  );
  useInvestments();

  const handleIncomeClick = () => navigate('/income');
  const handleExpensesClick = () => navigate('/expenses');

  // Dashboard is hydrating until access resolves an owner, cards finish loading,
  // and the first transactions snapshot lands. Gating here prevents the
  // "everything shows 0" flash where totals are computed from empty arrays.
  const isHydrating = accessLoading || !ownerId || cardsLoading || transactionsLoading || needsSetup === null;

  /** Transactions that belong to `monthKey` (purchase month, or card-payment month for card expenses). */
  const inMonth = useMemo(
    () => (monthKey) =>
      transactions.filter((t) => {
        const date = new Date(t.date);
        const transactionMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (viewMode === 'purchase') return transactionMonthKey === monthKey;
        if (t.type === 'income' || t.investmentId) return transactionMonthKey === monthKey;
        return getPaymentMonthKey(t.date, t.bankId, t.paymentMethod) === monthKey;
      }),
    [transactions, viewMode, getPaymentMonthKey],
  );

  const monthlyTransactions = useMemo(() => (selectedMonth ? inMonth(selectedMonth) : transactions), [inMonth, selectedMonth, transactions]);
  const previousMonthTransactions = useMemo(() => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return inMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, [inMonth, selectedMonth]);

  if (needsSetup === true) return <Navigate to="/chat" replace />;

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
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
    <div className="min-h-screen bg-[var(--rw-bg)] transition-colors">
      <PageHeader title={t('dashboard.title')} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* One column on a phone, in reading order: balance, late-bill alert, budget, where the money went, panorama.
            On a phone the two column wrappers disappear (display: contents) and `order` gives that order; on a wide
            screen the left column carries balance, alert and panorama, the right one budget and spending. */}
        <div className="flex flex-col gap-4 md:gap-6 lg:grid lg:grid-cols-3">
          <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
            <div className="order-1"><HomeSummaryCard
              transactions={monthlyTransactions}
              previousTransactions={previousMonthTransactions}
              carryoverSaldo={carryoverSaldo}
              selectedMonth={selectedMonth}
              onIncomeClick={handleIncomeClick}
              onExpensesClick={handleExpensesClick}
            /></div>
            <div className="order-2 flex flex-col gap-4">
              <OverdueBillsCard />
              <button type="button" onClick={() => navigate('/bills')} className="flex min-h-[56px] w-full items-center gap-3 rounded-[20px] border border-[var(--rw-border)] bg-[var(--rw-surface)] px-4 text-left">
                <span className="flex-1 text-[15px] font-semibold text-[var(--rw-ink)]">{language === 'pt' ? 'Contas a pagar' : 'Bills to pay'}</span>
                <span className="text-sm font-semibold text-[var(--rw-brand-ink)]">{language === 'pt' ? 'Ver contas' : 'See bills'}</span>
              </button>
            </div>
            <div className="order-6">
              <TrendChart
                transactions={transactions}
                selectedMonth={selectedMonth}
                viewMode={viewMode}
                cumulativeByMonth={cumulativeByMonth}
                rollover={monthlyRollover}
              />
            </div>
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <div className="order-3"><PlanningCard transactions={monthlyTransactions} selectedMonth={selectedMonth} /></div>
            <div className="order-4"><CategorySpendingCard transactions={monthlyTransactions} selectedMonth={selectedMonth} /></div>
            <div className="order-5"><InsightsCard /></div>
          </div>
        </div>
      </main>

      {/* The assistant is the only way to add data */}
      <button
        onClick={() => navigate('/chat')}
        className="hidden lg:flex fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg items-center justify-center bg-[var(--rw-brand)] hover:opacity-90 transition-all"
        aria-label={language === 'pt' ? 'Abrir assistente' : 'Open assistant'}
      >
        <SparklesIcon className="w-7 h-7 text-white" />
      </button>
      <PageHelp
        title="Dashboard"
        text="Visão geral das suas finanças. Acompanhe saldo, receitas e despesas do mês selecionado. Use as setas para navegar entre os meses."
        hasFab={false}
      />
    </div>
  );
}
