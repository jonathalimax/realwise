import { createContext, useContext } from 'react';

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

const defaultGoalsContextValue = {
  goals: [],
  loading: false,
  addGoal: async () => null,
  updateGoal: async () => false,
  deleteGoal: async () => false,
  addAmountToGoal: async () => false,
  getGoalProgress: () => 0,
  getMonthlyNeeded: () => null,
  getGoalColor: (colorName) => GOAL_COLORS.find(c => c.name === colorName) || GOAL_COLORS[5],
  goalIcons: GOAL_ICONS,
  goalColors: GOAL_COLORS,
};

export function GoalsProvider({ children }) {
  return (
    <GoalsContext.Provider value={defaultGoalsContextValue}>
      {children}
    </GoalsContext.Provider>
  );
}

export const useGoals = () => {
  const context = useContext(GoalsContext);
  if (!context) {
    return defaultGoalsContextValue;
  }
  return context;
};
