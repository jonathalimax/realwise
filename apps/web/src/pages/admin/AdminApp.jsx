// src/pages/admin/AdminApp.jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import AdminAuth from './AdminAuth';
import { authApi } from '../../lib/api/auth';

const LeadsDashboard = lazy(() => import('./LeadsDashboard'));
const ImportIssues = lazy(() => import('./ImportIssues'));
const ImportIssueDetail = lazy(() => import('./ImportIssueDetail'));
const GuidePage = lazy(() => import('./GuidePage'));
const CouponsPage = lazy(() => import('./CouponsPage'));
const PricingConfigPage = lazy(() => import('./PricingConfigPage'));
const TestimonialManagementPage = lazy(() => import('./TestimonialManagementPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
  </div>
);

const navLinkClass = ({ isActive }) =>
  `text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
  }`;

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

  return (
    <BrowserRouter basename="/admin">
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <nav className="bg-gray-900 border-b border-gray-800 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 overflow-x-auto">
          <span className="font-bold text-emerald-400 text-base sm:text-lg mr-2 sm:mr-3 whitespace-nowrap flex-shrink-0">Realwise Admin</span>
          <NavLink to="leads" className={navLinkClass}>Leads</NavLink>
          <NavLink to="coupons" className={navLinkClass}>Cupons</NavLink>
          <NavLink to="pricing" className={navLinkClass}>Preço</NavLink>
          <NavLink to="guia" className={navLinkClass}>Guia</NavLink>
          <NavLink to="testimonials" className={navLinkClass}>Testimonials</NavLink>
          <NavLink to="import-issues" className={navLinkClass}>Import issues</NavLink>
          <button
            onClick={async () => {
              await authApi.logout();
              window.location.replace('/login');
            }}
            className="ml-auto text-xs sm:text-sm text-gray-500 hover:text-red-400 whitespace-nowrap flex-shrink-0"
          >
            Sign out
          </button>
        </nav>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<LeadsDashboard />} />
            <Route path="coupons" element={<CouponsPage />} />
            <Route path="pricing" element={<PricingConfigPage />} />
            <Route path="guia" element={<GuidePage />} />
            <Route path="testimonials" element={<TestimonialManagementPage />} />
            <Route path="import-issues" element={<ImportIssues />} />
            <Route path="import-issues/:id" element={<ImportIssueDetail />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
