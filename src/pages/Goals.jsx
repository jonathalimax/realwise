import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGoals, GOAL_ICONS, GOAL_COLORS } from '../contexts/GoalsContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAccess } from '../contexts/AccessContext';
import CurrencyInput from '../components/ui/CurrencyInput';

// Default months to assume when goal has no deadline
const DEFAULT_MONTHS_ASSUMPTION = 12;

export default function GoalsPage() {
  const navigate = useNavigate();
  const { goals, loading, addGoal, updateGoal, deleteGoal, addAmountToGoal, getGoalProgress, getMonthlyNeeded, getGoalColor } = useGoals();
  const { formatCurrency, t, language } = useSettings();
  const { getInvestmentsByGoal, getGoalInvestmentValue, getGoalInvestmentGrowth } = useInvestments();
  const { ownerId } = useAccess();

  const [view, setView] = useState('list');
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoalForFunds, setSelectedGoalForFunds] = useState(null);
  const [selectedGoalForTransactions, setSelectedGoalForTransactions] = useState(null);
  const [fundAmount, setFundAmount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortBy, setSortBy] = useState('deadline');
  const [transactions, setTransactions] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    targetAmount: 0,
    icon: 'other',
    color: 'blue',
    deadline: '',
    description: ''
  });

  // Confirmation state for marking goal as achieved
  const [confirmAchieved, setConfirmAchieved] = useState(null);

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
    });

    return () => unsubscribe();
  }, [ownerId]);

  const handleClose = () => {
    navigate(-1);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      targetAmount: 0,
      icon: 'other',
      color: 'blue',
      deadline: '',
      description: ''
    });
    setEditingGoal(null);
  };

  const handleOpenForm = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        name: goal.name,
        targetAmount: goal.targetAmount,
        icon: goal.icon,
        color: goal.color,
        deadline: goal.deadline || '',
        description: goal.description || ''
      });
    } else {
      resetForm();
    }
    setView('form');
  };

  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.targetAmount) return;

    if (editingGoal) {
      await updateGoal(editingGoal.id, {
        name: formData.name.trim(),
        targetAmount: formData.targetAmount,
        icon: formData.icon,
        color: formData.color,
        deadline: formData.deadline || null,
        description: formData.description.trim()
      });
    } else {
      await addGoal({
        name: formData.name.trim(),
        targetAmount: formData.targetAmount,
        icon: formData.icon,
        color: formData.color,
        deadline: formData.deadline || null,
        description: formData.description.trim()
      });
    }

    resetForm();
    setView('list');
  };

  const handleDelete = async (goalId) => {
    await deleteGoal(goalId);
    setConfirmDelete(null);
  };

  const handleToggleCompleted = async (goal) => {
    // If marking as achieved (not already completed), show confirmation
    if (!goal.completed) {
      setConfirmAchieved(goal.id);
      return;
    }
    // If reactivating, do it immediately
    await updateGoal(goal.id, { completed: false });
  };

  const handleConfirmAchieved = async (goalId) => {
    await updateGoal(goalId, { completed: true });
    setConfirmAchieved(null);
  };

  const handleAddFunds = async () => {
    if (!selectedGoalForFunds || !fundAmount || fundAmount <= 0) return;
    await addAmountToGoal(selectedGoalForFunds.id, fundAmount);
    setSelectedGoalForFunds(null);
    setFundAmount(0);
    setView('list');
  };

  const openAddFunds = (goal) => {
    setSelectedGoalForFunds(goal);
    setFundAmount(0);
    setView('addFunds');
  };

  const openTransactions = (goal) => {
    setSelectedGoalForTransactions(goal);
    setView('transactions');
  };

  const getGoalTransactions = (goalId) => {
    return transactions
      .filter(t => t.goalId === goalId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getSortedGoals = () => {
    const sorted = [...goals];

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'value':
        return sorted.sort((a, b) => b.targetAmount - a.targetAmount);
      case 'created':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      case 'deadline':
      default:
        return sorted.sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        });
    }
  };

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calculate monthly investment needed for each goal
  const calculateGoalSummary = (goal) => {
    const investmentValue = getGoalInvestmentValue(goal.id);
    const currentSaved = investmentValue > 0 ? investmentValue : (goal.currentAmount || 0);
    const remainingAmount = Math.max(0, goal.targetAmount - currentSaved);
    const progress = getGoalProgress(goal, investmentValue);

    // If goal is completed or achieved
    if (goal.completed || remainingAmount <= 0) {
      return {
        goal,
        currentSaved,
        remainingAmount: 0,
        monthlyRequired: 0,
        monthsUntilDeadline: 0,
        status: 'achieved',
        progress: 100,
        hasDeadline: !!goal.deadline,
      };
    }

    // Calculate months until deadline
    if (goal.deadline) {
      const today = new Date();
      const deadlineDate = new Date(goal.deadline);
      const monthsDiff = (deadlineDate.getFullYear() - today.getFullYear()) * 12
        + (deadlineDate.getMonth() - today.getMonth());

      // If deadline has passed
      if (monthsDiff <= 0) {
        return {
          goal,
          currentSaved,
          remainingAmount,
          monthlyRequired: remainingAmount, // Full amount needed now
          monthsUntilDeadline: 0,
          status: 'overdue',
          progress,
          hasDeadline: true,
        };
      }

      return {
        goal,
        currentSaved,
        remainingAmount,
        monthlyRequired: remainingAmount / monthsDiff,
        monthsUntilDeadline: monthsDiff,
        status: 'active',
        progress,
        hasDeadline: true,
      };
    }

    // No deadline - assume DEFAULT_MONTHS_ASSUMPTION months
    return {
      goal,
      currentSaved,
      remainingAmount,
      monthlyRequired: remainingAmount / DEFAULT_MONTHS_ASSUMPTION,
      monthsUntilDeadline: DEFAULT_MONTHS_ASSUMPTION,
      status: 'no_deadline',
      progress,
      hasDeadline: false,
    };
  };

  // Get summary data for all active goals
  const getGoalsSummaryData = () => {
    const activeGoals = goals.filter(g => !g.completed);
    const summaries = activeGoals.map(calculateGoalSummary);

    // Calculate total monthly required (excluding achieved and overdue goals from total)
    const totalMonthlyRequired = summaries
      .filter(s => s.status === 'active' || s.status === 'no_deadline')
      .reduce((sum, s) => sum + s.monthlyRequired, 0);

    // Add overdue amounts separately
    const overdueTotal = summaries
      .filter(s => s.status === 'overdue')
      .reduce((sum, s) => sum + s.remainingAmount, 0);

    return {
      summaries,
      totalMonthlyRequired,
      overdueTotal,
      hasActiveGoals: summaries.some(s => s.status !== 'achieved'),
    };
  };

  // Monthly Investment Summary Component
  const MonthlyInvestmentSummary = () => {
    const { summaries, totalMonthlyRequired, overdueTotal, hasActiveGoals } = getGoalsSummaryData();

    if (goals.length === 0) return null;

    const activeSummaries = summaries.filter(s => s.status !== 'achieved');

    return (
      <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 sm:p-5 text-white mb-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">📊</span>
          </div>
          <h2 className="font-semibold text-base sm:text-lg">{t('goals.summary.title')}</h2>
        </div>

        {!hasActiveGoals ? (
          <p className="text-white/80 text-sm">{t('goals.summary.noActiveGoals')}</p>
        ) : (
          <>
            {/* Total Monthly Amount */}
            <div className="bg-white/10 rounded-xl p-3 sm:p-4 mb-3">
              <p className="text-white/70 text-xs sm:text-sm mb-1">{t('goals.summary.totalMonthly')}</p>
              <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(totalMonthlyRequired)}</p>
              {overdueTotal > 0 && (
                <p className="text-amber-200 text-xs sm:text-sm mt-1">
                  + {formatCurrency(overdueTotal)} {t('goals.summary.needsNow').toLowerCase()}
                </p>
              )}
            </div>

            {/* Toggle Details Button */}
            <button
              onClick={() => setShowSummaryDetails(!showSummaryDetails)}
              className="flex items-center gap-1 text-white/80 hover:text-white text-xs sm:text-sm mb-2 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showSummaryDetails ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showSummaryDetails ? t('goals.summary.hideDetails') : t('goals.summary.showDetails')}
            </button>

            {/* Detailed Breakdown */}
            {showSummaryDetails && (
              <div className="space-y-2 mt-3">
                <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{t('goals.summary.breakdown')}</p>
                {activeSummaries.map((summary) => {
                  const { goal, remainingAmount, monthlyRequired, monthsUntilDeadline, status, progress, hasDeadline } = summary;
                  const color = getGoalColor(goal.color);
                  const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;

                  return (
                    <div
                      key={goal.id}
                      className="bg-white/10 rounded-lg p-3 hover:bg-white/15 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-medium text-sm truncate">{goal.name}</h4>
                            {status === 'overdue' && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 bg-amber-400/20 text-amber-200 text-[10px] font-medium rounded">
                                {t('goals.summary.overdue')}
                              </span>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-1.5 mb-2">
                            <div
                              className="h-full bg-white/80 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <div>
                              <p className="text-white/60">{t('goals.summary.remaining')}</p>
                              <p className="font-medium">{formatCurrency(remainingAmount)}</p>
                            </div>
                            <div>
                              <p className="text-white/60">{t('goals.summary.monthlyRequired')}</p>
                              <p className="font-semibold text-amber-200">
                                {status === 'overdue'
                                  ? t('goals.summary.needsNow')
                                  : formatCurrency(monthlyRequired)
                                }
                              </p>
                            </div>
                            <div className="col-span-2 mt-1">
                              <p className="text-white/60">{t('goals.summary.deadline')}</p>
                              <p className="font-medium">
                                {status === 'overdue' && t('goals.summary.overdue')}
                                {status === 'active' && (
                                  <>
                                    {new Date(goal.deadline).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                    <span className="text-white/60 ml-1">
                                      ({t('goals.monthsLeft', { months: monthsUntilDeadline })})
                                    </span>
                                  </>
                                )}
                                {status === 'no_deadline' && (
                                  <span className="text-white/60">
                                    {t('goals.summary.noDeadline')} ({t('goals.summary.assumingMonths', { months: DEFAULT_MONTHS_ASSUMPTION })})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const GoalCard = ({ goal }) => {
    const color = getGoalColor(goal.color);
    const daysLeft = getDaysRemaining(goal.deadline);
    const monthlyNeeded = getMonthlyNeeded(goal);
    const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;
    const linkedInvestments = getInvestmentsByGoal(goal.id);
    const investmentValue = getGoalInvestmentValue(goal.id);
    const investmentGrowth = getGoalInvestmentGrowth(goal.id);

    // Calculate progress including both currentAmount and investment value
    const progress = getGoalProgress(goal, investmentValue);

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Goal icon - Hidden on mobile to save space */}
          <div className={`hidden sm:flex w-12 h-12 ${color.light} rounded-xl items-center justify-center text-2xl flex-shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{goal.name}</h3>
                {linkedInvestments.length > 0 && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-medium rounded-full flex items-center gap-0.5">
                    <span>📈</span>
                    <span>{linkedInvestments.length}</span>
                  </span>
                )}
              </div>
              {goal.completed && (
                <span className="flex-shrink-0 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                  {t('goals.completed')}
                </span>
              )}
            </div>
            {goal.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{goal.description}</p>
            )}

            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1.5">
                <span className={`font-medium ${investmentValue > 0 ? 'text-blue-500 dark:text-blue-400' : color.text}`}>
                  {investmentValue > 0 ? (
                    <>
                      {formatCurrency(investmentValue)}
                      {investmentGrowth !== 0 && (
                        <span className={investmentGrowth > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {' '}({investmentGrowth > 0 ? '+' : ''}{formatCurrency(investmentGrowth)})
                        </span>
                      )}
                    </>
                  ) : (
                    formatCurrency(goal.currentAmount || 0)
                  )}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{formatCurrency(goal.targetAmount)}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {progress.toFixed(0)}%
                </span>
                {daysLeft !== null && (
                  <span className={`text-xs ${daysLeft < 0 ? 'text-rose-500 dark:text-rose-400' : daysLeft < 30 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {daysLeft < 0
                      ? t('goals.overdue')
                      : t('goals.daysLeft', { days: daysLeft })}
                  </span>
                )}
              </div>

              {monthlyNeeded && !goal.completed && (
                <div className={`mt-2 px-3 py-2 rounded-lg ${color.light}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${color.text}`}>
                        {t('goals.monthlyNeeded', { amount: formatCurrency(monthlyNeeded.amount) })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('goals.monthsLeft', { months: monthlyNeeded.months })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-3">
              {!goal.completed && (
                <button
                  onClick={() => openAddFunds(goal)}
                  className="p-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition"
                  title={t('goals.addFunds')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => openTransactions(goal)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title={t('goals.viewTransactions')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </button>
              <button
                onClick={() => handleToggleCompleted(goal)}
                className={`p-2 rounded-lg transition ${
                  goal.completed
                    ? 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                    : 'text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                }`}
                title={goal.completed ? t('goals.markAsActive') : t('goals.markAsAchieved')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={() => handleOpenForm(goal)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title={t('common.edit')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(goal.id)}
                className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
                title={t('common.delete')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {confirmAchieved === goal.id && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-100 dark:border-emerald-800">
            <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
              {language === 'pt' ? 'Marcar meta como alcancada?' : 'Mark goal as achieved?'}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              {language === 'pt' ? 'Voce pode reativar esta meta depois se precisar.' : 'You can reactivate this goal later if needed.'}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleConfirmAchieved(goal.id)}
                className="flex-1 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition"
              >
                {language === 'pt' ? 'Confirmar' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmAchieved(null)}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {confirmDelete === goal.id && (
          <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/30 rounded-lg border border-rose-100 dark:border-rose-800">
            <p className="text-sm text-rose-800 dark:text-rose-200 font-medium">{t('goals.confirmDelete')}</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{t('goals.deleteWarning')}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleDelete(goal.id)}
                className="flex-1 py-2 bg-rose-500 text-white text-sm font-medium rounded-lg hover:bg-rose-600 transition"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {view === 'transactions' ? (
              <button
                onClick={() => {
                  setView('list');
                  setSelectedGoalForTransactions(null);
                }}
                className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            ) : null}
            <h1 className={`text-lg sm:text-xl font-semibold text-gray-900 dark:text-white ${view === 'list' ? 'pl-12 md:pl-0' : ''} ${view === 'transactions' ? 'flex-1 text-center pr-7' : ''}`}>
              {view === 'list' && t('goals.myGoals')}
              {view === 'form' && (editingGoal ? t('goals.editGoal') : t('goals.newGoal'))}
              {view === 'addFunds' && t('goals.addFundsTo', { goal: selectedGoalForFunds?.name })}
              {view === 'transactions' && t('goals.goalTransactions', { goal: selectedGoalForTransactions?.name })}
            </h1>
            {view === 'list' ? (
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium text-sm transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">{t('goals.addGoal')}</span>
              </button>
            ) : view !== 'transactions' ? (
              <button
                onClick={() => {
                  setView('list');
                  resetForm();
                  setSelectedGoalForFunds(null);
                  setSelectedGoalForTransactions(null);
                }}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8 pb-6">
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg dark:bg-amber-900/70">
              <span>↗</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {language === 'pt' ? 'Página de Metas em transição' : 'Goals page is being phased out'}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {language === 'pt'
                  ? 'Novos aportes e alocação de investimentos agora vivem nas subcamadas da Carteira, dentro do Planejador. Esta página continua disponível temporariamente para consulta e ajustes.'
                  : 'New investment allocation now lives in Carteira sublayers inside the Planner. This page remains available temporarily for review and edits.'}
              </p>
            </div>
          </div>
        </div>

        {view === 'list' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 dark:border-gray-500 mx-auto" />
                <p className="mt-3 text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
              </div>
            ) : goals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🎯</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">{t('goals.noGoals')}</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('goals.noGoalsSubtitle')}</p>
              </div>
            ) : (
              <>
                {/* Monthly Investment Summary */}
                <MonthlyInvestmentSummary />

                <div className="flex items-center justify-end gap-2 mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('goals.sortBy')}:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs pl-2 pr-8 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 focus:border-transparent cursor-pointer"
                  >
                    <option value="deadline">{t('goals.sortByDeadline')}</option>
                    <option value="name">{t('goals.sortByName')}</option>
                    <option value="value">{t('goals.sortByValue')}</option>
                    <option value="created">{t('goals.sortByCreated')}</option>
                  </select>
                </div>

                {getSortedGoals().map((goal) => <GoalCard key={goal.id} goal={goal} />)}
              </>
            )}
          </div>
        )}

        {view === 'form' && (
          <form onSubmit={handleSubmitGoal} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.goalName')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                  text-gray-900 dark:text-white placeholder-gray-400
                  focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
                placeholder={t('goals.goalNamePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.targetAmount')}
              </label>
              <CurrencyInput
                value={formData.targetAmount}
                onChange={(val) => setFormData({ ...formData, targetAmount: val })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.icon')}
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {Object.entries(GOAL_ICONS).map(([key, emoji]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: key })}
                    className={`p-2 sm:p-3 text-base sm:text-xl rounded-lg sm:rounded-xl border-2 transition ${
                      formData.icon === key
                        ? 'border-gray-900 dark:border-gray-400 bg-gray-100 dark:bg-gray-700'
                        : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                    title={t(`goals.icons.${key}`)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.color')}
              </label>
              <div className="flex flex-wrap gap-2">
                {GOAL_COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.name })}
                    className={`w-8 h-8 rounded-full ${color.bg} transition ring-offset-2 dark:ring-offset-gray-900 ${
                      formData.color === color.name ? 'ring-2 ring-gray-900 dark:ring-white' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.deadline')}
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                  text-gray-900 dark:text-white
                  focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl
                  text-gray-900 dark:text-white placeholder-gray-400
                  focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none transition resize-none"
                placeholder={t('goals.descriptionPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={!formData.name.trim() || !formData.targetAmount}
              className="w-full py-3.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                hover:bg-gray-800 dark:hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingGoal ? t('common.save') : t('goals.addGoal')}
            </button>
          </form>
        )}

        {view === 'addFunds' && selectedGoalForFunds && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-9 h-9 sm:w-12 sm:h-12 ${getGoalColor(selectedGoalForFunds.color).light} rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-2xl`}>
                  {GOAL_ICONS[selectedGoalForFunds.icon]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedGoalForFunds.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(() => {
                      const fundsInvestmentValue = getGoalInvestmentValue(selectedGoalForFunds.id);
                      const fundsInvestmentGrowth = getGoalInvestmentGrowth(selectedGoalForFunds.id);

                      if (fundsInvestmentValue > 0) {
                        return (
                          <span className="text-blue-500 dark:text-blue-400">
                            {formatCurrency(fundsInvestmentValue)}
                            {fundsInvestmentGrowth !== 0 && (
                              <span className={fundsInvestmentGrowth > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {' '}({fundsInvestmentGrowth > 0 ? '+' : ''}{formatCurrency(fundsInvestmentGrowth)})
                              </span>
                            )}
                          </span>
                        );
                      }
                      return `${formatCurrency(selectedGoalForFunds.currentAmount || 0)}`;
                    })()}
                    {' / '}
                    {formatCurrency(selectedGoalForFunds.targetAmount)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getGoalColor(selectedGoalForFunds.color).bg} rounded-full`}
                  style={{ width: `${getGoalProgress(selectedGoalForFunds, getGoalInvestmentValue(selectedGoalForFunds.id))}%` }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals.amount')}
              </label>
              <CurrencyInput
                value={fundAmount}
                onChange={setFundAmount}
              />
            </div>

            {fundAmount > 0 && (
              <div className="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">{t('goals.currentAmount')}:</span>
                  <span className="text-emerald-700 dark:text-emerald-300">{formatCurrency(selectedGoalForFunds.currentAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">+ {formatCurrency(fundAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-base mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-700">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-200">{t('goals.newTotal')}:</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency((selectedGoalForFunds.currentAmount || 0) + fundAmount)}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleAddFunds}
              disabled={!fundAmount || fundAmount <= 0}
              className="w-full py-3.5 bg-emerald-500 text-white font-medium rounded-xl
                hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('goals.addFunds')}
            </button>
          </div>
        )}

        {view === 'transactions' && selectedGoalForTransactions && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-9 h-9 sm:w-12 sm:h-12 ${getGoalColor(selectedGoalForTransactions.color).light} rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-2xl`}>
                  {GOAL_ICONS[selectedGoalForTransactions.icon]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedGoalForTransactions.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(() => {
                      const transInvestmentValue = getGoalInvestmentValue(selectedGoalForTransactions.id);
                      const transInvestmentGrowth = getGoalInvestmentGrowth(selectedGoalForTransactions.id);

                      if (transInvestmentValue > 0) {
                        return (
                          <span className="text-blue-500 dark:text-blue-400">
                            {formatCurrency(transInvestmentValue)}
                            {transInvestmentGrowth !== 0 && (
                              <span className={transInvestmentGrowth > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {' '}({transInvestmentGrowth > 0 ? '+' : ''}{formatCurrency(transInvestmentGrowth)})
                              </span>
                            )}
                          </span>
                        );
                      }
                      return `${formatCurrency(selectedGoalForTransactions.currentAmount || 0)}`;
                    })()}
                    {' / '}
                    {formatCurrency(selectedGoalForTransactions.targetAmount)}
                  </p>
                </div>
              </div>
            </div>

            {(() => {
              const goalTransactions = getGoalTransactions(selectedGoalForTransactions.id);
              const totalContributed = goalTransactions.reduce((sum, t) => sum + t.amount, 0);

              if (goalTransactions.length === 0) {
                return (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">📋</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">{t('goals.noTransactions')}</p>
                  </div>
                );
              }

              return (
                <>
                  <div className={`p-4 rounded-xl ${getGoalColor(selectedGoalForTransactions.color).light}`}>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('goals.totalContributed')}</p>
                    <p className={`text-xl font-bold ${getGoalColor(selectedGoalForTransactions.color).text}`}>
                      {formatCurrency(totalContributed)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {goalTransactions.map((trans) => {
                      const transDate = new Date(trans.date);
                      const monthKey = `${transDate.getFullYear()}-${String(transDate.getMonth() + 1).padStart(2, '0')}`;

                      return (
                        <button
                          key={trans.id}
                          onClick={() => navigate(`/transactions?month=${monthKey}&highlight=${trans.id}`)}
                          className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                                {trans.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                  {trans.category}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {transDate.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(trans.amount)}
                              </span>
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
