import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { useBudget } from '../contexts/BudgetContext';
import { analytics } from '../services/analyticsService';
import { useCards } from '../contexts/CardsContext';
import { useMonth } from '../contexts/MonthContext';
import BudgetCategorySection from '../components/BudgetCategorySection';
import RuleComparison from '../components/RuleComparison';
import MonthSelector from '../components/MonthSelector';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export default function PlanningPage() {
  const navigate = useNavigate();
  const { t, language, categories } = useSettings();
  const { ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const { budgetSettings } = useBudget();
  const { selectedMonth, setSelectedMonth } = useMonth();

  const [transactions, setTransactions] = useState([]);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);

  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

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
      setTransactionsLoaded(true);
    });

    return () => unsubscribe();
  }, [ownerId]);

  useEffect(() => {
    if (transactionsLoaded && transactions.length === 0 && auth.currentUser) {
      analytics.emptyStateVisited(auth.currentUser?.uid, { tab: 'planning' });
    }
  }, [transactionsLoaded, transactions.length]);

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

      if (t.type === 'income') {
        return transactionMonthKey === selectedMonth;
      }
      if (t.investmentId) {
        return transactionMonthKey === selectedMonth;
      }
      const paymentKey = getPaymentMonthKey(t.date, t.bankId, t.paymentMethod);
      return paymentKey === selectedMonth;
    });
  }, [transactions, selectedMonth, getPaymentMonthKey]);

  const totalIncome = useMemo(() => {
    return monthlyTransactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const totalExpenses = useMemo(() => {
    return monthlyTransactions
      .filter(t => t.type === 'expense' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions]);

  const expenseCategories = useMemo(() => {
    return categories.expense || [];
  }, [categories]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: language === 'pt' ? 'BRL' : 'USD'
    }).format(amount);
  };

  const balance = totalIncome - totalExpenses;

  const handleCategoryClick = (category) => {
    navigate(`/transactions?category=${encodeURIComponent(category)}&month=${selectedMonth}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white pl-12 md:pl-0">
              {language === 'pt' ? 'Planejamento' : 'Planning'}
            </h1>
            <button
              onClick={() => navigate('/budget')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors"
            >
              <Cog6ToothIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t('budget.configure')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
        {/* Month Selector - Enhanced */}
        <div className="mb-6">
          <MonthSelector
            selectedMonth={selectedMonth}
            availableMonths={availableMonths}
            onMonthChange={setSelectedMonth}
            locale={locale}
            enhanced
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {language === 'pt' ? 'Entrada' : 'Income'}
            </p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {language === 'pt' ? 'Saída' : 'Expenses'}
            </p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {language === 'pt' ? 'Saldo' : 'Balance'}
            </p>
            <p className={`text-xl font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* 50/30/20 Rule Comparison */}
        <div className="mb-6">
          <RuleComparison
            transactions={monthlyTransactions}
            totalIncome={totalIncome}
            onConfigure={() => navigate('/budget')}
          />
        </div>

        {/* Budget by Category */}
        <BudgetCategorySection
          transactions={monthlyTransactions}
          selectedMonth={selectedMonth}
          onConfigure={() => navigate('/budget')}
          onCategoryClick={handleCategoryClick}
        />
      </main>
    </div>
  );
}
