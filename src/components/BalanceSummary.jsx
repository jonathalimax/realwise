import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useInvestments } from '../contexts/InvestmentContext';

export default function BalanceSummary({ transactions = [], onInvestmentsClick }) {
  const { formatCurrency, t } = useSettings();
  const { investments, getTotalCurrentValue, getTotalGrowth } = useInvestments();

      const summary = useMemo(() => {
      let income = 0;
      let expenses = 0;
  
      transactions.forEach((trans) => {
        // Skip ignored transactions
        if (trans.ignored) return;
  
        if (trans.type === 'income') {
          income += trans.amount;
        } else {
          expenses += trans.amount;
        }
      });
  
      console.log('BalanceSummary - transactions:', transactions);
      console.log('BalanceSummary - Calculated Income:', income, 'Expenses:', expenses);
  
      return {
        totalIncome: income,
        totalExpenses: expenses,
        balance: income - expenses
      };
    }, [transactions]);
  const portfolioValue = getTotalCurrentValue();
  const portfolioGrowth = getTotalGrowth();
  const hasInvestments = investments.length > 0;

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
    },
    // Portfolio value card (only if there are investments)
    ...(hasInvestments ? [{
      title: t('investments.portfolioValue'),
      value: portfolioValue,
      subtitle: portfolioGrowth >= 0
        ? `+${formatCurrency(portfolioGrowth)}`
        : formatCurrency(portfolioGrowth),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/30',
      borderColor: 'border-blue-100 dark:border-blue-900/50',
      subtitleColor: portfolioGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500',
      onClick: onInvestmentsClick,
      isClickable: true
    }] : [])
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 md:p-0 shadow-sm md:bg-transparent md:dark:bg-transparent md:border-none md:shadow-none">
      {/* Mobile view: single card */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('balance.totalBalance')}</p>
          <p className={`text-2xl font-semibold ${summary.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600'}`}>
            {formatCurrency(summary.balance)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-3">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">{t('balance.income')}</p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(summary.totalIncome)}</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-900/30 rounded-lg p-3">
            <p className="text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wide">{t('balance.expenses')}</p>
            <p className="text-lg font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(summary.totalExpenses)}</p>
          </div>
        </div>
        {hasInvestments && (
            <button
              onClick={onInvestmentsClick}
              className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4 w-full text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 -mx-4 px-4 pb-4 -mb-4 rounded-b-2xl transition-colors"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('investments.portfolioValue')}</p>
                        <p className="text-xl font-semibold text-blue-600">{formatCurrency(portfolioValue)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${portfolioGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {portfolioGrowth >= 0 ? '+' : ''}{formatCurrency(portfolioGrowth)}
                      </p>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                </div>
            </button>
        )}
      </div>

      {/* Desktop view: grid of cards */}
      <div className={`hidden ${hasInvestments ? 'md:grid md:grid-cols-4' : 'md:grid md:grid-cols-3'} gap-4`}>
        {cards.map((card, index) => {
          const CardWrapper = card.isClickable ? 'button' : 'div';
          return (
            <CardWrapper
              key={index}
              onClick={card.onClick}
              className={`
                relative overflow-hidden rounded-2xl p-6 text-left
                bg-white dark:bg-gray-800 border ${card.borderColor}
                hover:shadow-md transition-all duration-300
                ${card.isClickable ? 'cursor-pointer hover:scale-[1.02]' : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.title}</p>
                  <p className={`text-2xl sm:text-3xl font-semibold ${card.color}`}>
                    {formatCurrency(card.value)}
                  </p>
                  {card.subtitle && (
                    <p className={`text-sm font-medium mt-1 ${card.subtitleColor}`}>
                      {card.subtitle}
                    </p>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.color}`}>
                  {card.icon}
                </div>
              </div>

              {/* Subtle decoration */}
              <div
                className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full ${card.bgColor} opacity-50`}
              />

              {/* Click indicator for clickable cards */}
              {card.isClickable && (
                <div className="absolute bottom-3 right-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </CardWrapper>
          );
        })}
      </div>
    </div>
  );
}
