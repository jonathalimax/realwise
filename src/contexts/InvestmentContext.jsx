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
  serverTimestamp
} from 'firebase/firestore';

const InvestmentContext = createContext();

// Investment types with icons and colors
export const INVESTMENT_TYPES = {
  fixed_income: { icon: '📈', color: 'blue', label: 'fixed_income' },
  stocks: { icon: '📊', color: 'emerald', label: 'stocks' },
  crypto: { icon: '₿', color: 'orange', label: 'crypto' },
  funds: { icon: '💼', color: 'purple', label: 'funds' },
  real_estate: { icon: '🏠', color: 'amber', label: 'real_estate' },
};

// Investment colors (reusing goal colors pattern)
export const INVESTMENT_COLORS = [
  { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400' },
  { name: 'emerald', bg: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400' },
  { name: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400' },
  { name: 'rose', bg: 'bg-rose-500', light: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-600 dark:text-rose-400' },
  { name: 'teal', bg: 'bg-teal-500', light: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-600 dark:text-teal-400' },
  { name: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-600 dark:text-indigo-400' },
];

// Return type options
export const RETURN_TYPES = {
  cdi: 'cdi',
  annual: 'annual',
  monthly: 'monthly',
  total: 'total',
};

// Current CDI annual rate (Selic rate - update periodically)
// As of Dec 2024, Selic is approximately 12.25% per year
export const CDI_ANNUAL_RATE = 0.1225;

export function InvestmentProvider({ children }) {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Listen for investments when userId is available
  useEffect(() => {
    if (!userId) {
      setInvestments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'investments'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const investmentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort by createdAt
        investmentsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
        setInvestments(investmentsData);
        setLoading(false);
      },
      (err) => {
        console.error('Investments query error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Calculate projected value based on return rate and time
  const calculateProjectedValue = (investment) => {
    const { initialAmount, currentAmount, expectedReturn, returnType, maturityDate, purchaseDate, createdAt } = investment;

    // If user has manually set currentAmount, use it
    if (currentAmount && currentAmount !== initialAmount) {
      return currentAmount;
    }

    // If no expected return, return initial amount
    if (!expectedReturn || expectedReturn === 0) {
      return initialAmount;
    }

    // For total return type, simple calculation
    if (returnType === 'total') {
      return initialAmount * (1 + expectedReturn);
    }

    // Get start date - prefer purchaseDate, fallback to createdAt
    const startDate = purchaseDate
      ? new Date(purchaseDate + 'T12:00:00')
      : (createdAt?.toDate?.() || new Date());

    // Calculate to today
    const today = new Date();
    const diffMs = today - startDate;
    const years = Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));

    // Handle CDI-based calculation
    if (returnType === 'cdi') {
      // expectedReturn is the percentage of CDI (e.g., 1.0 = 100% CDI, 1.1 = 110% CDI)
      const effectiveAnnualRate = CDI_ANNUAL_RATE * expectedReturn;
      // Use compound interest formula: P * (1 + r)^t
      return initialAmount * Math.pow(1 + effectiveAnnualRate, years);
    }

    if (returnType === 'annual') {
      return initialAmount * Math.pow(1 + expectedReturn, years);
    }

    if (returnType === 'monthly') {
      const months = years * 12;
      return initialAmount * Math.pow(1 + expectedReturn, months);
    }

    return initialAmount;
  };

  // Get current value (manual override or projected)
  const getCurrentValue = (investment) => {
    if (investment.currentAmount && investment.currentAmount !== investment.initialAmount) {
      return investment.currentAmount;
    }
    return calculateProjectedValue(investment);
  };

  // Calculate growth percentage
  const getGrowthPercentage = (investment) => {
    const currentValue = getCurrentValue(investment);
    if (!investment.initialAmount || investment.initialAmount === 0) return 0;
    return ((currentValue - investment.initialAmount) / investment.initialAmount) * 100;
  };

  // Get total invested amount
  const getTotalInvested = () => {
    return investments.reduce((sum, inv) => sum + (inv.initialAmount || 0), 0);
  };

  // Get total current value (portfolio value)
  const getTotalCurrentValue = () => {
    return investments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  };

  // Get total growth
  const getTotalGrowth = () => {
    const invested = getTotalInvested();
    const current = getTotalCurrentValue();
    return current - invested;
  };

  // Get investments linked to a specific goal
  const getInvestmentsByGoal = (goalId) => {
    return investments.filter(inv => inv.goalId === goalId);
  };

  // Get total investment value for a goal
  const getGoalInvestmentValue = (goalId) => {
    return getInvestmentsByGoal(goalId).reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  };

  // Add new investment
  const addInvestment = async (investmentData, createTransaction = true) => {
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return null;
    }

    try {
      const newInvestment = {
        userId: auth.currentUser.uid,
        name: investmentData.name,
        type: investmentData.type || 'fixed_income',
        bank: investmentData.bank || '',
        initialAmount: investmentData.initialAmount || 0,
        currentAmount: investmentData.currentAmount || investmentData.initialAmount || 0,
        expectedReturn: investmentData.expectedReturn || 0,
        returnType: investmentData.returnType || 'annual',
        purchaseDate: investmentData.purchaseDate || new Date().toISOString().split('T')[0],
        maturityDate: investmentData.maturityDate || null,
        goalId: investmentData.goalId || null,
        notes: investmentData.notes || '',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'investments'), newInvestment);

      // Create expense transaction if requested
      if (createTransaction && investmentData.initialAmount > 0) {
        const txDate = investmentData.purchaseDate
          ? new Date(investmentData.purchaseDate + 'T12:00:00')
          : new Date();
        const transactionData = {
          userId: auth.currentUser.uid,
          type: 'expense',
          description: `Investment: ${investmentData.name}`,
          amount: investmentData.initialAmount,
          category: 'Investments',
          date: txDate.toISOString(),
          createdAt: serverTimestamp(),
          investmentId: docRef.id,
          bankId: investmentData.bank || null,
        };

        const txRef = await addDoc(collection(db, 'transactions'), transactionData);

        // Update investment with transaction reference
        await updateDoc(doc(db, 'investments', docRef.id), {
          transactionId: txRef.id
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error adding investment:', error);
      return null;
    }
  };

  // Update investment
  const updateInvestment = async (investmentId, updates) => {
    try {
      const investmentRef = doc(db, 'investments', investmentId);
      await updateDoc(investmentRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating investment:', error);
      return false;
    }
  };

  // Delete investment
  const deleteInvestment = async (investmentId) => {
    try {
      await deleteDoc(doc(db, 'investments', investmentId));
      return true;
    } catch (error) {
      console.error('Error deleting investment:', error);
      return false;
    }
  };

  // Get investment color
  const getInvestmentColor = (colorName) => {
    return INVESTMENT_COLORS.find(c => c.name === colorName) || INVESTMENT_COLORS[0];
  };

  // Get investment type info
  const getInvestmentType = (typeName) => {
    return INVESTMENT_TYPES[typeName] || INVESTMENT_TYPES.fixed_income;
  };

  // Get days until maturity
  const getDaysUntilMaturity = (investment) => {
    if (!investment.maturityDate) return null;
    const today = new Date();
    const maturityDate = new Date(investment.maturityDate);
    const diffTime = maturityDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <InvestmentContext.Provider value={{
      investments,
      loading,
      addInvestment,
      updateInvestment,
      deleteInvestment,
      calculateProjectedValue,
      getCurrentValue,
      getGrowthPercentage,
      getTotalInvested,
      getTotalCurrentValue,
      getTotalGrowth,
      getInvestmentsByGoal,
      getGoalInvestmentValue,
      getInvestmentColor,
      getInvestmentType,
      getDaysUntilMaturity,
      investmentTypes: INVESTMENT_TYPES,
      investmentColors: INVESTMENT_COLORS,
      returnTypes: RETURN_TYPES,
    }}>
      {children}
    </InvestmentContext.Provider>
  );
}

export const useInvestments = () => {
  const context = useContext(InvestmentContext);
  if (!context) {
    console.error('useInvestments must be used within an InvestmentProvider');
    return {
      investments: [],
      loading: false,
      addInvestment: async () => null,
      updateInvestment: async () => false,
      deleteInvestment: async () => false,
      calculateProjectedValue: () => 0,
      getCurrentValue: () => 0,
      getGrowthPercentage: () => 0,
      getTotalInvested: () => 0,
      getTotalCurrentValue: () => 0,
      getTotalGrowth: () => 0,
      getInvestmentsByGoal: () => [],
      getGoalInvestmentValue: () => 0,
      getInvestmentColor: () => INVESTMENT_COLORS[0],
      getInvestmentType: () => INVESTMENT_TYPES.fixed_income,
      getDaysUntilMaturity: () => null,
      investmentTypes: INVESTMENT_TYPES,
      investmentColors: INVESTMENT_COLORS,
      returnTypes: RETURN_TYPES,
    };
  }
  return context;
};
