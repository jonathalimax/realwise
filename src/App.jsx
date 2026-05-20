import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { extractClientId } from './config/clientConfig';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ClientConfigProvider, useFeature } from './contexts/ClientConfigContext';
import { GoalsProvider } from './contexts/GoalsContext';
import { InvestmentProvider } from './contexts/InvestmentContext';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';
import { AccessProvider, useAccess } from './contexts/AccessContext';
import { CardsProvider } from './contexts/CardsContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { BillsProvider } from './contexts/BillsContext';
import { PWAInstallProvider } from './contexts/PWAInstallContext';
import { MonthProvider } from './contexts/MonthContext';
import { devMark } from './lib/devMarker';
import { isLoginSessionExpired } from './lib/auth/sessionAge';
import AppErrorBoundary from './components/AppErrorBoundary';
// Eager import: LoadingPage is on the critical login path. Lazy-loading
// causes Suspense's PageLoader spinner to flash before LoginLoader paints.
import LoadingPage from './pages/LoadingPage';

// Lazy-loaded page components (code splitting — each page is its own chunk)
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const CategorySettingsPage = lazy(() => import('./pages/CategorySettings'));
const BanksSettingsPage = lazy(() => import('./pages/BanksSettings'));
const CardsPage = lazy(() => import('./pages/Cards'));
const BudgetPage = lazy(() => import('./pages/Budget'));
const TransactionsPage = lazy(() => import('./pages/Transactions'));
const ExpensesPage = lazy(() => import('./pages/Expenses'));
const IncomePage = lazy(() => import('./pages/Income'));
const BillsPage = lazy(() => import('./pages/Bills'));
const HelpPage = lazy(() => import('./pages/Help'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const ImportPage = lazy(() => import('./pages/Import'));
const TransactionEditPage = lazy(() => import('./pages/TransactionEdit'));
const PlannerPage = lazy(() => import('./pages/planner/PlannerPage'));
const PlanningPage = lazy(() => import('./pages/Planning'));
const BanksPage = lazy(() => import('./pages/Banks'));

// Feature-flagged pages (only imported when flags are enabled)
const GoalsPage = lazy(() => import('./pages/Goals'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const InvestmentForm = lazy(() => import('./pages/InvestmentForm'));

// Landing pages (served at "/" and "/purchase-success" outside any clientId scope)
const LandingPage = lazy(() => import('../landing_page/pages/home'));
const PurchaseSuccessPage = lazy(() => import('../landing_page/pages/PurchaseSuccess'));
const SharedLogin = lazy(() => import('./pages/SharedLogin'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
  </div>
);

function AuthenticatedShell({ children }) {
  const { loading, ownerId } = useAccess();
  if (loading || !ownerId) return <PageLoader />;
  return children;
}

function RedirectToGlobalLogin() {
  useEffect(() => {
    // Delay gives in-flight onAuthStateChanged (fired by signInWithCustomToken
    // in LoadingPage) time to arrive before we hard-redirect away.
    const id = setTimeout(() => { window.location.replace('/login'); }, 600);
    return () => clearTimeout(id);
  }, []);
  return null;
}

function AuthenticatedApp() {
  const hasGoals = useFeature('goals');
  const hasInvestments = useFeature('investments');

  return (
    <AccessProvider>
      <SettingsProvider>
        <AuthenticatedShell>
          <MonthProvider>
          {/* InvestmentProvider and GoalsProvider stay in the tree always —
              Dashboard.jsx uses useInvestments() even when the investments page
              is hidden, so the context must be present. */}
          <GoalsProvider>
            <CardsProvider>
              <BudgetProvider>
                <InvestmentProvider>
                  <BillsProvider>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route element={<Layout />}>
                          <Route index element={<Navigate to="/dashboard" replace />} />
                          <Route path="dashboard" element={<DashboardPage />} />
                          <Route path="planner" element={<Navigate to="../planning" replace />} />
                          <Route path="planning" element={<PlanningPage />} />
                          <Route path="expenses" element={<ExpensesPage />} />
                          <Route path="income" element={<IncomePage />} />
                          <Route path="bills" element={<BillsPage />} />
                          <Route path="cards" element={<CardsPage />} />
                          <Route path="transactions" element={<TransactionsPage />} />
                          <Route path="transactions/:id/edit" element={<TransactionEditPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="settings/categories" element={<CategorySettingsPage />} />
                          <Route path="settings/banks" element={<BanksSettingsPage />} />
                          <Route path="budget" element={<BudgetPage />} />
                          <Route path="help" element={<HelpPage />} />
                          <Route path="notifications" element={<NotificationsPage />} />
                          <Route path="import" element={<ImportPage />} />
                          <Route path="banks" element={<BanksPage />} />
                          {hasGoals && <Route path="goals" element={<GoalsPage />} />}
                          {hasInvestments && (
                            <>
                              <Route path="investments" element={<InvestmentsPage />} />
                              <Route path="investments/new" element={<InvestmentForm />} />
                              <Route path="investments/:id/edit" element={<InvestmentForm />} />
                              <Route path="investments/:id/withdraw" element={<InvestmentForm />} />
                            </>
                          )}
                        </Route>
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Suspense>
                  </BillsProvider>
                </InvestmentProvider>
              </BudgetProvider>
            </CardsProvider>
          </GoalsProvider>
          </MonthProvider>
        </AuthenticatedShell>
      </SettingsProvider>
    </AccessProvider>
  );
}

function AppRouter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    function attach() {
      if (cancelled) return;
      // `auth` is a live binding from src/firebase.js — undefined until
      // ClientConfigContext calls initializeFirebase. Poll until defined,
      // then subscribe.
      if (!auth) {
        setTimeout(attach, 50);
        return;
      }

      let resolved = false;
      let devTimer = null;

      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        devMark('AppRouter: auth state ' + (currentUser?.uid ?? 'null'));

        if (resolved) {
          setUser(currentUser);
          return;
        }

        if (currentUser) {
          if (isLoginSessionExpired()) {
            signOut(auth).catch(() => {});
            resolved = true;
            if (devTimer) clearTimeout(devTimer);
            setUser(null);
            setLoading(false);
            return;
          }
          resolved = true;
          if (devTimer) clearTimeout(devTimer);
          setUser(currentUser);
          setLoading(false);
          return;
        }

        if (import.meta.env.DEV) {
          const flagAt = parseInt(sessionStorage.getItem('__rw_dev_auth_at') || '0');
          const fresh = Date.now() - flagAt < 60_000;
          if (fresh) {
            devMark('AppRouter: null user but fresh session flag — waiting up to 3s');
            devTimer = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                devMark('AppRouter: 3s timeout reached — giving up, setting null');
                setUser(null);
                setLoading(false);
              }
            }, 3000);
            return;
          }
        }

        resolved = true;
        setUser(null);
        setLoading(false);
      });
    }

    attach();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Skip the loading-gate PageLoader on /loading so LoginLoader is the
  // only visible UI on the happy path (spec §2). LoadingPage owns its own
  // UI and doesn't require `user` to be resolved.
  const onLoadingRoute = window.location.pathname.endsWith('/loading');

  if (loading && !onLoadingRoute) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="loading" element={<LoadingPage />} />
        {user
          ? <Route path="/*" element={<AuthenticatedApp />} />
          : <Route path="*" element={<RedirectToGlobalLogin />} />
        }
      </Routes>
    </Suspense>
  );
}

