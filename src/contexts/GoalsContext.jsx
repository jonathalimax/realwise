import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useAccess } from './AccessContext';

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
    console.log('Goals useEffect - ownerId:', ownerId);

    if (!ownerId) {
      console.log('No ownerId, clearing goals');
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('Setting up goals listener for owner:', ownerId);

    const q = query(
      collection(db, 'goals'),
      where('userId', '==', ownerId) // Use ownerId instead of userId
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('Goals snapshot received:', snapshot.docs.length, 'documents');
        const goalsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Goals data:', goalsData);
        // Sort by createdAt
        goalsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
        setGoals(goalsData);
        setLoading(false);
      },
      (err) => {
        console.error('Goals query error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerId]); // Use ownerId instead of userId

  const addGoal = async (goalData) => {
    console.log('addGoal called with:', goalData);
    console.log('Current user:', auth.currentUser?.uid);

    if (!auth.currentUser) {
      console.error('No authenticated user');
      return null;
    }

    try {
      const newGoal = {
        userId: auth.currentUser.uid,
        name: goalData.name,
        targetAmount: goalData.targetAmount,
        currentAmount: 0,
        icon: goalData.icon || 'other',
        color: goalData.color || 'blue',
        deadline: goalData.deadline || null,
        description: goalData.description || '',
        createdAt: serverTimestamp(),
        completed: false
      };
      console.log('Saving goal to Firestore:', newGoal);

      const docRef = await addDoc(collection(db, 'goals'), newGoal);
      console.log('Goal saved with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding goal:', error);
      return null;
    }
  };

  const updateGoal = async (goalId, updates) => {
    try {
      const goalRef = doc(db, 'goals', goalId);
      await updateDoc(goalRef, updates);
      return true;
    } catch (error) {
      console.error('Error updating goal:', error);
      return false;
    }
  };

  const deleteGoal = async (goalId) => {
    try {
      await deleteDoc(doc(db, 'goals', goalId));
      return true;
    } catch (error) {
      console.error('Error deleting goal:', error);
      return false;
    }
  };

  const addAmountToGoal = async (goalId, amount) => {
    console.log('[GoalsContext] addAmountToGoal called - goalId:', goalId, 'amount:', amount);

    try {
      // Fetch current goal directly from Firestore to avoid stale state
      const goalDoc = await getDoc(doc(db, 'goals', goalId));
      if (!goalDoc.exists()) {
        console.error('[GoalsContext] Goal not found in Firestore:', goalId);
        return false;
      }

      const goal = { id: goalDoc.id, ...goalDoc.data() };
      const previousAmount = goal.currentAmount || 0;
      const newAmount = previousAmount + amount;
      const completed = newAmount >= goal.targetAmount;

      console.log('[GoalsContext] Updating goal progress:');
      console.log('  - Goal:', goal.name);
      console.log('  - Previous amount:', previousAmount);
      console.log('  - Amount to add:', amount);
      console.log('  - New amount:', newAmount);
      console.log('  - Target amount:', goal.targetAmount);
      console.log('  - Completed:', completed);

      const result = await updateGoal(goalId, {
        currentAmount: newAmount,
        completed
      });

      console.log('[GoalsContext] Update result:', result);
      return result;
    } catch (error) {
      console.error('[GoalsContext] Error updating goal:', error);
      return false;
    }
  };

  const getGoalProgress = (goal) => {
    if (!goal || !goal.targetAmount) return 0;
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
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
