import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';

export default function IncomeVsExpensesCard({ transactions, onInvestmentsClick, carryoverSaldo = 0 }) {
  const { language, formatCurrency } = useSettings();
  const { investments, getTotalCurrentValue, getTotalGrowth } = useInvestments();

  const { totalIncome, totalExpenses, balance, percentageDiff } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const bal = income - expenses + carryoverSaldo;
    const pctDiff = income > 0 ? ((expenses / income) * 100) : 0;

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: bal,
      percentageDiff: pctDiff
    };
  }, [transactions, carryoverSaldo]);

  const isPositive = balance >= 0;
  const expensesRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  const portfolioValue = getTotalCurrentValue();
  const portfolioGrowth = getTotalGrowth();
  const hasInvestments = investments.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
        <span className="text-2xl">💰</span>
        {language === 'pt' ? 'Resumo Financeiro' : 'Financial Summary'}
      </h3>

      <div className="space-y-4">
        {/* Income */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {language === 'pt' ? 'Receitas' : 'Income'}
              </span>
            </div>
            <span className="text-2xl font-bold text-emerald-500">
              {formatCurrency(totalIncome)}
            </span>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowTrendingDownIcon className="w-5 h-5 text-rose-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {language === 'pt' ? 'Despesas' : 'Expenses'}
              </span>
            </div>
            <span className="text-2xl font-bold text-rose-500">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          {totalIncome > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{language === 'pt' ? 'da receita' : 'of income'}</span>
                <span>{expensesRatio.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(expensesRatio, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Saldo anterior — only when there is a non-zero carryover */}
        {carryoverSaldo !== 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {language === 'pt' ? 'Saldo anterior' : 'Previous balance'}
                </span>
              </div>
              <span className={`text-xl font-bold ${carryoverSaldo >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                {carryoverSaldo >= 0 ? '+' : ''}{formatCurrency(carryoverSaldo)}
              </span>
            </div>
          </div>
        )}

        {/* Balance */}
        <div className={`rounded-xl p-4 ${
          isPositive
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-700'
            : 'bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-700'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'pt' ? 'Saldo' : 'Balance'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isPositive
                  ? (language === 'pt' ? 'Você economizou' : 'You saved')
                  : (language === 'pt' ? 'Déficit' : 'Deficit')
                }
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold ${
                isPositive ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {isPositive ? '+' : ''}{formatCurrency(balance)}
              </p>
              {totalIncome > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {Math.abs((balance / totalIncome) * 100).toFixed(0)}% {language === 'pt' ? 'da receita' : 'of income'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Investments (if available) */}
        {hasInvestments && (
          <button
            onClick={onInvestmentsClick}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 w-full group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {language === 'pt' ? 'Portfólio' : 'Portfolio'}
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-blue-500">
                {formatCurrency(portfolioValue)}
              </span>
              <span className={`text-sm font-medium ${portfolioGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {portfolioGrowth >= 0 ? '+' : ''}{formatCurrency(portfolioGrowth)}
              </span>
            </div>
          </button>
        )}

        {/* Status message */}
        {totalIncome > 0 && totalExpenses > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 text-center">
            {isPositive ? (
              language === 'pt'
                ? '🎉 Excelente! Você está gastando menos do que ganha.'
                : '🎉 Great! You are spending less than you earn.'
            ) : (
              language === 'pt'
                ? '⚠️ Atenção! Suas despesas superam sua receita.'
                : '⚠️ Warning! Your expenses exceed your income.'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
