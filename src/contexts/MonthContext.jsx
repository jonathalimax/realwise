import { createContext, useContext, useState, useCallback } from 'react';

const MonthContext = createContext();

// Get current month key in YYYY-MM format
const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export function MonthProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);

  // Reset to current month
  const resetToCurrentMonth = useCallback(() => {
    setSelectedMonth(getCurrentMonthKey());
  }, []);

  // Navigate to a specific month
  const goToMonth = useCallback((monthKey) => {
    setSelectedMonth(monthKey);
  }, []);

  return (
    <MonthContext.Provider value={{
      selectedMonth,
      setSelectedMonth: goToMonth,
      resetToCurrentMonth,
      getCurrentMonthKey,
    }}>
      {children}
    </MonthContext.Provider>
  );
}

export const useMonth = () => {
  const context = useContext(MonthContext);
  if (!context) {
    // Return default values if used outside provider
    const defaultMonth = getCurrentMonthKey();
    return {
      selectedMonth: defaultMonth,
      setSelectedMonth: () => {},
      resetToCurrentMonth: () => {},
      getCurrentMonthKey,
    };
  }
  return context;
};
