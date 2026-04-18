# Admin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal admin dashboard at `/admin` with email/password auth, a sales dashboard, user management, live onboarding script execution with real-time Firestore log streaming, and email sending — all scoped to the shared Firebase project (`/clients/app.json`).

**Architecture:** The `/admin` path intercept in `App.jsx` bypasses the multi-client routing entirely and mounts `AdminApp.jsx`, which has its own nested React Router, its own Firebase auth guard (checked against `admins/{email}`), and its own Firebase initialization using the shared project config. Cloud Functions are callable, require admin auth, and write logs to a Firestore subcollection that the frontend subscribes to in real time.

**Tech Stack:** React 19 + React Router v7 (nested), Firebase JS SDK v9+ (modular), Firebase Functions v1 (`functions.runWith`), Nodemailer (Gmail), Tailwind CSS v4.

---

## Task 1 — App.jsx intercept + AdminApp.jsx + AdminAuth.jsx

### Files
- Modified: `src/App.jsx`
- New: `src/pages/admin/AdminApp.jsx`
- New: `src/pages/admin/AdminAuth.jsx`

### Steps

- [ ] **1.1** Add lazy import and `/admin` intercept to `src/App.jsx`.

  In `src/App.jsx`, add after the existing landing-page lazy imports:
  ```js
  const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
  ```

  In the `App` component (or wherever the pathname intercepts live), add **before** the `ClientConfigProvider` return — following the same pattern as the existing `/__/auth/` and `/` intercepts:
  ```jsx
  if (pathname.startsWith('/admin')) {
    return <Suspense fallback={<PageLoader />}><AdminApp /></Suspense>;
  }
  ```

  The existing intercept block in `App.jsx` currently reads:
  ```jsx
  if (pathname.startsWith('/__/auth/')) return <FirebaseAuthHandler />;
  if (pathname === '/') return <Suspense><LandingPage /></Suspense>;
  if (pathname === '/purchase-success') return <Suspense><PurchaseSuccessPage /></Suspense>;
  ```
  Insert the `/admin` check after those lines.

- [ ] **1.2** Create `src/pages/admin/AdminApp.jsx`.

  This component:
  1. On mount, fetches `/clients/app.json` and calls a local `initAdminFirebase(config)` helper to initialize a **named** Firebase app (`"admin"`) — or reuses it if already initialized.
  2. Subscribes to `onAuthStateChanged` on the admin Firebase Auth instance.
  3. While loading auth state, renders a full-screen spinner.
  4. If no user → renders `<AdminAuth onSignIn={setUser} />`.
  5. If user signed in, checks `admins/{email}` doc — if missing, signs out and shows an "Acesso negado" error.
  6. If admin doc found → renders the admin nested routes.

  ```jsx
  // src/pages/admin/AdminApp.jsx
  import { useState, useEffect, lazy, Suspense } from 'react';
  import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
  import { initializeApp, getApps, getApp } from 'firebase/app';
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
  ```

- [ ] **1.3** Create `src/pages/admin/AdminAuth.jsx`.

  ```jsx
  // src/pages/admin/AdminAuth.jsx
  import { useState } from 'react';
  import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

  export default function AdminAuth({ error: externalError }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e) {
      e.preventDefault();
      setLoading(true);
      setError('');
      try {
        // adminAuth is initialized by the time AdminAuth renders
        const { getApps, getApp } = await import('firebase/app');
        const app = getApp('admin');
        const auth = getAuth(app);
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged in AdminApp handles the rest
      } catch (err) {
        setError(err.code === 'auth/invalid-credential'
          ? 'Email ou senha incorretos.'
          : err.message);
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm space-y-4"
        >
          <h1 className="text-xl font-bold text-emerald-400">Admin Login</h1>
          {(error || externalError) && (
            <p className="text-red-400 text-sm">{error || externalError}</p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }
  ```

- [ ] **1.4** Commit:
  ```bash
  git add src/App.jsx src/pages/admin/AdminApp.jsx src/pages/admin/AdminAuth.jsx
  git commit -m "feat(admin): add /admin intercept, AdminApp with auth guard, AdminAuth login form"
  ```

---

## Task 2 — SalesDashboard.jsx

### Files
- New: `src/pages/admin/SalesDashboard.jsx`

### Steps

