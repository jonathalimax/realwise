// src/pages/admin/AdminApp.jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDoc, connectFirestoreEmulator } from 'firebase/firestore';
import AdminAuth from './AdminAuth';

const LeadsDashboard = lazy(() => import('./LeadsDashboard'));
const OnboardingRun = lazy(() => import('./OnboardingRun'));
const TransferScript = lazy(() => import('./TransferScript'));
const ImportIssues = lazy(() => import('./ImportIssues'));
const ImportIssueDetail = lazy(() => import('./ImportIssueDetail'));
const GuidePage = lazy(() => import('./GuidePage'));

let adminDb = null;
let adminAuth = null;
let adminFunctions = null;

async function initAdminFirebase() {
  if (adminAuth) return { auth: adminAuth, db: adminDb };
  const res = await fetch('/clients/app.json');
  const config = await res.json();
  const isNew = !getApps().find(a => a.name === 'admin');
  const app = getApps().find(a => a.name === 'admin') ?? initializeApp(config.firebase, 'admin');
  adminAuth = getAuth(app);
  adminDb = getFirestore(app);
  const { getFunctions, connectFunctionsEmulator } = await import('firebase/functions');
  adminFunctions = getFunctions(app);

  if (isNew && import.meta.env.DEV) {
    // Idempotent: ignore reconnect errors when this app shares state with another
    try { connectAuthEmulator(adminAuth, 'http://localhost:9099', { disableWarnings: true }); } catch (_) {}
    try { connectFirestoreEmulator(adminDb, 'localhost', 8080); } catch (_) {}
    try { connectFunctionsEmulator(adminFunctions, 'localhost', 5001); } catch (_) {}
  }
  return { auth: adminAuth, db: adminDb, functions: adminFunctions };
}

export { adminDb, adminAuth, adminFunctions };

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
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    initAdminFirebase().then(({ auth, db }) => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) { setUser(null); setIsAdmin(false); setReady(true); return; }
        const adminDoc = await getDoc(doc(db, 'admins', u.email));
        if (!adminDoc.exists()) {
          await signOut(auth);
          setAuthError('Acesso negado. Seu email não está na lista de admins.');
          setUser(null); setIsAdmin(false);
        } else {
          setUser(u); setIsAdmin(true); setAuthError('');
        }
        setReady(true);
      });
      return () => unsub();
    });
  }, []);

  if (!ready) return <PageLoader />;
  if (!isAdmin) return <AdminAuth onSignIn={() => {}} error={authError} />;

  return (
    <BrowserRouter basename="/admin">
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <nav className="bg-gray-900 border-b border-gray-800 px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 overflow-x-auto">
          <span className="font-bold text-emerald-400 text-base sm:text-lg mr-2 sm:mr-3 whitespace-nowrap flex-shrink-0">Realwise Admin</span>
          <NavLink to="leads" className={navLinkClass}>Leads</NavLink>
          <NavLink to="transfer" className={navLinkClass}>Transfer</NavLink>
          <NavLink to="guia" className={navLinkClass}>Guia</NavLink>
          <NavLink to="import-issues" className={navLinkClass}>Import issues</NavLink>
          <button
            onClick={() => signOut(adminAuth)}
            className="ml-auto text-xs sm:text-sm text-gray-500 hover:text-red-400 whitespace-nowrap flex-shrink-0"
          >
            Sign out
          </button>
        </nav>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<LeadsDashboard db={adminDb} functions={adminFunctions} />} />
            <Route path="transfer" element={<TransferScript />} />
            <Route path="guia" element={<GuidePage />} />
            <Route path="onboarding/:runId" element={<OnboardingRun db={adminDb} functions={adminFunctions} />} />
            <Route path="import-issues" element={<ImportIssues db={adminDb} />} />
            <Route path="import-issues/:id" element={<ImportIssueDetail db={adminDb} />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
