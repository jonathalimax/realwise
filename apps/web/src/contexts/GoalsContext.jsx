import { createContext, useContext, useState, useEffect } from 'react';
import { useAccess } from './AccessContext';
import { requireOwnerId } from '../lib/auth/ownerSession';
import { goalsResource } from '../lib/api/resources/goals';

const GoalsContext = createContext();

// Predefined goal icons
export const GOAL_ICONS = {
  dream: '✨',
  education: '🎓',
  car: '🚗',
  home: '🏠',
  travel: '✈️',
  emergency: '🛡️',
  retirement: '🏖️',
  health: '💊',
  gift: '🎁',
  other: '🎯'
};

// Predefined goal colors
export const GOAL_COLORS = [
  { name: 'violet', bg: 'bg-violet-500', light: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-400' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400' },
  { name: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400' },
  { name: 'emerald', bg: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
  { name: 'teal', bg: 'bg-teal-500', light: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-600 dark:text-teal-400' },
  { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400' },
  { name: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-600 dark:text-indigo-400' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400' },
  { name: 'pink', bg: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-600 dark:text-pink-400' },
];

export function GoalsProvider({ children }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ownerId } = useAccess();

  // Listen for goals when ownerId is available
  useEffect(() => {
    if (!ownerId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    goalsResource.list()
      .then((rows) => {
        const goalsData = Array.isArray(rows) ? rows : [];
        goalsData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
        setGoals(goalsData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Goals query error:', err);
        setLoading(false);
      });
  }, [ownerId]); // Use ownerId instead of userId

  const addGoal = async (goalData) => {
    try {
      requireOwnerId(ownerId);
      const newGoal = {
        name: goalData.name,
        targetAmount: String(goalData.targetAmount),
        currentAmount: '0',
        icon: goalData.icon || 'other',
        color: goalData.color || 'blue',
        deadline: goalData.deadline || null,
        description: goalData.description || '',
        completed: false
      };
      const created = await goalsResource.create(newGoal);
      setGoals((prev) => [created, ...prev]);
      return created.id;
    } catch (error) {
      console.error('Error adding goal:', error);
      return null;
    }
  };

  const updateGoal = async (goalId, updates) => {
    try {
      const payload = {
        ...updates,
        ...(updates.targetAmount !== undefined ? { targetAmount: String(updates.targetAmount) } : {}),
        ...(updates.currentAmount !== undefined ? { currentAmount: String(updates.currentAmount) } : {}),
      };
      const updated = await goalsResource.update(goalId, payload);
      setGoals((prev) => prev.map((goal) => (goal.id === goalId ? updated : goal)));
      return true;
    } catch (error) {
      console.error('Error updating goal:', error);
      return false;
    }
  };

  const deleteGoal = async (goalId) => {
    try {
      await goalsResource.remove(goalId);
      setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
      return true;
    } catch (error) {
      console.error('Error deleting goal:', error);
      return false;
    }
  };

  const addAmountToGoal = async (goalId, amount) => {
    try {
      const goal = goals.find((item) => item.id === goalId) || await goalsResource.get(goalId);
      if (!goal) {
        console.error('[GoalsContext] Goal not found:', goalId);
        return false;
      }

      const previousAmount = Number(goal.currentAmount || 0);
      const newAmount = previousAmount + amount;
      const completed = newAmount >= Number(goal.targetAmount || 0);

      const result = await updateGoal(goalId, {
        currentAmount: newAmount,
        completed
      });

      return result;
    } catch (error) {
      console.error('[GoalsContext] Error updating goal:', error);
      return false;
    }
  };

  // Calculate goal progress - optionally include linked investment value
  // IMPORTANT: When investments are linked to a goal, we use ONLY the investment value
  // for progress calculation. The goal's currentAmount is for manual cash contributions
  // that are NOT from investments. If investmentValue > 0, it means all the savings
  // for this goal are in investments, so we don't add currentAmount to avoid double counting.
  const getGoalProgress = (goal, investmentValue = 0) => {
    if (!goal || !goal.targetAmount) return 0;

    // If there are linked investments, use ONLY the investment value for progress
    // The investment value already represents the total saved amount for this goal
    // Adding currentAmount would double count if user withdrew from investment to goal
    const totalValue = investmentValue > 0 ? investmentValue : (goal.currentAmount || 0);

    return Math.min((totalValue / goal.targetAmount) * 100, 100);
  };

  const getMonthlyNeeded = (goal) => {
    if (!goal || !goal.deadline || goal.completed) return null;

    const remaining = goal.targetAmount - (goal.currentAmount || 0);
    if (remaining <= 0) return null;

    const today = new Date();
    const deadlineDate = new Date(goal.deadline);

    // Calculate months remaining
    const monthsDiff = (deadlineDate.getFullYear() - today.getFullYear()) * 12
      + (deadlineDate.getMonth() - today.getMonth());

    // If deadline is in the past or this month, return null
    if (monthsDiff <= 0) return null;

    return {
      amount: remaining / monthsDiff,
      months: monthsDiff
    };
  };

  const getGoalColor = (colorName) => {
    return GOAL_COLORS.find(c => c.name === colorName) || GOAL_COLORS[5]; // default blue
  };

  return (
    <GoalsContext.Provider value={{
      goals,
      loading,
      addGoal,
      updateGoal,
      deleteGoal,
      addAmountToGoal,
      getGoalProgress,
      getMonthlyNeeded,
      getGoalColor,
      goalIcons: GOAL_ICONS,
      goalColors: GOAL_COLORS
    }}>
      {children}
    </GoalsContext.Provider>
  );
}

export const useGoals = () => {
  const context = useContext(GoalsContext);
  if (!context) {
    console.error('useGoals must be used within a GoalsProvider');
    return {
      goals: [],
      loading: false,
      addGoal: async () => null,
      updateGoal: async () => false,
      deleteGoal: async () => false,
      addAmountToGoal: async () => false,
      getGoalProgress: () => 0,
      getMonthlyNeeded: () => null,
      getGoalColor: () => GOAL_COLORS[5],
      goalIcons: GOAL_ICONS,
      goalColors: GOAL_COLORS
    };
  }
  return context;
};
