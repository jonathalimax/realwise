// src/pages/admin/AdminApp.jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import AdminAuth from './AdminAuth';
import { authApi } from '../../lib/api/auth';

const Overview = lazy(() => import('../v2/Overview'));
const Users = lazy(() => import('../v2/Users'));
const UserDetail = lazy(() => import('../v2/UserDetail'));
const LlmLogs = lazy(() => import('../v2/LlmLogs'));
const Support = lazy(() => import('../v2/Support'));
const Emails = lazy(() => import('../v2/Emails'));
const Snippets = lazy(() => import('../v2/Snippets'));
const Simulator = lazy(() => import('../v2/Simulator'));
const Campaigns = lazy(() => import('../v2/Campaigns'));
const CampaignEditor = lazy(() => import('../v2/CampaignEditor'));
const AiSettings = lazy(() => import('../v2/AiSettings'));
const Audit = lazy(() => import('../v2/Audit'));
const Leads = lazy(() => import('../v2/Leads'));
const Coupons = lazy(() => import('../v2/Coupons'));
const Errors = lazy(() => import('../v2/Errors'));
const ErrorDetail = lazy(() => import('../v2/ErrorDetail'));
const Subscriptions = lazy(() => import('../v2/Subscriptions'));
const Invoices = lazy(() => import('../v2/Invoices'));
const GuidePage = lazy(() => import('./GuidePage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
  </div>
);

export default function AdminApp() {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    let active = true;

    authApi.getSession()
      .then((session) => {
        if (!active) return;
        const nextUser = session?.user || session || null;
        if (nextUser?.role === 'admin') {
          setIsAdmin(true);
          setAuthError('');
        } else {
          setIsAdmin(false);
          setAuthError('Acesso negado. Sua sessão não tem permissão de admin.');
        }
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
        setAuthError('');
        setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!ready) return <PageLoader />;
  if (!isAdmin) return <AdminAuth error={authError} />;

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* sessão já encerrada */ }
    window.location.replace('/login');
  }

  return (
    <BrowserRouter basename="/admin">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AdminLayout onLogout={handleLogout} />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="ai-logs" element={<LlmLogs />} />
            <Route path="support" element={<Support />} />
            <Route path="support/:id" element={<Support />} />
            <Route path="emails" element={<Emails />} />
            <Route path="snippets" element={<Snippets />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<CampaignEditor />} />
            <Route path="campaigns/:id" element={<CampaignEditor />} />
            <Route path="settings" element={<AiSettings />} />
            <Route path="audit" element={<Audit />} />
            <Route path="leads" element={<Leads />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="errors" element={<Errors />} />
            <Route path="errors/:fingerprint" element={<ErrorDetail />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="guia" element={<GuidePage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
