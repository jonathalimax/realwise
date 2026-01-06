import { useState } from 'react';
import { useBudget, RULE_COLORS } from '../contexts/BudgetContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAccess } from '../contexts/AccessContext';
import { ChevronDownIcon, ChevronUpIcon, Cog6ToothIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const RULE_EMOJIS = {
  needs: '🏠',
  wants: '🎮',
  savings: '💰'
};

export default function RuleComparison({ transactions, totalIncome, onConfigure }) {
  const { calculate50_30_20, rulePercentages } = useBudget();
  const { formatCurrency, t, language } = useSettings();
  const { canWrite } = useAccess();
  const [expanded, setExpanded] = useState(false);

  const ruleData = calculate50_30_20(transactions, totalIncome);

  const rules = [
    { key: 'needs', label: language === 'pt' ? 'Necessidades' : 'Needs', target: rulePercentages.needs },
    { key: 'wants', label: language === 'pt' ? 'Desejos' : 'Wants', target: rulePercentages.wants },
    { key: 'savings', label: language === 'pt' ? 'Reserva' : 'Savings', target: rulePercentages.savings },
  ];

  const title = language === 'pt' ? 'Equilíbrio Financeiro' : 'Spending Balance';

  if (totalIncome === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('budget.noIncomeYet')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <div className="flex items-center gap-2">
          {onConfigure && canWrite && (
            <button
              onClick={onConfigure}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={t('budget.configureRule')}
            >
              <Cog6ToothIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {expanded ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {rules.map(({ key, label, target }) => {
          const data = ruleData[key];
          const percentage = Math.min(data.percentage, 150);
          const isOver = key === 'savings' ? data.spent < data.target : data.spent > data.target;
          const colors = RULE_COLORS[key];

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{RULE_EMOJIS[key]}</span>
                  <span className={`font-medium text-sm ${colors.text}`}>{label}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({target}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    {data.percentage.toFixed(0)}%
                  </span>
                  {isOver ? (
                    <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                  ) : (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                {/* Target marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 z-10"
                  style={{ left: `${(target / 150) * 100}%` }}
                />
                {/* Actual progress */}
                <div
                  className={`h-full ${colors.bg} transition-all duration-500 rounded-full`}
                  style={{ width: `${(percentage / 150) * 100}%` }}
                />
              </div>

              {/* Expanded details */}
              {expanded && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                  <span>{formatCurrency(data.spent)}</span>
                  <span className={isOver ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {isOver
                      ? (key === 'savings'
                          ? `${language === 'pt' ? 'Falta' : 'Need'} ${formatCurrency(Math.abs(data.difference))}`
                          : `+${formatCurrency(Math.abs(data.difference))}`)
                      : (key === 'savings'
                          ? `+${formatCurrency(Math.abs(data.difference))}`
                          : `${language === 'pt' ? 'Sobra' : 'Left'} ${formatCurrency(Math.abs(data.difference))}`)}
                  </span>
                  <span>{formatCurrency(data.target)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary at bottom */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {language === 'pt' ? 'Base' : 'Based on'}: {formatCurrency(totalIncome)} {language === 'pt' ? 'de receita' : 'income'}
        </p>
      </div>
    </div>
  );
}
