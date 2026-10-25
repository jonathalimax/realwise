import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useInvestments } from '../contexts/InvestmentContext';

function formatCompact(value) {
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export default function IncomeVsExpensesCard({ transactions, onInvestmentsClick, onIncomeClick, onExpensesClick, carryoverSaldo = 0, showInvestments = true }) {
  const { language, formatCurrency } = useSettings();
  const { investments, getTotalCurrentValue } = useInvestments();

  const { totalIncome, totalExpenses, balance } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses + carryoverSaldo,
    };
  }, [transactions, carryoverSaldo]);

  const isPositive = balance >= 0;
  const expensesRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  const portfolioValue = getTotalCurrentValue();
  const hasInvestments = showInvestments && investments.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
        <span>💰</span>
        {language === 'pt' ? 'Resumo Financeiro' : 'Financial Summary'}
      </h3>

      <div className="space-y-2">

        {/* KPI Bar */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={onIncomeClick}
            title={formatCurrency(totalIncome)}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-left hover:opacity-80 transition-opacity cursor-pointer"
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
              {language === 'pt' ? 'Receitas' : 'Income'}
            </p>
            <p className="text-sm font-bold text-emerald-500 tabular-nums">
              {formatCompact(totalIncome)}
            </p>
          </button>

          <button
            onClick={onExpensesClick}
            title={formatCurrency(totalExpenses)}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-left hover:opacity-80 transition-opacity cursor-pointer"
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
              {language === 'pt' ? 'Despesas' : 'Expenses'}
            </p>
            <p className="text-sm font-bold text-rose-500 tabular-nums">
              {formatCompact(totalExpenses)}
            </p>
          </button>

          <div
            title={formatCurrency(balance)}
            className={`rounded-xl p-2.5 border ${
              isPositive
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700'
            }`}
          >
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
              {language === 'pt' ? 'Saldo' : 'Balance'}
            </p>
            <p className={`text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? '+' : ''}{formatCompact(balance)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {totalIncome > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
              <span>{language === 'pt' ? 'Despesas / Receita' : 'Expenses / Income'}</span>
              <span>{expensesRatio.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(expensesRatio, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Secondary row — Saldo anterior + Patrimônio */}
        {(carryoverSaldo !== 0 || hasInvestments) && (
          <div className="grid grid-cols-2 gap-1.5">
            {carryoverSaldo !== 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  {language === 'pt' ? 'Saldo anterior' : 'Previous balance'}
                </p>
                <p
                  title={formatCurrency(carryoverSaldo)}
                  className={`text-sm font-bold tabular-nums ${carryoverSaldo >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}
                >
                  {carryoverSaldo >= 0 ? '+' : ''}{formatCompact(carryoverSaldo)}
                </p>
              </div>
            )}
            {hasInvestments && (
              <button
                onClick={onInvestmentsClick}
                title={formatCurrency(portfolioValue)}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
                  {language === 'pt' ? 'Patrimônio' : 'Net Worth'}
                </p>
                <p className="text-sm font-bold text-blue-500 tabular-nums">
                  {formatCompact(portfolioValue)}
                </p>
              </button>
            )}
          </div>
        )}

        {/* Tip */}
        {totalIncome > 0 && totalExpenses > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg py-1.5 px-3 text-[10px] text-gray-600 dark:text-gray-400 text-center">
            {isPositive
              ? (language === 'pt' ? '🎉 Excelente! Você está gastando menos do que ganha.' : '🎉 Great! You are spending less than you earn.')
              : (language === 'pt' ? '⚠️ Atenção! Suas despesas superam sua receita.' : '⚠️ Warning! Your expenses exceed your income.')
            }
          </div>
        )}

      </div>
    </div>
  );
}
