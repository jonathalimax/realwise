import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { extractClientId } from './config/clientConfig';
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
import AppErrorBoundary from './components/AppErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoadingPage from './pages/LoadingPage';
import SubscriptionGate from './components/billing/SubscriptionGate';
import SubscriptionPage from './pages/SubscriptionPage';
import { consumeDeepLink, peekDeepLink, rememberDeepLink } from './lib/auth/deepLink';
import { buildLoginRedirectUrl } from './lib/auth/loginClient';

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
const ChatPage = lazy(() => import('./pages/Chat'));
const TransactionEditPage = lazy(() => import('./pages/TransactionEdit'));
const PlanningPage = lazy(() => import('./pages/Planning'));
const BanksPage = lazy(() => import('./pages/Banks'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const InvestmentForm = lazy(() => import('./pages/InvestmentForm'));

import LandingPage from '../landing_page/pages/home';
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

/**
 * Replays a chat deep link (from an email) that was remembered before the user had to sign in. The routes only mount
 * after the redirect landed, so a landing-route redirect (index -> /dashboard, or the dashboard sending a user with no
 * account to /chat) cannot overwrite the deep link and its query.
 */
function PostLoginRedirect({ children }) {
  const [target] = useState(() => peekDeepLink());
  const [redirecting, setRedirecting] = useState(Boolean(target));
  useEffect(() => {
    if (!redirecting) return;
    consumeDeepLink();
    setRedirecting(false);
  }, [redirecting]);
  if (redirecting) return <Navigate to={target} replace />;
  return children;
}

function RedirectToGlobalLogin() {
  useEffect(() => {
    rememberDeepLink(window.location.pathname, window.location.search);
    const storedClientId = localStorage.getItem('rw_last_client') || '';
    window.location.replace(buildLoginRedirectUrl(window.location.pathname, storedClientId));
  }, []);
  return null;
}

function AuthenticatedApp() {
  const hasInvestments = useFeature('investments');

  return (
    <AccessProvider>
      <SubscriptionGate>
        <SettingsProvider>
          <AuthenticatedShell>
            <MonthProvider>
              <GoalsProvider>
                <CardsProvider>
                  <BudgetProvider>
                    <InvestmentProvider>
                      <BillsProvider>
                        <Suspense fallback={<PageLoader />}>
                          <PostLoginRedirect>
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
                              <Route path="subscription" element={<SubscriptionPage />} />
                              <Route path="settings/categories" element={<CategorySettingsPage />} />
                              <Route path="settings/banks" element={<BanksSettingsPage />} />
                              <Route path="budget" element={<BudgetPage />} />
                              <Route path="help" element={<HelpPage />} />
                              <Route path="notifications" element={<NotificationsPage />} />
                              <Route path="chat" element={<ChatPage />} />
                              {/* Importing now happens in the chat */}
                              <Route path="import" element={<Navigate to="/chat" replace />} />
                              <Route path="banks" element={<BanksPage />} />
                              <Route path="goals" element={<Navigate to="/dashboard" replace />} />
                              {/* Investments are disabled unless the client config turns the flag on */}
                              <Route path="investments" element={hasInvestments ? <InvestmentsPage /> : <Navigate to="/dashboard" replace />} />
                              <Route path="investments/new" element={hasInvestments ? <InvestmentForm /> : <Navigate to="/dashboard" replace />} />
                              <Route path="investments/:id/edit" element={hasInvestments ? <InvestmentForm /> : <Navigate to="/dashboard" replace />} />
                              <Route path="investments/:id/withdraw" element={hasInvestments ? <InvestmentForm /> : <Navigate to="/dashboard" replace />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                          </Routes>
                          </PostLoginRedirect>
                        </Suspense>
                      </BillsProvider>
                    </InvestmentProvider>
                  </BudgetProvider>
                </CardsProvider>
              </GoalsProvider>
            </MonthProvider>
          </AuthenticatedShell>
        </SettingsProvider>
      </SubscriptionGate>
    </AccessProvider>
  );
}

function AppRouter() {
  const { status, user } = useAuth();
  const onLoadingRoute = window.location.pathname.endsWith('/loading');

  if (status === 'loading' && !onLoadingRoute) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="loading" element={<LoadingPage />} />
        {status === 'authenticated' && user
          ? <Route path="/*" element={<AuthenticatedApp />} />
          : <Route path="*" element={<RedirectToGlobalLogin />} />
        }
      </Routes>
    </Suspense>
  );
}

function App() {
  let inner;

  if (window.location.pathname === '/') {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    );
  } else if (window.location.pathname === '/login') {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <SharedLogin />
      </Suspense>
    );
  } else if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) {
    inner = (
      <Suspense fallback={<PageLoader />}>
        <AdminApp />
      </Suspense>
    );
  } else if (window.location.pathname === '/loading') {
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
          <AuthProvider>
            <BrowserRouter basename={`/${clientId}`}>
              <AppRouter />
            </BrowserRouter>
          </AuthProvider>
        </PWAInstallProvider>
      </ClientConfigProvider>
    );
  }

  return <AppErrorBoundary>{inner}</AppErrorBoundary>;
}

export default App;
