import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInvestments } from '../contexts/InvestmentContext';

export default function GoalProgress({ onManageGoals }) {
  const { goals, loading, getGoalColor, getGoalProgress } = useGoals();
  const { t } = useSettings();
  const { getGoalInvestmentValue } = useInvestments();

  // Calculate progress including investments using the context function
  const calculateProgress = (goal) => {
    const investmentValue = getGoalInvestmentValue(goal.id) || 0;
    return getGoalProgress(goal, investmentValue);
  };

  // Show only active (non-completed) goals, sorted by progress
  const activeGoals = goals
    .filter(g => !g.completed)
    .sort((a, b) => calculateProgress(b) - calculateProgress(a))
    .slice(0, 4); // Show max 4 on dashboard

  const completedCount = goals.filter(g => g.completed).length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
            <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onManageGoals}
      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('goals.myGoals')}</h2>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">{t('goals.noGoals')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('goals.noGoalsSubtitle')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const color = getGoalColor(goal.color);
              const progress = calculateProgress(goal);
              const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;

              return (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition group"
                >
                  <div className={`w-10 h-10 ${color.light} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate text-sm">{goal.name}</span>
                      <span className="text-base font-bold text-violet-600 dark:text-violet-400 flex-shrink-0">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color.bg} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          {(goals.length > 4 || completedCount > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {goals.length > 4 && (
                  <span>+{goals.length - 4} {t('common.other').toLowerCase()}</span>
                )}
              </div>
              {completedCount > 0 && (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full font-medium">
                  {completedCount} {t('goals.completed').toLowerCase()}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
