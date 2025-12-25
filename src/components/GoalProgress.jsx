import { useGoals, GOAL_ICONS } from '../contexts/GoalsContext';
import { useSettings } from '../contexts/SettingsContext';

export default function GoalProgress({ onManageGoals }) {
  const { goals, loading, getGoalProgress, getGoalColor } = useGoals();
  const { formatCurrency, t } = useSettings();

  // Show only active (non-completed) goals, sorted by progress
  const activeGoals = goals
    .filter(g => !g.completed)
    .sort((a, b) => getGoalProgress(b) - getGoalProgress(a))
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
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('goals.myGoals')}</h2>
        <button
          onClick={onManageGoals}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium transition"
        >
          {goals.length > 0 ? t('common.edit') : t('goals.addGoal')}
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎯</span>
          </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">{t('goals.noGoals')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('goals.noGoalsSubtitle')}</p>
          <button
            onClick={onManageGoals}
            className="mt-4 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition"
          >
            {t('goals.addGoal')}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const color = getGoalColor(goal.color);
              const progress = getGoalProgress(goal);
              const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;
              const remaining = goal.targetAmount - (goal.currentAmount || 0);

              return (
                <div
                  key={goal.id}
                  onClick={onManageGoals}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition group"
                >
                  <div className={`w-10 h-10 ${color.light} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate text-sm">{goal.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color.bg} rounded-full transition-all duration-500`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className={`text-xs ${color.text}`}>
                        {formatCurrency(goal.currentAmount || 0)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t('goals.remaining')}: {formatCurrency(remaining > 0 ? remaining : 0)}
                      </span>
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
