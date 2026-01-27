import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';
import { AccessProvider } from './contexts/AccessContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { CardsProvider } from './contexts/CardsContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { InvestmentProvider } from './contexts/InvestmentContext';
import { BillsProvider } from './contexts/BillsContext';
import { PWAInstallProvider } from './contexts/PWAInstallContext';

// Landing/Marketing pages
import Home from './pages/Home';
import Donations from './pages/Donations';
import FeatureRequest from './pages/FeatureRequest';
import Support from './pages/Support';
import Admin from './pages/Admin';
import Purchase from './pages/Purchase';
import PurchaseSuccess from './pages/PurchaseSuccess';
import PurchaseFailure from './pages/PurchaseFailure';

// App pages
import DashboardPage from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import GoalsPage from './pages/Goals';
import CardsPage from './pages/Cards';
import BudgetPage from './pages/Budget';
import PlanningPage from './pages/Planning';
import InvestmentsPage from './pages/Investments';
import TransactionsPage from './pages/Transactions';
import ExpensesPage from './pages/Expenses';
import IncomePage from './pages/Income';
import BillsPage from './pages/Bills';
import HelpPage from './pages/Help';
import WhatsAppPage from './pages/WhatsApp';

function AuthenticatedApp() {
  return (
    <AccessProvider>
      <SettingsProvider>
        <GoalsProvider>
          <CardsProvider>
            <BudgetProvider>
              <InvestmentProvider>
                <BillsProvider>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="planning" element={<PlanningPage />} />
                      <Route path="expenses" element={<ExpensesPage />} />
                      <Route path="income" element={<IncomePage />} />
                      <Route path="goals" element={<GoalsPage />} />
                      <Route path="bills" element={<BillsPage />} />
                      <Route path="cards" element={<CardsPage />} />
                      <Route path="investments" element={<InvestmentsPage />} />
                      <Route path="transactions" element={<TransactionsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="budget" element={<BudgetPage />} />
                      <Route path="help" element={<HelpPage />} />
                      <Route path="whatsapp" element={<WhatsAppPage />} />
                    </Route>
                    {/* Redirect old /home paths */}
                    <Route path="home/*" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </BillsProvider>
              </InvestmentProvider>
            </BudgetProvider>
          </CardsProvider>
        </GoalsProvider>
      </SettingsProvider>
    </AccessProvider>
  );
}

function AppRouter() {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/selling" element={<Home />} />
      <Route path="/donations" element={<Donations />} />
      <Route path="/feedback" element={<FeatureRequest />} />
      <Route path="/support" element={<Support />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/purchase" element={<Purchase />} />
      <Route path="/purchase/success" element={<PurchaseSuccess />} />
      <Route path="/purchase/failure" element={<PurchaseFailure />} />
      <Route path="/purchase/pending" element={<PurchaseSuccess />} />

      {/* Auth or App routes */}
      <Route path="/*" element={user ? <AuthenticatedApp /> : <Auth />} />
    </Routes>
  );
}

function App() {
  return (
    <PWAInstallProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </PWAInstallProvider>
  );
}

export default App;
