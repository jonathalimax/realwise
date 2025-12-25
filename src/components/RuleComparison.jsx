import { useState } from 'react';
import { useBudget, RULE_COLORS } from '../contexts/BudgetContext';
import { useSettings } from '../contexts/SettingsContext';
import { ChevronDownIcon, ChevronUpIcon, Cog6ToothIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function RuleComparison({ transactions, totalIncome, onConfigure }) {
  const { calculate50_30_20 } = useBudget();
  const { formatCurrency, t } = useSettings();
  const [expanded, setExpanded] = useState(false);

  const ruleData = calculate50_30_20(transactions, totalIncome);

  const rules = [
    { key: 'needs', label: t('budget.needs'), target: 50, desc: t('budget.needsDesc') },
    { key: 'wants', label: t('budget.wants'), target: 30, desc: t('budget.wantsDesc') },
    { key: 'savings', label: t('budget.savings'), target: 20, desc: t('budget.savingsDesc') },
  ];

  if (totalIncome === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('budget.rule')}</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('budget.noIncomeYet')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('budget.rule')}</h3>
        <div className="flex items-center gap-2">
          {onConfigure && (
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

      <div className="space-y-3">
        {rules.map(({ key, label, target, desc }) => {
          const data = ruleData[key];
          const percentage = Math.min(data.percentage, 150); // Cap at 150% for display
          const isOver = key === 'savings' ? data.spent < data.target : data.spent > data.target;
          const isSavingsUnder = key === 'savings' && data.spent < data.target;
          const colors = RULE_COLORS[key];

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${colors.text}`}>{label}</span>
                  <span className="text-gray-400 dark:text-gray-500">({target}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-300">
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
              <div className="relative h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-1">
                  <p>{desc}</p>
                  <div className="flex justify-between">
                    <span>
                      {t('budget.spent')}: {formatCurrency(data.spent)}
                    </span>
                    <span>
                      {t('budget.targetPercent', { percent: target })}: {formatCurrency(data.target)}
                    </span>
                  </div>
                  {data.difference !== 0 && (
                    <p className={isOver ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {isOver
                        ? (key === 'savings'
                            ? t('budget.underBudget', { amount: formatCurrency(Math.abs(data.difference)) })
                            : t('budget.overBudget', { amount: formatCurrency(Math.abs(data.difference)) }))
                        : (key === 'savings'
                            ? t('budget.overBudget', { amount: formatCurrency(Math.abs(data.difference)) })
                            : t('budget.underBudget', { amount: formatCurrency(Math.abs(data.difference)) }))}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary at bottom */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('budget.basedOnIncome', { amount: formatCurrency(totalIncome) })}
        </p>
      </div>
    </div>
  );
}
