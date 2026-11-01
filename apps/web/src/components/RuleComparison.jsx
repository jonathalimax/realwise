import { useBudget, RULE_COLORS } from '../contexts/BudgetContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const RULE_EMOJIS = {
  needs: '🏠',
  wants: '🎮',
  savings: '💰'
};

export default function RuleComparison({ transactions, totalIncome }) {
  const { calculate50_30_20, rulePercentages } = useBudget();
  const { formatCurrency, t, language } = useSettings();
  const navigate = useNavigate();

  const ruleData = calculate50_30_20(transactions, totalIncome);

  const rules = [
    { key: 'needs', label: language === 'pt' ? 'Necessidades' : 'Needs', target: rulePercentages.needs },
    { key: 'wants', label: language === 'pt' ? 'Desejos' : 'Wants', target: rulePercentages.wants },
    { key: 'savings', label: language === 'pt' ? 'Reserva' : 'Savings', target: rulePercentages.savings },
  ];

  const title = t('budget.planningTitle');

  const handleClick = () => {
    navigate('/planning');
  };

  if (totalIncome === 0) {
    return (
      <div
        onClick={handleClick}
        className="bg-[var(--rw-surface)] rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all border border-[var(--rw-border)]"
      >
        <h3 className="text-lg font-bold text-[var(--rw-ink)] mb-4">{title}</h3>
        <p className="text-sm text-[var(--rw-muted)]">{t('budget.noIncomeYet')}</p>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="bg-[var(--rw-surface)] rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all border border-[var(--rw-border)]"
    >
      <h3 className="text-lg font-bold text-[var(--rw-ink)] mb-4">{title}</h3>

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
                  <span className="text-xs text-[var(--rw-subtle)]">({target}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[var(--rw-ink)]">
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
              <div className="relative h-2 bg-[var(--rw-raised)] rounded-full overflow-hidden">
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

              {/* Always show values */}
              <div className="flex justify-between text-xs text-[var(--rw-muted)]">
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
            </div>
          );
        })}
      </div>

      {/* Summary at bottom */}
      <div className="mt-4 pt-3 border-t border-[var(--rw-border)]">
        <p className="text-xs text-[var(--rw-muted)] text-center">
          {language === 'pt' ? 'Base' : 'Based on'}: {formatCurrency(totalIncome)} {language === 'pt' ? 'de receita' : 'income'}
        </p>
      </div>
    </div>
  );
}
