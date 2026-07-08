import { useEffect, lazy, Suspense } from 'react';
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
import PremiumFeatureGate from './components/premium/PremiumFeatureGate';

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
const PlanningPage = lazy(() => import('./pages/Planning'));
const BanksPage = lazy(() => import('./pages/Banks'));
const GoalsPage = lazy(() => import('./pages/Goals'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const InvestmentForm = lazy(() => import('./pages/InvestmentForm'));

import LandingPage from '../landing_page/pages/home';
import PurchaseSuccessPage from '../landing_page/pages/PurchaseSuccess';
const SharedLogin = lazy(() => import('./pages/SharedLogin'));

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
    window.location.replace('/login');
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
                            <Route
                              path="goals"
                              element={
                                hasGoals ? (
                                  <GoalsPage />
                                ) : (
                                  <PremiumFeatureGate
                                    title="Metas avancadas fazem parte do Premium"
                                    description="As metas e o acompanhamento mais profundo de objetivos financeiros ficam no Premium depois do periodo de acesso experimental."
                                    featureName="Metas, objetivos e acompanhamento avancado"
                                  />
                                )
                              }
                            />
                            <Route
                              path="investments"
                              element={
                                hasInvestments ? (
                                  <InvestmentsPage />
                                ) : (
                                  <PremiumFeatureGate
                                    title="Investimentos agora fazem parte do Premium"
                                    description="Acompanhamento de investimentos, carteira e analise mais profunda de patrimonio ficam no Premium."
                                    featureName="Carteira e acompanhamento de investimentos"
                                  />
                                )
                              }
                            />
                            <Route path="investments/new" element={hasInvestments ? <InvestmentForm /> : <Navigate to="/investments" replace />} />
                            <Route path="investments/:id/edit" element={hasInvestments ? <InvestmentForm /> : <Navigate to="/investments" replace />} />
                            <Route path="investments/:id/withdraw" element={hasInvestments ? <InvestmentForm /> : <Navigate to="/investments" replace />} />
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
