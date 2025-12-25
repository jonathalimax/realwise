import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';

export default function BalanceSummary({ transactions = [] }) {
  const { formatCurrency, t } = useSettings();

  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;

    transactions.forEach((trans) => {
      if (trans.type === 'income') {
        income += trans.amount;
      } else {
        expenses += trans.amount;
      }
    });

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses
    };
  }, [transactions]);

  const cards = [
    {
      title: t('balance.totalBalance'),
      value: summary.balance,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: summary.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600',
      bgColor: 'bg-gray-50 dark:bg-gray-700',
      borderColor: 'border-gray-100 dark:border-gray-700'
    },
    {
      title: t('balance.income'),
      value: summary.totalIncome,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      ),
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/30',
      borderColor: 'border-emerald-100 dark:border-emerald-900/50'
    },
    {
      title: t('balance.expenses'),
      value: summary.totalExpenses,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
      ),
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-900/30',
      borderColor: 'border-rose-100 dark:border-rose-900/50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`
            relative overflow-hidden rounded-2xl p-6
            bg-white dark:bg-gray-800 border ${card.borderColor}
            hover:shadow-md transition-shadow duration-300
            ${index === 0 ? 'md:col-span-1' : ''}
          `}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.title}</p>
              <p className={`text-2xl sm:text-3xl font-semibold ${card.color}`}>
                {formatCurrency(card.value)}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.color}`}>
              {card.icon}
            </div>
          </div>

          {/* Subtle decoration */}
          <div
            className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${card.bgColor} opacity-50`}
          />
        </div>
      ))}
    </div>
  );
}
