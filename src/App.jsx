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
import { MonthProvider } from './contexts/MonthContext';

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
import InvestmentsPage from './pages/Investments';
import InvestmentForm from './pages/InvestmentForm';
import TransactionsPage from './pages/Transactions';
import ExpensesPage from './pages/Expenses';
import IncomePage from './pages/Income';
import BillsPage from './pages/Bills';
import HelpPage from './pages/Help';
import NotificationsPage from './pages/Notifications';
import PendingReviewPage from './pages/PendingReview';
import ImportPage from './pages/Import';
import TransactionEditPage from './pages/TransactionEdit';
import PlannerPage from './pages/planner/PlannerPage';

// Handles the case where our SPA is loaded inside Firebase's auth popup window.
// Firebase opens /__/auth/handler?apiKey=...&authType=signInViaPopup in a popup.
// If our SPA is served there (instead of Firebase's own handler), this component
// uses Firebase's createAuthUri REST API to get the Google OAuth URL, redirects
// to it, then sends the result back to the opener window via postMessage so that
// signInWithPopup resolves normally.
// Handles /__/auth/handler in popup context.
// Phase 1 (initial open): receives apiKey, calls createAuthUri, redirects to Google.
// Phase 2 (Google callback): receives id_token in hash, postMessages it to opener.
function FirebaseAuthHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const apiKey = params.get('apiKey');

    // Phase 2 — returning from Google with id_token in hash fragment
    if (hash.includes('id_token')) {
      if (!window.opener) return;
      const hashParams = new URLSearchParams(hash.slice(1));
      const idToken = hashParams.get('id_token');
      // Use '*' — opener may be on web.app while popup is on firebaseapp.com
      window.opener.postMessage({ type: 'lf-google-auth', idToken }, '*');
      window.close();
      return;
    }

    // Phase 1 — initial popup open, get Google OAuth URL and redirect
    if (!apiKey || !window.opener) return;

    fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Must use authDomain (firebaseapp.com), not window.location.origin —
          // Firebase redirects firebaseapp.com → web.app, so window.location.origin
          // ends up as web.app which is not registered in Google OAuth.
          continueUri: `https://${auth.app.options.authDomain}/__/auth/handler`,
          providerId: 'google.com',
          oauthScopes: 'profile email',
        }),
      }
    )
      .then((r) => r.json())
      .then(({ authUri }) => {
        if (authUri) window.location.href = authUri;
      });
  }, []);

  return null;
}

function AuthenticatedApp() {
  return (
    <AccessProvider>
      <SettingsProvider>
        <MonthProvider>
          <GoalsProvider>
            <CardsProvider>
              <BudgetProvider>
                <InvestmentProvider>
                  <BillsProvider>
                    <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="planner" element={<PlannerPage />} />
                      <Route path="expenses" element={<ExpensesPage />} />
                      <Route path="income" element={<IncomePage />} />
                      <Route path="goals" element={<GoalsPage />} />
                      <Route path="bills" element={<BillsPage />} />
                      <Route path="cards" element={<CardsPage />} />
                      <Route path="investments" element={<InvestmentsPage />} />
                      <Route path="investments/new" element={<InvestmentForm />} />
                      <Route path="investments/:id/edit" element={<InvestmentForm />} />
                      <Route path="investments/:id/withdraw" element={<InvestmentForm />} />
                      <Route path="transactions" element={<TransactionsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="budget" element={<BudgetPage />} />
                      <Route path="help" element={<HelpPage />} />
                      <Route path="notifications" element={<NotificationsPage />} />
                      <Route path="pending-review" element={<PendingReviewPage />} />
                      <Route path="import" element={<ImportPage />} />
                      <Route path="transactions/:id/edit" element={<TransactionEditPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </BillsProvider>
                </InvestmentProvider>
              </BudgetProvider>
            </CardsProvider>
          </GoalsProvider>
        </MonthProvider>
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
      {/* Public routes - Landing page and related pages (always accessible) */}
      <Route path="/" element={<Home />} />
      <Route path="/selling" element={<Home />} />
      <Route path="/donations" element={<Donations />} />
      <Route path="/feedback" element={<FeatureRequest />} />
      <Route path="/support" element={<Support />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/purchase" element={<Purchase />} />
      <Route path="/purchase/success" element={<PurchaseSuccess />} />
      <Route path="/purchase/failure" element={<PurchaseFailure />} />
      <Route path="/purchase/pending" element={<PurchaseSuccess />} />

      {/* Auth route - redirect to dashboard if already logged in */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />

      {/* Authenticated App routes */}
      {user && <Route path="/*" element={<AuthenticatedApp />} />}

      {/* Firebase auth popup handler */}
      <Route path="/__/auth/*" element={<FirebaseAuthHandler />} />

      {/* Fallback - redirect to login if not authenticated */}
      <Route path="*" element={<Navigate to="/login" replace />} />
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
