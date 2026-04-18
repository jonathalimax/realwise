// src/pages/admin/AdminApp.jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import AdminAuth from './AdminAuth';

const SalesDashboard = lazy(() => import('./SalesDashboard'));
const UserList = lazy(() => import('./UserList'));
const OnboardingRun = lazy(() => import('./OnboardingRun'));

let adminDb = null;
let adminAuth = null;
let adminFunctions = null;

async function initAdminFirebase() {
  if (adminAuth) return { auth: adminAuth, db: adminDb };
  const res = await fetch('/clients/app.json');
  const config = await res.json();
  const app = getApps().find(a => a.name === 'admin') ?? initializeApp(config.firebase, 'admin');
  adminAuth = getAuth(app);
  adminDb = getFirestore(app);
  // lazy-load functions binding so we don't need to import at top level
  const { getFunctions } = await import('firebase/functions');
  adminFunctions = getFunctions(app);
  return { auth: adminAuth, db: adminDb, functions: adminFunctions };
}

export { adminDb, adminAuth, adminFunctions };

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
  </div>
);

export default function AdminApp() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    initAdminFirebase().then(({ auth, db }) => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setUser(null);
          setIsAdmin(false);
          setReady(true);
          return;
        }
        // Verify admins/{email} doc
        const adminDoc = await getDoc(doc(db, 'admins', u.email));
        if (!adminDoc.exists()) {
          await signOut(auth);
          setAuthError('Acesso negado. Seu email não está na lista de admins.');
          setUser(null);
          setIsAdmin(false);
        } else {
          setUser(u);
          setIsAdmin(true);
          setAuthError('');
        }
        setReady(true);
      });
      return () => unsub();
    });
  }, []);

  if (!ready) return <PageLoader />;

  if (!isAdmin) {
    return (
      <AdminAuth
        onSignIn={() => {/* onAuthStateChanged handles state update */}}
        error={authError}
      />
    );
  }

  return (
    <BrowserRouter basename="/admin">
      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Top nav */}
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
          <span className="font-bold text-emerald-400 text-lg">Moneywise Admin</span>
          <a href="/admin/sales" className="text-sm text-gray-400 hover:text-white">Sales</a>
          <a href="/admin/users" className="text-sm text-gray-400 hover:text-white">Users</a>
          <button
            onClick={() => signOut(adminAuth)}
            className="ml-auto text-sm text-gray-500 hover:text-red-400"
          >
            Sign out
          </button>
        </nav>

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<Navigate to="sales" replace />} />
            <Route path="sales" element={<SalesDashboard db={adminDb} />} />
            <Route path="users" element={<UserList db={adminDb} functions={adminFunctions} />} />
            <Route path="onboarding/:runId" element={<OnboardingRun db={adminDb} functions={adminFunctions} />} />
            <Route path="*" element={<Navigate to="sales" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
