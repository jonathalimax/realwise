import { createContext, useContext, useState, useEffect } from 'react';
import { useAccess } from './AccessContext';
import { transactionsResource } from '../lib/api/resources/transactions';
import { investmentsResource } from '../lib/api/resources/investments';

const InvestmentContext = createContext();

// Investment types with icons and colors
export const INVESTMENT_TYPES = {
  fixed_income: { icon: '📈', color: 'blue', label: 'fixed_income' },
  stocks: { icon: '📊', color: 'emerald', label: 'stocks' },
  crypto: { icon: '₿', color: 'orange', label: 'crypto' },
  funds: { icon: '💼', color: 'purple', label: 'funds' },
  fii: { icon: '🏢', color: 'teal', label: 'fii' },
  etf: { icon: '🎯', color: 'amber', label: 'etf' },
  other: { icon: '📦', color: 'indigo', label: 'other' },
};

// Investment colors (reusing goal colors pattern)
export const INVESTMENT_COLORS = [
  { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400' },
  { name: 'emerald', bg: 'bg-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400' },
  { name: 'amber', bg: 'bg-amber-500', light: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400' },
  { name: 'violet', bg: 'bg-violet-500', light: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-400' },
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
// As of Dec 2024, Selic is approximately 13.25% per year
// Banks use 252 business days for CDI calculation
export const CDI_ANNUAL_RATE = 0.1325;
export const BUSINESS_DAYS_PER_YEAR = 252;

// IOF rates table (decreasing daily over 30 days)
// Day 1: 96%, Day 2: 93%, ..., Day 29: 3%, Day 30+: 0%
export const IOF_RATES = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66,  // Days 1-10
  63, 60, 56, 53, 50, 46, 43, 40, 36, 33,  // Days 11-20
  30, 26, 23, 20, 16, 13, 10, 6, 3, 0      // Days 21-30
];

// IRPF rates for fixed income (regressive based on holding period)
export const IRPF_RATES = {
  upTo180: 0.225,    // 22.5% - up to 180 days
  upTo360: 0.20,     // 20% - 181 to 360 days
  upTo720: 0.175,    // 17.5% - 361 to 720 days
  above720: 0.15,    // 15% - above 720 days
};

// Get IOF rate based on days held
export const getIOFRate = (daysHeld) => {
  if (daysHeld >= 30) return 0;
  if (daysHeld < 1) return IOF_RATES[0] / 100;
  return IOF_RATES[Math.floor(daysHeld) - 1] / 100;
};

// Get IRPF rate based on days held
export const getIRPFRate = (daysHeld) => {
  if (daysHeld <= 180) return IRPF_RATES.upTo180;
  if (daysHeld <= 360) return IRPF_RATES.upTo360;
  if (daysHeld <= 720) return IRPF_RATES.upTo720;
  return IRPF_RATES.above720;
};

// Count business days between two dates (excluding weekends)
// Note: Does not account for Brazilian holidays
export const getBusinessDays = (startDate, endDate) => {
  let count = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

export function InvestmentProvider({ children }) {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { ownerId } = useAccess();

  const getCreatedAtDate = (investment) => {
    if (investment?.createdAt?.toDate) {
      return investment.createdAt.toDate();
    }
    if (investment?.createdAt) {
      return new Date(investment.createdAt);
    }
    return new Date();
  };

  // Listen for investments when ownerId is available
  useEffect(() => {
    if (!ownerId) {
      setInvestments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let active = true;

    investmentsResource.list()
      .then((rows) => {
        if (!active) return;
        const investmentsData = [...rows].sort((a, b) => getCreatedAtDate(b) - getCreatedAtDate(a));
        setInvestments(investmentsData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Investments query error:', err);
        if (!active) return;
        setInvestments([]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ownerId]);

  // Calculate projected value based on return rate and time
  const calculateProjectedValue = (investment) => {
    // B3 investments have currentAmount maintained by the sync cron — never project over it
    if (investment.source === 'b3') {
      return investment.currentAmount ?? investment.initialAmount ?? 0;
    }

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
      : getCreatedAtDate(investment);

    // Calculate to today
    const today = new Date();
    const diffMs = today - startDate;
    const years = Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));

    // Handle CDI-based calculation
    if (returnType === 'cdi') {
      // expectedReturn is the percentage of CDI (e.g., 1.0 = 100% CDI, 1.1 = 110% CDI)
      // Banks use daily compounding with business days (252 days/year)
      const dailyCDIRate = Math.pow(1 + CDI_ANNUAL_RATE, 1 / BUSINESS_DAYS_PER_YEAR) - 1;
      const effectiveDailyRate = dailyCDIRate * expectedReturn;

      // Count only fully completed business days — use midnight of today as the end
      // boundary so the current day (not yet closed) is never counted
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const businessDays = getBusinessDays(startDate, todayMidnight);

      // Compound daily: P * (1 + daily_rate)^business_days
      return initialAmount * Math.pow(1 + effectiveDailyRate, businessDays);
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
    // If investment is closed (fully withdrawn), return 0
    if (investment.status === 'closed') {
      return 0;
    }
    // B3 investments: currentAmount is always authoritative (set by sync cron)
    if (investment.source === 'b3') {
      return investment.currentAmount ?? investment.initialAmount ?? 0;
    }
    // If currentAmount is explicitly set (including 0 for partial withdrawals), use it
    if (investment.currentAmount !== undefined && investment.currentAmount !== investment.initialAmount) {
      return investment.currentAmount;
    }
    return calculateProjectedValue(investment);
  };

  // Calculate growth percentage (accounts for partial withdrawals)
  const getGrowthPercentage = (investment) => {
    const currentValue = getCurrentValue(investment);
    const totalWithdrawn = investment.totalWithdrawn || 0;
    if (!investment.initialAmount || investment.initialAmount === 0) return 0;
    return ((currentValue + totalWithdrawn - investment.initialAmount) / investment.initialAmount) * 100;
  };

  // Calculate days held since purchase
  const getDaysHeld = (investment) => {
    const startDate = investment.purchaseDate
      ? new Date(investment.purchaseDate + 'T12:00:00')
      : getCreatedAtDate(investment);
    const today = new Date();
    const diffMs = today - startDate;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Calculate taxes for fixed income investments
  const calculateTaxes = (investment) => {
    const currentValue = getCurrentValue(investment);
    const initialAmount = investment.initialAmount || 0;
    const grossProfit = currentValue - initialAmount;

    // Only calculate taxes for fixed income and CDI investments with profit
    const isFixedIncome = investment.type === 'fixed_income' || investment.returnType === 'cdi';
    if (!isFixedIncome || grossProfit <= 0) {
      return {
        grossProfit,
        iofRate: 0,
        iofAmount: 0,
        irpfRate: 0,
        irpfAmount: 0,
        totalTaxes: 0,
        netProfit: grossProfit,
        netValue: currentValue,
        daysHeld: getDaysHeld(investment),
      };
    }

    const daysHeld = getDaysHeld(investment);

    // Calculate IOF (only on profit, only within 30 days)
    const iofRate = getIOFRate(daysHeld);
    const iofAmount = grossProfit * iofRate;

    // Profit after IOF for IRPF calculation
    const profitAfterIOF = grossProfit - iofAmount;

    // Calculate IRPF (on profit after IOF)
    const irpfRate = getIRPFRate(daysHeld);
    const irpfAmount = profitAfterIOF * irpfRate;

    const totalTaxes = iofAmount + irpfAmount;
    const netProfit = grossProfit - totalTaxes;
    const netValue = initialAmount + netProfit;

    return {
      grossProfit,
      iofRate,
      iofAmount,
      irpfRate,
      irpfAmount,
      totalTaxes,
      netProfit,
      netValue,
      daysHeld,
    };
  };

  // Get total invested amount
  const getTotalInvested = () => {
    return investments.reduce((sum, inv) => {
      const net = (inv.initialAmount || 0) - (inv.totalWithdrawn || 0);
      return sum + Math.max(0, net);
    }, 0);
  };

  // Get total current value (portfolio value)
  const getTotalCurrentValue = () => {
    return investments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  };

  // Get total withdrawn across all investments
  const getTotalWithdrawn = () => {
    return investments.reduce((sum, inv) => sum + (inv.totalWithdrawn || 0), 0);
  };

  // Get total growth (accounts for partial withdrawals)
  const getTotalGrowth = () => {
    const invested = getTotalInvested();
    const current = getTotalCurrentValue();
    const withdrawn = getTotalWithdrawn();
    return current + withdrawn - invested;
  };

  // Get investments linked to a specific goal (excludes closed/withdrawn investments)
  const getInvestmentsByGoal = (goalId) => {
    const filtered = investments.filter(inv => inv.goalId === goalId && inv.status !== 'closed');

    return filtered;
  };

  // Get total investment value for a goal
  const getGoalInvestmentValue = (goalId) => {
    const goalInvestments = getInvestmentsByGoal(goalId);
    const total = goalInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);

    return total;
  };

  // Get total initial investment amount for a goal
  const getGoalInvestmentInitialAmount = (goalId) => {
    return getInvestmentsByGoal(goalId).reduce((sum, inv) => sum + (inv.initialAmount || 0), 0);
  };

  // Get investment growth for a goal (current - initial)
  const getGoalInvestmentGrowth = (goalId) => {
    return getGoalInvestmentValue(goalId) - getGoalInvestmentInitialAmount(goalId);
  };

  // Add new investment
  const addInvestment = async (investmentData, createTransaction = true) => {
    try {
      const newInvestment = {
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
        plannerGoalId: investmentData.plannerGoalId || null,
        ticker: investmentData.ticker || null,
        platform: investmentData.platform || null,
        coinName: investmentData.coinName || null,
        fundName: investmentData.fundName || null,
        propertyDescription: investmentData.propertyDescription || null,
        transactionId: investmentData.transactionId || null,
        notes: investmentData.notes || '',
        totalWithdrawn: investmentData.totalWithdrawn || 0,
        status: investmentData.status || 'active',
        source: investmentData.source || null,
      };

      const created = await investmentsResource.create(newInvestment);

      // Create expense transaction if requested
      if (createTransaction && investmentData.initialAmount > 0) {
        const txDate = investmentData.purchaseDate
          ? new Date(investmentData.purchaseDate + 'T12:00:00')
          : new Date();
        const transactionData = {
          type: 'expense',
          description: `Investment: ${investmentData.name}`,
          amount: investmentData.initialAmount,
          category: investmentData.transactionCategory || 'Investimentos',
          date: txDate.toISOString(),
          investmentId: created.id,
          bankId: investmentData.bank || null,
          paymentMethod: investmentData.paymentMethod || null,
          goalId: investmentData.goalId || null,
          plannerGoalId: investmentData.plannerGoalId || null,
          investmentType: investmentData.type || 'fixed_income',
        };

        const tx = await transactionsResource.create(transactionData);

        // Update investment with transaction reference
        const linked = await investmentsResource.update(created.id, {
          transactionId: tx?.id || null,
        });
        setInvestments((prev) => [linked, ...prev.filter((item) => item.id !== linked.id)]);
        return linked.id;
      }

      setInvestments((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      return created.id;
    } catch (error) {
      console.error('Error adding investment:', error);
      return null;
    }
  };

  // Update investment
  const updateInvestment = async (investmentId, updates) => {
    try {
      const updated = await investmentsResource.update(investmentId, updates);
      setInvestments((prev) => prev.map((investment) => (
        investment.id === investmentId ? updated : investment
      )));
      return true;
    } catch (error) {
      console.error('Error updating investment:', error);
      return false;
    }
  };

  // Delete investment
  const deleteInvestment = async (investmentId) => {
    try {
      await investmentsResource.remove(investmentId);
      setInvestments((prev) => prev.filter((investment) => investment.id !== investmentId));
      return true;
    } catch (error) {
      console.error('Error deleting investment:', error);
      return false;
    }
  };

  // Withdraw from investment
  const withdrawFromInvestment = async (investmentId, amount, options = {}) => {
    const { createTransaction = true, withdrawDate = null } = options;

    if (!ownerId) {
      console.error('No authenticated owner');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Find investment
      const investment = investments.find(inv => inv.id === investmentId);
      if (!investment) {
        return { success: false, error: 'Investment not found' };
      }

      const currentValue = getCurrentValue(investment);

      if (amount <= 0 || amount > currentValue) {
        return { success: false, error: 'Invalid withdrawal amount' };
      }

      const isFullWithdrawal = amount >= currentValue;

      // Use provided withdraw date or default to today
      const transactionDate = withdrawDate
        ? new Date(withdrawDate + 'T12:00:00')
        : new Date();

      // Update investment
      const updateData = {
        currentAmount: isFullWithdrawal ? 0 : currentValue - amount,
        totalWithdrawn: (investment.totalWithdrawn || 0) + amount,
        lastWithdrawDate: transactionDate.toISOString(),
      };

      if (isFullWithdrawal) {
        updateData.status = 'closed';
      }

      const updatedInvestment = await investmentsResource.update(investmentId, updateData);
      setInvestments((prev) => prev.map((item) => (
        item.id === investmentId ? updatedInvestment : item
      )));

      // Create income transaction
      if (createTransaction && amount > 0) {
        await transactionsResource.create({
          type: 'income',
          description: `Resgate: ${investment.name}`,
          amount,
          category: 'Investimentos',
          date: transactionDate.toISOString(),
          investmentId,
          isWithdrawal: true,
        });
      }

      return { success: true, isFullWithdrawal };
    } catch (error) {
      console.error('Error withdrawing from investment:', error);
      return { success: false, error: error.message };
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
      withdrawFromInvestment,
      calculateProjectedValue,
      getCurrentValue,
      getGrowthPercentage,
      getDaysHeld,
      calculateTaxes,
      getTotalInvested,
      getTotalCurrentValue,
      getTotalGrowth,
      getInvestmentsByGoal,
      getGoalInvestmentValue,
      getGoalInvestmentInitialAmount,
      getGoalInvestmentGrowth,
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
      withdrawFromInvestment: async () => ({ success: false }),
      calculateProjectedValue: () => 0,
      getCurrentValue: () => 0,
      getGrowthPercentage: () => 0,
      getDaysHeld: () => 0,
      calculateTaxes: () => ({ grossProfit: 0, iofRate: 0, iofAmount: 0, irpfRate: 0, irpfAmount: 0, totalTaxes: 0, netProfit: 0, netValue: 0, daysHeld: 0 }),
      getTotalInvested: () => 0,
      getTotalCurrentValue: () => 0,
      getTotalGrowth: () => 0,
      getInvestmentsByGoal: () => [],
      getGoalInvestmentValue: () => 0,
      getGoalInvestmentInitialAmount: () => 0,
      getGoalInvestmentGrowth: () => 0,
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
