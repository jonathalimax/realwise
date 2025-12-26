import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { SettingsProvider } from './contexts/SettingsContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { CardsProvider } from './contexts/CardsContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { InvestmentProvider } from './contexts/InvestmentContext';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? (
    <SettingsProvider>
      <GoalsProvider>
        <CardsProvider>
          <BudgetProvider>
            <InvestmentProvider>
              <Dashboard />
            </InvestmentProvider>
          </BudgetProvider>
        </CardsProvider>
      </GoalsProvider>
    </SettingsProvider>
  ) : (
    <Auth />
  );
}

export default App;