// FirebaseAuthHandler handles /__/auth/handler popup — same logic as before,
// kept outside BrowserRouter because the auth handler URL doesn't follow the
// subdomain-based routing pattern and must match the absolute path.
function FirebaseAuthHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const apiKey = params.get('apiKey');

    if (hash.includes('id_token')) {
      if (!window.opener) return;
      const hashParams = new URLSearchParams(hash.slice(1));
      const idToken = hashParams.get('id_token');
      window.opener.postMessage({ type: 'lf-google-auth', idToken }, '*');
      window.close();
      return;
    }

    if (!apiKey || !window.opener) return;

    const authDomain = window.location.hostname;
    fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          continueUri: `https://${authDomain}/__/auth/handler`,
          providerId: 'google.com',
          oauthScopes: 'profile email',
        }),
      }
    )
      .then((r) => r.json())
      .then(({ authUri }) => { if (authUri) window.location.href = authUri; });
  }, []);
  return null;
}

function App() {
  // Handle Firebase auth popup before any routing — the popup opens at
  // /__/auth/handler which doesn't follow the /{clientId}/... pattern.
  // Kept outside AppErrorBoundary intentionally: it's a no-UI bridge that
  // closes the popup window; an error boundary would have nothing to show.
  if (window.location.pathname.startsWith('/__/auth/')) {
    return <FirebaseAuthHandler />;
  }

  let inner;

  if (window.location.pathname === '/') {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    );
  } else if (window.location.pathname === '/purchase-success') {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <PurchaseSuccessPage />
      </Suspense>
    );
  } else if (window.location.pathname === '/login') {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <SharedLogin />
      </Suspense>
    );
  } else if (window.location.pathname.startsWith('/admin')) {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <AdminApp />
      </Suspense>
    );
  } else if (window.location.pathname === '/loading') {
    // PWA start_url entry point — redirect to the last known tenant's loading page
    const lastClient = localStorage.getItem('rw_last_client');
    window.location.replace(lastClient ? `/${lastClient}/loading` : '/login');
    inner = <PageLoader />;
  } else {
    const clientId = extractClientId(window.location.hostname)
      || window.location.pathname.split('/').filter(Boolean)[0]
      || '';

    inner = (
      <ClientConfigProvider>
        <PWAInstallProvider>
          <BrowserRouter basename={`/${clientId}`}>
            <AppRouter />
          </BrowserRouter>
        </PWAInstallProvider>
      </ClientConfigProvider>
    );
  }

  return <AppErrorBoundary>{inner}</AppErrorBoundary>;
}

export default App;
