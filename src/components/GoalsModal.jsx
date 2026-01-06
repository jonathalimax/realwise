import { useState } from 'react';
import { useGoals, GOAL_ICONS, GOAL_COLORS } from '../contexts/GoalsContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInvestments } from '../contexts/InvestmentContext';
import CurrencyInput from './ui/CurrencyInput';

export default function GoalsModal({ isOpen, onClose, transactions = [] }) {
  const { goals, loading, addGoal, updateGoal, deleteGoal, addAmountToGoal, getGoalProgress, getMonthlyNeeded, getGoalColor } = useGoals();
  const { formatCurrency, t, language } = useSettings();
  const { getInvestmentsByGoal, getGoalInvestmentValue, getGoalInvestmentGrowth } = useInvestments();

  const [view, setView] = useState('list'); // 'list', 'form', 'addFunds', 'transactions'
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedGoalForFunds, setSelectedGoalForFunds] = useState(null);
  const [selectedGoalForTransactions, setSelectedGoalForTransactions] = useState(null);
  const [fundAmount, setFundAmount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortBy, setSortBy] = useState('deadline'); // 'deadline', 'name', 'value', 'created'

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    targetAmount: 0,
    icon: 'other',
    color: 'blue',
    deadline: '',
    description: ''
  });

  if (!isOpen) return null;

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
    await updateGoal(goal.id, { completed: !goal.completed });
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

  // Get transactions linked to a specific goal
  const getGoalTransactions = (goalId) => {
    return transactions
      .filter(t => t.goalId === goalId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Sort goals based on selected criteria
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
          // Goals without deadline go to the end
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

  const GoalCard = ({ goal }) => {
    const color = getGoalColor(goal.color);
    const progress = getGoalProgress(goal);
    const daysLeft = getDaysRemaining(goal.deadline);
    const monthlyNeeded = getMonthlyNeeded(goal);
    const icon = GOAL_ICONS[goal.icon] || GOAL_ICONS.other;
    const linkedInvestments = getInvestmentsByGoal(goal.id);
    const investmentValue = getGoalInvestmentValue(goal.id);
    const investmentGrowth = getGoalInvestmentGrowth(goal.id);

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 ${color.light} rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}>
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

            {/* Progress bar */}
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

              {/* Monthly needed */}
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

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              {!goal.completed && (
                <button
                  onClick={() => openAddFunds(goal)}
                  className={`flex-1 py-2 ${color.bg} text-white text-sm font-medium rounded-lg hover:opacity-90 transition`}
                >
                  {t('goals.addFunds')}
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
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => setConfirmDelete(goal.id)}
                className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <button
                onClick={() => {
                  setView('list');
                  resetForm();
                  setSelectedGoalForFunds(null);
                  setSelectedGoalForTransactions(null);
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {view === 'list' && t('goals.myGoals')}
              {view === 'form' && (editingGoal ? t('goals.editGoal') : t('goals.newGoal'))}
              {view === 'addFunds' && t('goals.addFundsTo', { goal: selectedGoalForFunds?.name })}
              {view === 'transactions' && t('goals.goalTransactions', { goal: selectedGoalForTransactions?.name })}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* List View */}
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
                  {/* Sort Dropdown */}
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

                  {/* Goals List */}
                  {getSortedGoals().map((goal) => <GoalCard key={goal.id} goal={goal} />)}
                </>
              )}
            </div>
          )}

          {/* Form View */}
          {view === 'form' && (
            <form onSubmit={handleSubmitGoal} className="space-y-5">
              {/* Name */}
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

              {/* Target Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals.targetAmount')}
                </label>
                <CurrencyInput
                  value={formData.targetAmount}
                  onChange={(val) => setFormData({ ...formData, targetAmount: val })}
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals.icon')}
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {Object.entries(GOAL_ICONS).map(([key, emoji]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: key })}
                      className={`p-3 text-xl rounded-xl border-2 transition ${
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

              {/* Color Selection */}
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

              {/* Deadline */}
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

              {/* Description */}
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

              {/* Submit */}
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

          {/* Add Funds View */}
          {view === 'addFunds' && selectedGoalForFunds && (
            <div className="space-y-5">
              {/* Goal Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${getGoalColor(selectedGoalForFunds.color).light} rounded-xl flex items-center justify-center text-2xl`}>
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
                    style={{ width: `${getGoalProgress(selectedGoalForFunds)}%` }}
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals.amount')}
                </label>
                <CurrencyInput
                  value={fundAmount}
                  onChange={setFundAmount}
                />
              </div>

              {/* Preview new total */}
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

              {/* Submit */}
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

          {/* Transactions View */}
          {view === 'transactions' && selectedGoalForTransactions && (
            <div className="space-y-4">
              {/* Goal Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${getGoalColor(selectedGoalForTransactions.color).light} rounded-xl flex items-center justify-center text-2xl`}>
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

              {/* Transaction List */}
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
                    {/* Total */}
                    <div className={`p-4 rounded-xl ${getGoalColor(selectedGoalForTransactions.color).light}`}>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('goals.totalContributed')}</p>
                      <p className={`text-xl font-bold ${getGoalColor(selectedGoalForTransactions.color).text}`}>
                        {formatCurrency(totalContributed)}
                      </p>
                    </div>

                    {/* Transactions */}
                    <div className="space-y-2">
                      {goalTransactions.map((trans) => (
                        <div
                          key={trans.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                              {trans.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(trans.date).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 ml-3">
                            +{formatCurrency(trans.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer - Add button for list view */}
        {view === 'list' && (
          <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => handleOpenForm()}
              className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl
                hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('goals.addGoal')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