- [ ] **2.1** Create `src/pages/admin/SalesDashboard.jsx`.

  Reads `leads` and `purchases` collections. Displays:
  - KPI cards: total leads, paid leads, conversion rate, total revenue (sum of `purchases.amountTotal`).
  - A table of all leads with columns: name, email, whatsapp, state badge, paidAt.
  - Filter tabs: All | pending | paid | onboarding | active | cancelled | refunded.
  - Each row has an "Onboard" button (enabled when `state === 'paid'`) that navigates to `/admin/onboarding/{nanoid}`.

  ```jsx
  // src/pages/admin/SalesDashboard.jsx
  import { useState, useEffect } from 'react';
  import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
  import { useNavigate } from 'react-router-dom';

  const STATE_COLORS = {
    pending: 'bg-yellow-800 text-yellow-200',
    not_paid: 'bg-gray-700 text-gray-300',
    paid: 'bg-blue-800 text-blue-200',
    onboarding: 'bg-purple-800 text-purple-200',
    active: 'bg-emerald-800 text-emerald-200',
    cancelled: 'bg-red-900 text-red-300',
    refunded: 'bg-orange-900 text-orange-300',
  };

  const FILTERS = ['all', 'pending', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];

  export default function SalesDashboard({ db }) {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
      const unsubLeads = onSnapshot(
        query(collection(db, 'leads'), orderBy('paidAt', 'desc')),
        snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );
      const unsubPurchases = onSnapshot(
        collection(db, 'purchases'),
        snap => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );
      return () => { unsubLeads(); unsubPurchases(); };
    }, [db]);

    const totalRevenue = purchases.reduce((acc, p) => acc + (p.amountTotal || 0), 0);
    const paidLeads = leads.filter(l => l.paid).length;
    const conversionRate = leads.length ? ((paidLeads / leads.length) * 100).toFixed(1) : '0.0';

    const filtered = filter === 'all' ? leads : leads.filter(l => l.state === filter);

    function startOnboarding(email) {
      const runId = `${Date.now()}-${email.split('@')[0]}`;
      navigate(`/onboarding/${runId}`, { state: { email } });
    }

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-white">Sales Dashboard</h2>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: leads.length },
            { label: 'Paid', value: paidLeads },
            { label: 'Conversion', value: `${conversionRate}%` },
            { label: 'Revenue', value: `R$ ${totalRevenue.toFixed(2)}` },
          ].map(kpi => (
            <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filter === f
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {['Name', 'Email', 'WhatsApp', 'State', 'Paid At', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-white">{lead.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{lead.email}</td>
                  <td className="px-4 py-3 text-gray-400">{lead.whatsapp || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATE_COLORS[lead.state] || 'bg-gray-700 text-gray-300'}`}>
                      {lead.state || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {lead.paidAt?.toDate?.()?.toLocaleDateString('pt-BR') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={lead.state !== 'paid'}
                      onClick={() => startOnboarding(lead.email)}
                      className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg"
                    >
                      Onboard
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">No leads found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  ```

- [ ] **2.2** Commit:
  ```bash
  git add src/pages/admin/SalesDashboard.jsx
  git commit -m "feat(admin): add SalesDashboard with KPIs, leads table, and filter tabs"
  ```

---

## Task 3 — UserList.jsx + EmailModal.jsx

### Files
- New: `src/pages/admin/UserList.jsx`
- New: `src/pages/admin/EmailModal.jsx`

### Steps

- [ ] **3.1** Create `src/pages/admin/EmailModal.jsx`.

  A modal with a template dropdown and a send button. Calls the `sendAdminEmail` Cloud Function.

  Templates available (matching `functions/emailTemplates.js`):
  - `welcome` — "Bem-vindo" (requires `name`)
  - `access_granted` — "Luz Verde" (requires `name`, `loginUrl`)
  - `accept_migration` — "Aceite a Migração" (requires `name`, `migrationUrl`)

  ```jsx
  // src/pages/admin/EmailModal.jsx
  import { useState } from 'react';
  import { httpsCallable } from 'firebase/functions';

  const TEMPLATES = [
    { id: 'welcome', label: 'Bem-vindo', fields: ['name'] },
    { id: 'access_granted', label: 'Luz Verde (Acesso Liberado)', fields: ['name', 'loginUrl'] },
    { id: 'accept_migration', label: 'Aceite da Migração', fields: ['name', 'migrationUrl'] },
  ];

  export default function EmailModal({ user, functions, onClose }) {
    const [template, setTemplate] = useState(TEMPLATES[0].id);
    const [fields, setFields] = useState({ name: user?.name || '', loginUrl: '', migrationUrl: '' });
    const [status, setStatus] = useState('idle'); // idle | sending | sent | error
    const [errorMsg, setErrorMsg] = useState('');

    const selectedTemplate = TEMPLATES.find(t => t.id === template);

    async function handleSend() {
      setStatus('sending');
      setErrorMsg('');
      try {
        const sendAdminEmail = httpsCallable(functions, 'sendAdminEmail');
        await sendAdminEmail({ to: user.email, template, fields });
        setStatus('sent');
      } catch (err) {
        setErrorMsg(err.message);
        setStatus('error');
      }
    }

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Send Email — {user.email}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide">Template</label>
            <select
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {selectedTemplate.fields.map(field => (
            <div key={field}>
              <label className="text-xs text-gray-400 uppercase tracking-wide">{field}</label>
              <input
                type="text"
                value={fields[field] || ''}
                onChange={e => setFields(prev => ({ ...prev, [field]: e.target.value }))}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          ))}

          {status === 'error' && <p className="text-red-400 text-sm">{errorMsg}</p>}
          {status === 'sent' && <p className="text-emerald-400 text-sm">Email enviado com sucesso!</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button
              onClick={handleSend}
              disabled={status === 'sending' || status === 'sent'}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {status === 'sending' ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **3.2** Create `src/pages/admin/UserList.jsx`.

  Combines `serviceAccounts` (provisioned clients) and `leads` (sales pipeline). Features:
  - Search by name/email.
  - "Send Email" button per row → opens `EmailModal`.
  - "Update State" dropdown per lead row → calls `updateLeadState` CF.
  - Shows `serviceAccounts` list separately (read-only at this stage).

  ```jsx
  // src/pages/admin/UserList.jsx
  import { useState, useEffect } from 'react';
  import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
  import { httpsCallable } from 'firebase/functions';
  import EmailModal from './EmailModal';

  const STATES = ['pending', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];

  export default function UserList({ db, functions }) {
    const [leads, setLeads] = useState([]);
    const [serviceAccounts, setServiceAccounts] = useState([]);
    const [search, setSearch] = useState('');
    const [emailTarget, setEmailTarget] = useState(null);
    const [updatingState, setUpdatingState] = useState({});

    useEffect(() => {
      const unsubLeads = onSnapshot(
        query(collection(db, 'leads'), orderBy('paidAt', 'desc')),
        snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );
      const unsubSA = onSnapshot(
        collection(db, 'serviceAccounts'),
        snap => setServiceAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      );
      return () => { unsubLeads(); unsubSA(); };
    }, [db]);

    async function handleStateChange(email, newState) {
      setUpdatingState(prev => ({ ...prev, [email]: true }));
      try {
        const updateLeadState = httpsCallable(functions, 'updateLeadState');
        await updateLeadState({ email, state: newState });
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        setUpdatingState(prev => ({ ...prev, [email]: false }));
      }
    }

    const filtered = leads.filter(l =>
      !search ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="p-6 space-y-6">
        <h2 className="text-xl font-bold text-white">User Management</h2>

        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />

        {/* Leads */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Leads ({filtered.length})</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  {['Name', 'Email', 'WhatsApp', 'State', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                    <td className="px-4 py-3 text-white">{lead.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{lead.email}</td>
                    <td className="px-4 py-3 text-gray-400">{lead.whatsapp || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.state || ''}
                        onChange={e => handleStateChange(lead.email, e.target.value)}
                        disabled={updatingState[lead.email]}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                      >
                        <option value="">unknown</option>
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEmailTarget(lead)}
                        className="px-3 py-1 bg-blue-800 hover:bg-blue-700 text-white text-xs rounded-lg"
                      >
                        Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Service Accounts */}
        <section>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Service Accounts ({serviceAccounts.length})</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  {['Username', 'Email', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {serviceAccounts.map(sa => (
                  <tr key={sa.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-mono text-emerald-400">{sa.id}</td>
                    <td className="px-4 py-3 text-gray-300">{sa.client_email || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEmailTarget({ email: sa.client_email || sa.id, name: sa.id })}
                        disabled={!sa.client_email}
                        className="px-3 py-1 bg-blue-800 hover:bg-blue-700 disabled:opacity-30 text-white text-xs rounded-lg"
                      >
                        Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {emailTarget && (
          <EmailModal
            user={emailTarget}
            functions={functions}
            onClose={() => setEmailTarget(null)}
          />
        )}
      </div>
    );
  }
  ```

- [ ] **3.3** Commit:
  ```bash
  git add src/pages/admin/UserList.jsx src/pages/admin/EmailModal.jsx
  git commit -m "feat(admin): add UserList with state management and EmailModal with template dropdown"
  ```

---

## Task 4 — OnboardingRun.jsx

### Files
- New: `src/pages/admin/OnboardingRun.jsx`

### Steps

- [ ] **4.1** Create `src/pages/admin/OnboardingRun.jsx`.

  This page:
  1. Reads `runId` from URL params and `email` from router location state (or a URL query param as fallback).
  2. On mount, creates the `onboardingRuns/{runId}` doc (status: `queued`) if it doesn't exist.
  3. Has a "Start Onboarding" button that calls the `onboardUser` Cloud Function with `{ email, runId }`.
  4. Subscribes to `onboardingRuns/{runId}/logs` in real time, sorts by `ts`, displays in a terminal-style container.
  5. Watches `onboardingRuns/{runId}` doc for `status` field — shows a colored badge.
  6. Auto-scrolls terminal to bottom on new log entries.
  7. Log lines are colored by `level`: info → gray, success → green, error → red.

  ```jsx
  // src/pages/admin/OnboardingRun.jsx
  import { useState, useEffect, useRef } from 'react';
  import { useParams, useLocation } from 'react-router-dom';
  import {
    doc, setDoc, onSnapshot, collection,
    query, orderBy, serverTimestamp
  } from 'firebase/firestore';
  import { httpsCallable } from 'firebase/functions';

  const LEVEL_CLASS = {
    info: 'text-gray-400',
    success: 'text-emerald-400',
    error: 'text-red-400',
  };

  const STATUS_BADGE = {
    queued: 'bg-gray-700 text-gray-300',
    running: 'bg-blue-800 text-blue-200 animate-pulse',
    success: 'bg-emerald-800 text-emerald-200',
    failed: 'bg-red-900 text-red-300',
  };

  export default function OnboardingRun({ db, functions }) {
    const { runId } = useParams();
    const location = useLocation();
    const email = location.state?.email || new URLSearchParams(location.search).get('email') || '';

    const [runStatus, setRunStatus] = useState('queued');
    const [logs, setLogs] = useState([]);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState('');
    const terminalRef = useRef(null);

    // Create run doc on mount
    useEffect(() => {
      if (!runId || !email) return;
      const runRef = doc(db, 'onboardingRuns', runId);
      setDoc(runRef, { email, status: 'queued', createdAt: serverTimestamp() }, { merge: true });
    }, [db, runId, email]);

    // Subscribe to run status
    useEffect(() => {
      if (!runId) return;
      const unsub = onSnapshot(doc(db, 'onboardingRuns', runId), snap => {
        if (snap.exists()) setRunStatus(snap.data().status || 'queued');
      });
      return unsub;
    }, [db, runId]);

    // Subscribe to logs
    useEffect(() => {
      if (!runId) return;
      const logsQuery = query(
        collection(db, 'onboardingRuns', runId, 'logs'),
        orderBy('ts', 'asc')
      );
      const unsub = onSnapshot(logsQuery, snap => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsub;
    }, [db, runId]);

    // Auto-scroll terminal
    useEffect(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, [logs]);

    async function handleStart() {
      if (!email) {
        setError('No email provided for this run.');
        return;
      }
      setStarting(true);
      setError('');
      try {
        const onboardUser = httpsCallable(functions, 'onboardUser');
        await onboardUser({ email, runId });
      } catch (err) {
        setError(err.message);
      } finally {
        setStarting(false);
      }
    }

    return (
      <div className="p-6 space-y-4 max-w-4xl">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">Onboarding Run</h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[runStatus] || STATUS_BADGE.queued}`}>
            {runStatus}
          </span>
        </div>

        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Email:</span> <span className="text-white">{email || '—'}</span>
          <span className="mx-3 text-gray-700">|</span>
          <span className="text-gray-500">Run ID:</span> <span className="font-mono text-gray-300 text-xs">{runId}</span>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleStart}
          disabled={starting || runStatus === 'running' || runStatus === 'success'}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg"
        >
          {starting ? 'Starting...' : runStatus === 'running' ? 'Running...' : runStatus === 'success' ? 'Completed' : 'Start Onboarding'}
        </button>

        {/* Terminal */}
        <div
          ref={terminalRef}
          className="bg-black border border-gray-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1"
        >
          {logs.length === 0 && (
            <p className="text-gray-700">Waiting for logs...</p>
          )}
          {logs.map(log => (
            <div key={log.id} className={`flex gap-3 ${LEVEL_CLASS[log.level] || LEVEL_CLASS.info}`}>
              <span className="text-gray-700 shrink-0">
                {log.ts?.toDate?.()?.toLocaleTimeString('pt-BR') ?? '—'}
              </span>
              <span className="text-gray-600 shrink-0">[step {log.step}]</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **4.2** Commit:
  ```bash
  git add src/pages/admin/OnboardingRun.jsx
  git commit -m "feat(admin): add OnboardingRun with real-time Firestore log streaming and terminal UI"
  ```

---

## Task 5 — functions/onboardUser.js + update functions/index.js

### Files
- New: `functions/onboardUser.js`
- Modified: `functions/index.js`

### Steps

- [ ] **5.1** Create `functions/onboardUser.js`.

  This callable Cloud Function:
  1. Verifies caller is authenticated and their email exists in `admins/{email}`.
  2. Cleans up `onboardingRuns` docs older than 60 days (including their `logs` subcollection).
  3. Updates the run doc to `status: 'running'`.
  4. Executes 9 provisioning steps in sequence, writing log entries after each step.
  5. On any step error: writes an error log, updates run to `status: 'failed'`, and returns.
  6. On success: updates `leads/{email}.state = 'onboarding'` and run to `status: 'success'`.

  Steps correspond to real provisioning work (gcloud/Firebase Management API calls). Step bodies are scaffolded as async functions — implementors should fill in the shell commands / API calls for each environment.

  ```js
  // functions/onboardUser.js
  const functions = require('firebase-functions');
  const admin = require('firebase-admin');

  const db = admin.firestore();

  /**
   * Helper: write a log entry to onboardingRuns/{runId}/logs
   */
  async function log(runId, step, message, level = 'info') {
    await db
      .collection('onboardingRuns')
      .doc(runId)
      .collection('logs')
      .add({
        step,
        message,
        level,
        ts: admin.firestore.FieldValue.serverTimestamp(),
      });
  }

  /**
   * Helper: delete a Firestore collection (shallow batch delete)
   */
  async function deleteCollection(ref, batchSize = 100) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (snap.size === batchSize) await deleteCollection(ref, batchSize);
  }

  /**
   * onboardUser — callable Cloud Function
   *
   * data: { email: string, runId: string }
   */
  exports.onboardUser = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onCall(async (data, context) => {
      // --- Auth guard ---
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      const callerEmail = context.auth.token.email;
      const adminDoc = await db.collection('admins').doc(callerEmail).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Not an admin');
      }

      const { email, runId } = data;
      if (!email || !runId) {
        throw new functions.https.HttpsError('invalid-argument', 'email and runId are required');
      }

      // --- Step 0: Clean up old runs (> 60 days) ---
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const oldRuns = await db
        .collection('onboardingRuns')
        .where('startedAt', '<', cutoff)
        .get();
      for (const oldRun of oldRuns.docs) {
        await deleteCollection(oldRun.ref.collection('logs'));
        await oldRun.ref.delete();
      }

      // --- Mark run as running ---
      const runRef = db.collection('onboardingRuns').doc(runId);
      await runRef.update({
        status: 'running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const username = email.split('@')[0].replace(/[^a-z0-9]/g, '');

      /**
       * Wrap each step: on success logs success, on failure logs error + marks run failed
       * Returns false if a fatal error occurred (caller should return early).
       */
      async function runStep(stepNum, description, fn) {
        await log(runId, stepNum, `Starting: ${description}`);
        try {
          const result = await fn();
          await log(runId, stepNum, result || `Done: ${description}`, 'success');
          return true;
        } catch (err) {
          await log(runId, stepNum, `FAILED: ${description} — ${err.message}`, 'error');
          await runRef.update({ status: 'failed', error: err.message });
          return false;
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // STEP 1: Create Firebase project via Firebase Management REST API
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(1, `Create Firebase project for ${username}`, async () => {
        // TODO: POST https://firebase.googleapis.com/v1beta1/projects
        // using a service account access token with `firebase.projects.create` permission.
        // Example payload: { projectId: username, displayName: `Moneywise - ${username}` }
        // For now, log that this is a manual step or implement via gcloud admin SDK.
        return `Firebase project ${username} creation queued (implement via Management API)`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 2: Enable required Firebase services (Auth, Firestore, Storage)
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(2, 'Enable Firebase services', async () => {
        // TODO: Enable via Firebase Management API / gcloud services enable
        return `Auth, Firestore, Storage enabled for ${username}`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 3: Create service account for the new project
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(3, 'Create service account', async () => {
        // TODO: POST https://iam.googleapis.com/v1/projects/{projectId}/serviceAccounts
        return `Service account created for ${username}`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 4: Grant IAM roles to service account
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(4, 'Grant IAM roles', async () => {
        // TODO: setIamPolicy on the project for roles/datastore.user, roles/firebaseauth.admin
        return `IAM roles granted for ${username} service account`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 5: Generate service account key + store in serviceAccounts/{username}
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(5, 'Generate & store service account key', async () => {
        // TODO: POST https://iam.googleapis.com/v1/projects/{projectId}/serviceAccounts/{sa}/keys
        // Store response JSON in db.collection('serviceAccounts').doc(username).set(keyJson)
        return `Service account key stored in serviceAccounts/${username}`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 6: Write client config file to shared project Storage
      //         (public/clients/{username}.json)
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(6, 'Write client config to Storage', async () => {
        // TODO: Build config JSON from Firebase project details + feature flags defaults
        // Upload to Firebase Hosting via Storage or Admin SDK file write
        return `Client config written to public/clients/${username}.json`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 7: Seed Firestore with default categories + settings
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(7, 'Seed Firestore with defaults', async () => {
        // TODO: Use the service account key from step 5 to initialize a secondary
        //       Admin SDK app pointing at the new project, then write default data.
        return `Default categories and settings seeded for ${username}`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 8: Create Firebase Auth user for the client (email + temp password)
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(8, 'Create Firebase Auth user', async () => {
        // TODO: Use secondary Admin SDK app to createUser({ email, password: tempPassword })
        return `Auth user created for ${email} in project ${username}`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // STEP 9: Deploy Firestore security rules to the new project
      // ─────────────────────────────────────────────────────────────────
      if (!(await runStep(9, 'Deploy Firestore security rules', async () => {
        // TODO: Use Firebase Management REST API to deploy firestore.rules to the new project
        return `Firestore rules deployed for ${username}`;
      }))) return;

      // ─────────────────────────────────────────────────────────────────
      // All steps done — update lead state + run status
      // ─────────────────────────────────────────────────────────────────
      await db.collection('leads').doc(email).update({
        state: 'onboarding',
      });
      await runRef.update({
        status: 'success',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await log(runId, 9, `Onboarding complete for ${email}. Lead state → onboarding.`, 'success');

      return { success: true };
    });
  ```

- [ ] **5.2** Export `onboardUser` in `functions/index.js`.

  Add at the bottom of `functions/index.js`, just before or after the Stripe exports:
  ```js
  // ============================================================
  // ADMIN FUNCTIONS
  // ============================================================
  const { onboardUser } = require('./onboardUser');
  exports.onboardUser = onboardUser;
  ```

- [ ] **5.3** Commit:
  ```bash
  git add functions/onboardUser.js functions/index.js
  git commit -m "feat(functions): add onboardUser callable CF with 9-step provisioning and real-time log streaming"
  ```

---

## Task 6 — functions/sendAdminEmail.js + functions/updateLeadState.js + emailTemplates.js + index.js

### Files
- New: `functions/sendAdminEmail.js`
- New: `functions/updateLeadState.js`
- Modified: `functions/emailTemplates.js`
- Modified: `functions/index.js`

### Steps

- [ ] **6.1** Add `acceptMigrationTemplate` to `functions/emailTemplates.js`.

  Append after the last export in the file:
  ```js
  /**
   * Template 4: Accept Migration
   * Sent to a client when they need to accept their account migration to a new Firebase project.
   */
  exports.acceptMigrationTemplate = (name, migrationUrl = 'https://moneywise.web.app') => {
    const content = `
      <h2 style="color: #059669; margin-top: 0;">Seu Acesso Foi Migrado 🔄</h2>
      <p>Olá, <strong>${name}</strong>!</p>
      <p>
        Realizamos uma migração do seu acesso ao <strong>Moneywise</strong> para uma infraestrutura melhorada.
        Para concluir a migração e acessar sua conta, clique no botão abaixo:
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${migrationUrl}" style="${BUTTON_STYLE}">Aceitar Migração e Acessar</a>
      </div>

      <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #713f12; font-size: 14px;">
          <strong>Importante:</strong> Seus dados financeiros foram preservados integralmente.
          Caso encontre algum problema, responda a este e-mail e resolveremos imediatamente.
        </p>
      </div>

      <p>Obrigado pela confiança!</p>
      <p>Atenciosamente,<br><strong>Equipe Moneywise</strong></p>
    `;
    return getBaseTemplate(content);
  };
  ```

- [ ] **6.2** Create `functions/sendAdminEmail.js`.

  ```js
  // functions/sendAdminEmail.js
  const functions = require('firebase-functions');
  const { defineSecret } = require('firebase-functions/params');
  const admin = require('firebase-admin');
  const nodemailer = require('nodemailer');
  const {
    welcomeTemplate,
    accessGrantedTemplate,
    acceptMigrationTemplate,
  } = require('./emailTemplates');

  const emailUserSecret = defineSecret('EMAIL_USER');
  const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');

  const db = admin.firestore();

  const TEMPLATE_MAP = {
    welcome: (fields) => ({
      subject: 'Bem-vindo ao Moneywise!',
      html: welcomeTemplate(fields.name || 'Cliente'),
    }),
    access_granted: (fields) => ({
      subject: 'Luz Verde! Seu acesso foi liberado 🟢',
      html: accessGrantedTemplate(fields.name || 'Cliente', fields.loginUrl),
    }),
    accept_migration: (fields) => ({
      subject: 'Ação necessária: Aceite sua migração de conta',
      html: acceptMigrationTemplate(fields.name || 'Cliente', fields.migrationUrl),
    }),
  };

  exports.sendAdminEmail = functions
    .runWith({ secrets: [emailUserSecret, emailPasswordSecret] })
    .https.onCall(async (data, context) => {
      // Auth + admin check
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }
      const callerEmail = context.auth.token.email;
      const adminDoc = await db.collection('admins').doc(callerEmail).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Not an admin');
      }

      const { to, template, fields = {} } = data;
      if (!to || !template) {
        throw new functions.https.HttpsError('invalid-argument', 'to and template are required');
      }

      const templateFn = TEMPLATE_MAP[template];
      if (!templateFn) {
        throw new functions.https.HttpsError('invalid-argument', `Unknown template: ${template}`);
      }

      const emailUser = emailUserSecret.value();
      const emailPass = emailPasswordSecret.value();
      if (!emailUser || !emailPass) {
        throw new functions.https.HttpsError('internal', 'Email secrets not configured');
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass },
      });

      const { subject, html } = templateFn(fields);

      await transporter.sendMail({
        from: emailUser,
        to,
        subject,
        html,
      });

      // Audit log
      await db.collection('admin_email_logs').add({
        sentBy: callerEmail,
        to,
        template,
        fields,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    });
  ```

- [ ] **6.3** Create `functions/updateLeadState.js`.

  ```js
  // functions/updateLeadState.js
  const functions = require('firebase-functions');
  const admin = require('firebase-admin');

  const db = admin.firestore();

  const VALID_STATES = ['pending', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];

  exports.updateLeadState = functions.https.onCall(async (data, context) => {
    // Auth + admin check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    }

    const { email, state } = data;
    if (!email || !state) {
      throw new functions.https.HttpsError('invalid-argument', 'email and state are required');
    }
    if (!VALID_STATES.includes(state)) {
      throw new functions.https.HttpsError('invalid-argument', `Invalid state: ${state}. Must be one of: ${VALID_STATES.join(', ')}`);
    }

    await db.collection('leads').doc(email).update({
      state,
      stateUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      stateUpdatedBy: callerEmail,
    });

    return { success: true, email, state };
  });
  ```

- [ ] **6.4** Export both new functions in `functions/index.js`.

  Append to the ADMIN FUNCTIONS block added in Task 5:
  ```js
  const { sendAdminEmail } = require('./sendAdminEmail');
  exports.sendAdminEmail = sendAdminEmail;

  const { updateLeadState } = require('./updateLeadState');
  exports.updateLeadState = updateLeadState;
  ```

- [ ] **6.5** Commit:
  ```bash
  git add functions/sendAdminEmail.js functions/updateLeadState.js functions/emailTemplates.js functions/index.js
  git commit -m "feat(functions): add sendAdminEmail and updateLeadState callables, add acceptMigrationTemplate"
  ```

---

## Task 7 — Firestore Security Rules

### Files
- Modified: `firestore.rules` (root of the repo at `/Users/jonathalima/Developer/personal/limas-finance/firestore.rules`)

### Steps

- [ ] **7.1** Add admin-system rules to `firestore.rules`.

  The shared project (app.json) needs rules for the new collections. Add these inside the `match /databases/{database}/documents` block:

  ```
  // Admin access list — only admin email docs are readable by the owner
  match /admins/{email} {
    allow read: if request.auth != null && request.auth.token.email == email;
    allow write: if false; // managed via Admin SDK only
  }

  // Onboarding runs — admin writes via CF; admin can read
  match /onboardingRuns/{runId} {
    allow read: if request.auth != null && isAdmin();
    allow write: if false; // written by Cloud Functions only

    match /logs/{logId} {
      allow read: if request.auth != null && isAdmin();
      allow write: if false; // written by Cloud Functions only
    }
  }

  // Leads — admin read/write; deny all others
  match /leads/{email} {
    allow read, write: if request.auth != null && isAdmin();
  }

  // Service accounts — admin read only (writes via CF/Admin SDK)
  match /serviceAccounts/{username} {
    allow read: if request.auth != null && isAdmin();
    allow write: if false;
  }

  // Admin email audit logs — admin read only
  match /admin_email_logs/{docId} {
    allow read: if request.auth != null && isAdmin();
    allow write: if false;
  }
  ```

  Also add the `isAdmin()` helper function at the top of the `match /databases/...` block:
  ```
  function isAdmin() {
    return exists(/databases/$(database)/documents/admins/$(request.auth.token.email));
  }
  ```

  > **Note:** `exists()` in security rules does a document lookup that counts against your read quota. For high-traffic apps consider caching admin status in custom claims. For an internal admin dashboard with low traffic, this is acceptable.

- [ ] **7.2** Deploy rules:
  ```bash
  cd /Users/jonathalima/Developer/personal/limas-finance
  firebase deploy --only firestore:rules
  ```

- [ ] **7.3** Seed the first admin document manually (one-time setup):
  ```bash
  # Using Firebase Admin SDK script or Firebase Console
  # Create: admins/jonathalimax@gmail.com → { createdAt: <now> }
  ```

  Or add a one-off Node script `functions/seedAdmin.js`:
  ```js
  // Run once: node functions/seedAdmin.js
  const admin = require('firebase-admin');
  const serviceAccount = require('./serviceAccountKey.json'); // local only, gitignored
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  admin.firestore().collection('admins').doc('jonathalimax@gmail.com').set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }).then(() => { console.log('Admin seeded'); process.exit(0); });
  ```

- [ ] **7.4** Commit:
  ```bash
  git add firestore.rules
  git commit -m "feat(firestore): add security rules for admin collections (admins, onboardingRuns, leads, serviceAccounts)"
  ```

---

## Deployment Checklist

After all tasks are committed:

```bash
# Deploy Cloud Functions
cd /Users/jonathalima/Developer/personal/limas-finance/functions
npm install
firebase deploy --only functions

# Deploy Hosting (publishes updated frontend bundle)
cd /Users/jonathalima/Developer/personal/limas-finance
npm run build
firebase deploy --only hosting

# Deploy Firestore rules (if not done in Task 7)
firebase deploy --only firestore:rules
```

## Bootstrap (first time only)

1. In Firebase Console for the **shared project**, create a user with `jonathalimax@gmail.com` and set a password.
2. Run the seed script (Task 7.3) to create `admins/jonathalimax@gmail.com`.
3. Visit `https://moneywise.web.app/admin` and sign in.
