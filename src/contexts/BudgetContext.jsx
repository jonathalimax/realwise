import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAccess } from './AccessContext';

const BudgetContext = createContext();

// Default category to 50/30/20 rule mapping
export const DEFAULT_RULE_MAPPING = {
  // Needs (50%) - Essential expenses
  'Housing': 'needs', 'Moradia': 'needs',
  'Bills': 'needs', 'Contas': 'needs',
  'Food': 'needs', 'Alimentação': 'needs',
  'Healthcare': 'needs', 'Saúde': 'needs',
  'Vehicle': 'needs', 'Veículo': 'needs',
  'Taxes': 'needs', 'Impostos': 'needs',

  // Wants (30%) - Non-essential
  'Leisure': 'wants', 'Lazer': 'wants',
  'Clothing': 'wants', 'Vestuário': 'wants',
  'Subscriptions': 'wants', 'Assinaturas': 'wants',
  'Travel': 'wants', 'Viagens': 'wants',
  'Education': 'wants', 'Educação': 'wants',
  'Other': 'wants', 'Diversos': 'wants',

  // Savings (20%) - Investments
  'Investments': 'savings', 'Investimentos': 'savings',
};

export const RULE_COLORS = {
  needs: {
    bg: 'bg-blue-500',
    light: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  wants: {
    bg: 'bg-purple-500',
    light: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  savings: {
    bg: 'bg-emerald-500',
    light: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
};

// Default rule percentages (50/30/20)
export const DEFAULT_RULE_PERCENTAGES = {
  needs: 50,
  wants: 30,
  savings: 20,
};

export function BudgetProvider({ children }) {
  const [budgets, setBudgets] = useState([]);
  const [categoryRuleMapping, setCategoryRuleMappingState] = useState(DEFAULT_RULE_MAPPING);
  const [rulePercentages, setRulePercentagesState] = useState(DEFAULT_RULE_PERCENTAGES);
  const [loading, setLoading] = useState(true);
  const { ownerId } = useAccess();

  // Listen for budget documents
  useEffect(() => {
    if (!auth.currentUser || !ownerId) {
      setLoading(false);
      return;
    }

    const budgetsQuery = query(
      collection(db, 'budgets'),
      where('userId', '==', ownerId) // Use ownerId instead of currentUser.uid
    );

    const unsubscribe = onSnapshot(budgetsQuery, (snapshot) => {
      const budgetData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBudgets(budgetData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]); // Use ownerId instead of currentUser.uid

  // Get budget for a specific month
  const getBudgetForMonth = (month) => {
    return budgets.find(b => b.month === month) || null;
  };

  // Set category budget for a month
  const setCategoryBudget = async (month, category, amount) => {
    if (!auth.currentUser) return;

    const existingBudget = getBudgetForMonth(month);
    const budgetId = existingBudget?.id || `${auth.currentUser.uid}_${month}`;
    const budgetRef = doc(db, 'budgets', budgetId);

    const currentCategoryBudgets = existingBudget?.categoryBudgets || {};

    await setDoc(budgetRef, {
      userId: auth.currentUser.uid,
      month,
      categoryBudgets: {
        ...currentCategoryBudgets,
        [category]: amount
      },
      totalBudget: existingBudget?.totalBudget || 0,
      updatedAt: serverTimestamp(),
      ...(existingBudget ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
  };

  // Set total monthly budget
  const setTotalBudget = async (month, amount) => {
    if (!auth.currentUser) return;

    const existingBudget = getBudgetForMonth(month);
    const budgetId = existingBudget?.id || `${auth.currentUser.uid}_${month}`;
    const budgetRef = doc(db, 'budgets', budgetId);

    await setDoc(budgetRef, {
      userId: auth.currentUser.uid,
      month,
      totalBudget: amount,
      categoryBudgets: existingBudget?.categoryBudgets || {},
      updatedAt: serverTimestamp(),
      ...(existingBudget ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
  };

  // Set all category budgets at once
  const setAllCategoryBudgets = async (month, categoryBudgets, totalBudget = 0) => {
    if (!auth.currentUser) return;

    const existingBudget = getBudgetForMonth(month);
    const budgetId = existingBudget?.id || `${auth.currentUser.uid}_${month}`;
    const budgetRef = doc(db, 'budgets', budgetId);

    await setDoc(budgetRef, {
      userId: auth.currentUser.uid,
      month,
      categoryBudgets,
      totalBudget,
      updatedAt: serverTimestamp(),
      ...(existingBudget ? {} : { createdAt: serverTimestamp() })
    }, { merge: true });
  };

  // Calculate spending per category from transactions
  const calculateCategorySpending = (transactions) => {
    const spending = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        spending[t.category] = (spending[t.category] || 0) + t.amount;
      });
    return spending;
  };

  // Get budget status based on percentage
  const getBudgetStatus = (spent, limit) => {
    if (!limit || limit === 0) return 'none';
    const percentage = (spent / limit) * 100;
    if (percentage > 100) return 'exceeded';
    if (percentage >= 70) return 'warning';
    return 'good';
  };

  // Get status color classes
  const getStatusColor = (status) => {
    switch (status) {
      case 'exceeded':
        return {
          bg: 'bg-rose-500',
          light: 'bg-rose-100 dark:bg-rose-900/30',
          text: 'text-rose-600 dark:text-rose-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500',
          light: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-600 dark:text-amber-400',
        };
      case 'good':
        return {
          bg: 'bg-emerald-500',
          light: 'bg-emerald-100 dark:bg-emerald-900/30',
          text: 'text-emerald-600 dark:text-emerald-400',
        };
      default:
        return {
          bg: 'bg-gray-300',
          light: 'bg-gray-100 dark:bg-gray-700',
          text: 'text-gray-500 dark:text-gray-400',
        };
    }
  };

  // Calculate rule comparison with custom percentages
  const calculate50_30_20 = (transactions, totalIncome, customMapping = null) => {
    const mapping = customMapping || categoryRuleMapping;
    const percentages = rulePercentages;
    const totals = { needs: 0, wants: 0, savings: 0 };

    // Calculate expense totals by rule category
    transactions
      .filter(t => t.type === 'expense' && !t.ignored)
      .forEach(t => {
        const rule = mapping[t.category] || 'wants';
        totals[rule] += t.amount;
      });

    // Add goal contributions to savings (income allocated to goals)
    transactions
      .filter(t => t.type === 'income' && t.goalId && !t.ignored)
      .forEach(t => {
        totals.savings += t.amount;
      });

    const targets = {
      needs: totalIncome * (percentages.needs / 100),
      wants: totalIncome * (percentages.wants / 100),
      savings: totalIncome * (percentages.savings / 100),
    };

    return {
      needs: {
        spent: totals.needs,
        target: targets.needs,
        percentage: totalIncome > 0 ? (totals.needs / totalIncome) * 100 : 0,
        targetPercentage: percentages.needs,
        difference: targets.needs - totals.needs,
        status: totals.needs <= targets.needs ? 'good' : 'exceeded',
      },
      wants: {
        spent: totals.wants,
        target: targets.wants,
        percentage: totalIncome > 0 ? (totals.wants / totalIncome) * 100 : 0,
        targetPercentage: percentages.wants,
        difference: targets.wants - totals.wants,
        status: totals.wants <= targets.wants ? 'good' : 'exceeded',
      },
      savings: {
        spent: totals.savings,
        target: targets.savings,
        percentage: totalIncome > 0 ? (totals.savings / totalIncome) * 100 : 0,
        targetPercentage: percentages.savings,
        difference: targets.savings - totals.savings,
        status: totals.savings >= targets.savings ? 'good' : 'warning',
      },
    };
  };

  // Get rule for a category
  const getCategoryRule = (category) => {
    return categoryRuleMapping[category] || 'wants';
  };

  // Set rule for a category
  const setCategoryRule = async (category, rule) => {
    const newMapping = {
      ...categoryRuleMapping,
      [category]: rule
    };
    setCategoryRuleMappingState(newMapping);

    // Persist to Firestore in settings
    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      await setDoc(settingsRef, { categoryRuleMapping: newMapping }, { merge: true });
    }
  };

  // Set custom rule percentages
  const setRulePercentages = async (newPercentages) => {
    // Ensure percentages sum to 100
    const total = newPercentages.needs + newPercentages.wants + newPercentages.savings;
    if (total !== 100) {
      console.warn('Rule percentages must sum to 100');
      return false;
    }

    setRulePercentagesState(newPercentages);

    // Persist to Firestore in settings
    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      await setDoc(settingsRef, { rulePercentages: newPercentages }, { merge: true });
    }
    return true;
  };

  // Reset to default 50/30/20
  const resetRulePercentages = async () => {
    setRulePercentagesState(DEFAULT_RULE_PERCENTAGES);

    if (auth.currentUser) {
      const settingsRef = doc(db, 'settings', auth.currentUser.uid);
      await setDoc(settingsRef, { rulePercentages: DEFAULT_RULE_PERCENTAGES }, { merge: true });
    }
  };

  // Load category rule mapping and percentages from settings
  useEffect(() => {
    if (!auth.currentUser || !ownerId) return;

    const settingsRef = doc(db, 'settings', ownerId); // Use ownerId
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.categoryRuleMapping) {
          setCategoryRuleMappingState({
            ...DEFAULT_RULE_MAPPING,
            ...data.categoryRuleMapping
          });
        }
        if (data.rulePercentages) {
          setRulePercentagesState({
            ...DEFAULT_RULE_PERCENTAGES,
            ...data.rulePercentages
          });
        }
      }
    });

    return () => unsubscribe();
  }, [ownerId]); // Use ownerId

  // Auto-distribute budget based on custom percentages
  const autoDistributeBudget = (totalBudget, expenseCategories, mapping = null) => {
    const ruleMapping = mapping || categoryRuleMapping;
    const percentages = rulePercentages;
    const distribution = { needs: [], wants: [], savings: [] };

    // Group categories by rule
    expenseCategories.forEach(cat => {
      const rule = ruleMapping[cat] || 'wants';
      distribution[rule].push(cat);
    });

    const categoryBudgets = {};
    const amounts = {
      needs: totalBudget * (percentages.needs / 100),
      wants: totalBudget * (percentages.wants / 100),
      savings: totalBudget * (percentages.savings / 100),
    };

    // Distribute evenly within each rule group
    Object.entries(distribution).forEach(([rule, categories]) => {
      if (categories.length > 0) {
        const perCategory = amounts[rule] / categories.length;
        categories.forEach(cat => {
          categoryBudgets[cat] = Math.round(perCategory * 100) / 100;
        });
      }
    });

    return categoryBudgets;
  };

  return (
    <BudgetContext.Provider value={{
      budgets,
      loading,
      getBudgetForMonth,
      setCategoryBudget,
      setTotalBudget,
      setAllCategoryBudgets,
      calculateCategorySpending,
      getBudgetStatus,
      getStatusColor,
      calculate50_30_20,
      categoryRuleMapping,
      getCategoryRule,
      setCategoryRule,
      rulePercentages,
      setRulePercentages,
      resetRulePercentages,
      autoDistributeBudget,
      RULE_COLORS,
    }}>
      {children}
    </BudgetContext.Provider>
  );
}

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) {
    return {
      budgets: [],
      loading: false,
      getBudgetForMonth: () => null,
      setCategoryBudget: () => {},
      setTotalBudget: () => {},
      setAllCategoryBudgets: () => {},
      calculateCategorySpending: () => ({}),
      getBudgetStatus: () => 'none',
      getStatusColor: () => ({ bg: 'bg-gray-300', light: 'bg-gray-100', text: 'text-gray-500' }),
      calculate50_30_20: () => ({ needs: {}, wants: {}, savings: {} }),
      categoryRuleMapping: DEFAULT_RULE_MAPPING,
      getCategoryRule: () => 'wants',
      setCategoryRule: () => {},
      rulePercentages: DEFAULT_RULE_PERCENTAGES,
      setRulePercentages: () => false,
      resetRulePercentages: () => {},
      autoDistributeBudget: () => ({}),
      RULE_COLORS,
    };
  }
  return context;
};
