import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { SettingsProvider } from './contexts/SettingsContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { CardsProvider } from './contexts/CardsContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { InvestmentProvider } from './contexts/InvestmentContext';
import { BillsProvider } from './contexts/BillsContext';

// Landing pages
import Home from './pages/Home';
import Donations from './pages/Donations';
import FeatureRequest from './pages/FeatureRequest';
import Support from './pages/Support';
import Admin from './pages/Admin';
import Purchase from './pages/Purchase';
import PurchaseSuccess from './pages/PurchaseSuccess';
import PurchaseFailure from './pages/PurchaseFailure';

function AppContent() {
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
              <BillsProvider>
                <Dashboard />
              </BillsProvider>
            </InvestmentProvider>
          </BudgetProvider>
        </CardsProvider>
      </GoalsProvider>
    </SettingsProvider>
  ) : (
    <Auth />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<AppContent />} />
        <Route path="/app" element={<Navigate to="/home" replace />} />
        <Route path="/donations" element={<Donations />} />
        <Route path="/feedback" element={<FeatureRequest />} />
        <Route path="/support" element={<Support />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/purchase" element={<Purchase />} />
        <Route path="/purchase/success" element={<PurchaseSuccess />} />
        <Route path="/purchase/failure" element={<PurchaseFailure />} />
        <Route path="/purchase/pending" element={<PurchaseSuccess />} />
        {/* Redirect old paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
