import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import { SettingsProvider } from './contexts/SettingsContext';
import { AccessProvider } from './contexts/AccessContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { CardsProvider } from './contexts/CardsContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { InvestmentProvider } from './contexts/InvestmentContext';
import { BillsProvider } from './contexts/BillsContext';
import { PWAInstallProvider } from './contexts/PWAInstallContext';

// Landing pages
import Home from './pages/Home';
import Donations from './pages/Donations';
import FeatureRequest from './pages/FeatureRequest';
import Support from './pages/Support';
import Admin from './pages/Admin';
import Purchase from './pages/Purchase';
import PurchaseSuccess from './pages/PurchaseSuccess';
import PurchaseFailure from './pages/PurchaseFailure';

// App pages (mobile-first)
import SettingsPage from './pages/Settings';
import GoalsPage from './pages/Goals';
import CardsPage from './pages/Cards';
import BudgetPage from './pages/Budget';
import InvestmentsPage from './pages/Investments';
import TransactionsPage from './pages/Transactions';

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    console.log('User state changed:', auth);

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
    <AccessProvider>
      <SettingsProvider>
        <GoalsProvider>
          <CardsProvider>
            <BudgetProvider>
              <InvestmentProvider>
                <BillsProvider>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="goals" element={<GoalsPage />} />
                    <Route path="cards" element={<CardsPage />} />
                    <Route path="budget" element={<BudgetPage />} />
                    <Route path="investments" element={<InvestmentsPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="*" element={<Navigate to="/home" replace />} />
                  </Routes>
                </BillsProvider>
              </InvestmentProvider>
            </BudgetProvider>
          </CardsProvider>
        </GoalsProvider>
        </SettingsProvider>
      </AccessProvider>
  ) : (
    <Auth />
  );
}

function App() {
  return (
    <PWAInstallProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home/*" element={<AppContent />} />
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
    </PWAInstallProvider>
  );
}

export default App;
