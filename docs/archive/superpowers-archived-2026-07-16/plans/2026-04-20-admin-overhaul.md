# Admin Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Sales+Users admin pages into one Leads view, fix the terminal readability, add revenue-per-user column, create a one-time discount checkout flow, and add a Firebase/GCloud project transfer script linked from the admin.

**Architecture:** All admin UI lives in `src/pages/admin/`. The merged `LeadsDashboard.jsx` replaces both `SalesDashboard.jsx` and `UserList.jsx`, joining `leads` + `purchases` collections client-side. A new `createDiscountCheckout.js` Cloud Function creates a Stripe one-time coupon and returns a pre-filled checkout URL. A shell script `scripts/transfer-client.sh` handles IAM + billing transfer; the admin shows a copy-command panel per client.

**Tech Stack:** React 19, Firebase Firestore (real-time), Firebase Cloud Functions (Node 18), Stripe SDK (server-side coupon + checkout), gcloud CLI + bq CLI (billing), Tailwind CSS v4.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/pages/admin/LeadsDashboard.jsx` | Merged leads page (KPIs + revenue + state + email + onboard + discount) |
| Create | `src/pages/admin/DiscountModal.jsx` | Modal: % input → calls createDiscountCheckout → shows copyable URL |
| Modify | `src/pages/admin/AdminApp.jsx` | Remove Sales/Users routes; add Leads + Script routes |
| Create | `src/pages/admin/TransferScript.jsx` | Copy-command panel for Firebase/GCloud transfer per client |
| Modify | `src/pages/admin/OnboardingRun.jsx` | Fix terminal colors + add copy-to-clipboard |
| Delete | `src/pages/admin/SalesDashboard.jsx` | Replaced by LeadsDashboard |
| Delete | `src/pages/admin/UserList.jsx` | Replaced by LeadsDashboard |
| Create | `functions/createDiscountCheckout.js` | Stripe coupon creation + checkout session with discount |
| Modify | `functions/index.js` | Export createDiscountCheckout |
| Create | `scripts/transfer-client.sh` | IAM owner grant + billing account link shell script |

---

## Task 1: Merge Sales + Users → LeadsDashboard

**Files:**
- Create: `src/pages/admin/LeadsDashboard.jsx`
- Delete: `src/pages/admin/SalesDashboard.jsx`
- Delete: `src/pages/admin/UserList.jsx`

Context:
- `leads` Firestore collection: docs keyed by email, fields: `name`, `email`, `whatsapp`, `paid`, `state`, `paidAt`, `updatedAt`
- `purchases` Firestore collection: fields: `email`, `amountTotal`, `purchasedAt`
- `state` values: `pending | not_paid | paid | onboarding | active | cancelled | refunded`
- `updateLeadState` Cloud Function (callable): `{ email, state }` → updates lead doc
- `EmailModal` receives `{ user: leadObj, functions, onClose }`
- `DiscountModal` will be created in Task 2; for now import it as a placeholder (will be wired in Task 2)
- Revenue per user: join purchases by email, sum `amountTotal` (divide by 100 to get BRL from centavos)

- [ ] **Step 1: Create LeadsDashboard.jsx**

```jsx
// src/pages/admin/LeadsDashboard.jsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import EmailModal from './EmailModal';

const STATE_COLORS = {
  pending:    'bg-yellow-800 text-yellow-200',
  not_paid:   'bg-gray-700 text-gray-300',
  paid:       'bg-blue-800 text-blue-200',
  onboarding: 'bg-purple-800 text-purple-200',
  active:     'bg-emerald-800 text-emerald-200',
  cancelled:  'bg-red-900 text-red-300',
  refunded:   'bg-orange-900 text-orange-300',
};

const STATES = ['pending', 'not_paid', 'paid', 'onboarding', 'active', 'cancelled', 'refunded'];
const FILTERS = ['all', ...STATES];

function brl(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function LeadsDashboard({ db, functions }) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [emailTarget, setEmailTarget] = useState(null);
  const [discountTarget, setDiscountTarget] = useState(null);
  const [updatingState, setUpdatingState] = useState({});

  useEffect(() => {
    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), orderBy('paidAt', 'desc')),
      snap => setLeads(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, state: data.state ?? (data.paid ? 'paid' : 'pending') };
      }))
    );
    const unsubPurchases = onSnapshot(
      collection(db, 'purchases'),
      snap => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubLeads(); unsubPurchases(); };
  }, [db]);

  // Build revenue map: email → total centavos paid
  const revenueByEmail = purchases.reduce((acc, p) => {
    acc[p.email] = (acc[p.email] || 0) + (p.amountTotal || 0);
    return acc;
  }, {});

  const totalRevenue = Object.values(revenueByEmail).reduce((a, b) => a + b, 0);
  const paidLeads = leads.filter(l => l.paid).length;
  const conversionRate = leads.length ? ((paidLeads / leads.length) * 100).toFixed(1) : '0.0';

  async function handleStateChange(email, newState) {
    setUpdatingState(prev => ({ ...prev, [email]: true }));
    try {
      await httpsCallable(functions, 'updateLeadState')({ email, state: newState });
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingState(prev => ({ ...prev, [email]: false }));
    }
  }

  function startOnboarding(email) {
    const runId = `${Date.now()}-${email.split('@')[0]}`;
    navigate(`/onboarding/${runId}`, { state: { email } });
  }

  const visible = leads
    .filter(l => filter === 'all' || l.state === filter)
    .filter(l => !search ||
      l.email?.toLowerCase().includes(search.toLowerCase()) ||
      l.name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-white">Leads</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length },
          { label: 'Paid', value: paidLeads },
          { label: 'Conversion', value: `${conversionRate}%` },
          { label: 'Revenue', value: brl(totalRevenue) },
        ].map(kpi => (
          <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filter === f ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {['Name', 'Email', 'WhatsApp', 'State', 'Paid At', 'Revenue', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(lead => (
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
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {lead.paidAt?.toDate?.()?.toLocaleDateString('pt-BR') || '—'}
                </td>
                <td className="px-4 py-3 text-emerald-400 font-mono text-xs">
                  {revenueByEmail[lead.email] ? brl(revenueByEmail[lead.email]) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEmailTarget(lead)}
                      className="px-3 py-1 bg-blue-800 hover:bg-blue-700 text-white text-xs rounded-lg"
                    >
                      Email
                    </button>
                    <button
                      onClick={() => setDiscountTarget(lead)}
                      className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs rounded-lg"
                    >
                      Discount
                    </button>
                    <button
                      disabled={lead.state !== 'paid'}
                      onClick={() => startOnboarding(lead.email)}
                      className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg"
                    >
                      Onboard
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-600">No leads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {emailTarget && (
        <EmailModal user={emailTarget} functions={functions} onClose={() => setEmailTarget(null)} />
      )}
      {discountTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <p className="text-white font-bold mb-2">Discount — coming in Task 2</p>
            <button onClick={() => setDiscountTarget(null)} className="text-gray-400 hover:text-white text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update AdminApp.jsx — replace Sales/Users with Leads**

Replace the contents of `src/pages/admin/AdminApp.jsx`:

```jsx
// src/pages/admin/AdminApp.jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import AdminAuth from './AdminAuth';

const LeadsDashboard = lazy(() => import('./LeadsDashboard'));
const OnboardingRun = lazy(() => import('./OnboardingRun'));
const TransferScript = lazy(() => import('./TransferScript'));

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

const navLinkClass = ({ isActive }) =>
  `text-sm px-3 py-1.5 rounded-lg transition-colors ${
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
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-3">
          <span className="font-bold text-emerald-400 text-lg mr-3">Moneywise Admin</span>
          <NavLink to="leads" className={navLinkClass}>Leads</NavLink>
          <NavLink to="transfer" className={navLinkClass}>Transfer</NavLink>
          <button
            onClick={() => signOut(adminAuth)}
            className="ml-auto text-sm text-gray-500 hover:text-red-400"
          >
            Sign out
          </button>
        </nav>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<LeadsDashboard db={adminDb} functions={adminFunctions} />} />
            <Route path="transfer" element={<TransferScript />} />
            <Route path="onboarding/:runId" element={<OnboardingRun db={adminDb} functions={adminFunctions} />} />
            <Route path="*" element={<Navigate to="leads" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Delete the old files**

```bash
rm src/pages/admin/SalesDashboard.jsx
rm src/pages/admin/UserList.jsx
```

- [ ] **Step 4: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/LeadsDashboard.jsx src/pages/admin/AdminApp.jsx
git rm src/pages/admin/SalesDashboard.jsx src/pages/admin/UserList.jsx
git commit -m "feat(admin): merge Sales+Users into unified LeadsDashboard with revenue column"
```

---

## Task 2: DiscountModal + createDiscountCheckout Cloud Function

**Files:**
- Create: `functions/createDiscountCheckout.js`
- Modify: `functions/index.js` (add export at bottom)
- Create: `src/pages/admin/DiscountModal.jsx`
- Modify: `src/pages/admin/LeadsDashboard.jsx` (import DiscountModal, replace placeholder)

### Part A: Cloud Function

The function:
1. Receives `{ email, discountPct }` (e.g. 20 = 20% off)
2. Creates a Stripe one-time coupon: `percent_off: discountPct, duration: 'once', max_redemptions: 1, metadata: { email }`
3. Creates a Stripe checkout session with `discounts: [{ coupon: coupon.id }]`, `customer_email: email`
4. Returns `{ url }` — the admin copies this URL and sends it to the user

- [ ] **Step 1: Create functions/createDiscountCheckout.js**

```js
// functions/createDiscountCheckout.js
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const db = admin.firestore();

exports.createDiscountCheckout = functions
  .runWith({ secrets: [stripeSecretKey] })
  .https.onCall(async (data, context) => {
    const { email, discountPct } = data;

    if (!email || typeof discountPct !== 'number' || discountPct <= 0 || discountPct > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'email and discountPct (1-100) required');
    }

    const secretKey = stripeSecretKey.value();
    if (!secretKey) throw new functions.https.HttpsError('internal', 'Stripe not configured');

    const stripe = Stripe(secretKey);
    const emailLower = email.toLowerCase().trim();

    // One-time coupon locked to this email via metadata (Stripe doesn't enforce email, but we track it)
    const coupon = await stripe.coupons.create({
      percent_off: discountPct,
      duration: 'once',
      max_redemptions: 1,
      metadata: { email: emailLower },
    });

    // Upsert lead so they exist in Firestore
    await db.collection('leads').doc(emailLower).set(
      { email: emailLower, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: emailLower,
      discounts: [{ coupon: coupon.id }],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: 47988,
            product_data: {
              name: 'Moneywise — Acesso Vitalício',
              description: 'Acesso completo, suporte vitalício, sem mensalidade.',
            },
          },
          quantity: 1,
        },
      ],
      payment_method_types: ['card'],
      payment_method_options: { card: { installments: { enabled: true } } },
      metadata: { email: emailLower, discountPct: String(discountPct), couponId: coupon.id },
      success_url: 'https://mymoneywise.web.app/purchase-success',
      cancel_url: 'https://mymoneywise.web.app/',
    });

    return { url: session.url, couponId: coupon.id };
  });
```

- [ ] **Step 2: Export from functions/index.js**

Add at the bottom of `functions/index.js` (after the existing `exports.updateLeadState` line):

```js
const { createDiscountCheckout } = require('./createDiscountCheckout');
exports.createDiscountCheckout = createDiscountCheckout;
```

- [ ] **Step 3: Create src/pages/admin/DiscountModal.jsx**

```jsx
// src/pages/admin/DiscountModal.jsx
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';

export default function DiscountModal({ lead, functions, onClose }) {
  const [pct, setPct] = useState(20);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const fn = httpsCallable(functions, 'createDiscountCheckout');
      const { data } = await fn({ email: lead.email, discountPct: Number(pct) });
      setUrl(data.url);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Discount Link — {lead.email}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <p className="text-xs text-gray-400">
          Generates a one-time Stripe checkout link with the discount applied. Max 1 redemption.
        </p>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Discount %</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="number"
              min={1}
              max={100}
              value={pct}
              onChange={e => setPct(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-gray-400 text-sm">
              → R$ {((47988 * (1 - pct / 100)) / 100).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {status === 'error' && <p className="text-red-400 text-sm">{errorMsg}</p>}

        {status === 'done' && (
          <div className="space-y-2">
            <p className="text-emerald-400 text-xs">Link gerado com sucesso!</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg whitespace-nowrap"
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Fechar</button>
          {status !== 'done' && (
            <button
              onClick={handleGenerate}
              disabled={status === 'loading'}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {status === 'loading' ? 'Gerando...' : 'Gerar Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire DiscountModal into LeadsDashboard**

In `src/pages/admin/LeadsDashboard.jsx`, add the import at the top:

```js
import DiscountModal from './DiscountModal';
```

Then replace the placeholder discount modal block (the `{discountTarget && (... "coming in Task 2" ...)}` block) with:

```jsx
{discountTarget && (
  <DiscountModal
    lead={discountTarget}
    functions={functions}
    onClose={() => setDiscountTarget(null)}
  />
)}
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

- [ ] **Step 6: Commit**

```bash
git add functions/createDiscountCheckout.js functions/index.js src/pages/admin/DiscountModal.jsx src/pages/admin/LeadsDashboard.jsx
git commit -m "feat(admin): one-time discount checkout via Stripe coupon"
```

---

## Task 3: Fix OnboardingRun Terminal

**Files:**
- Modify: `src/pages/admin/OnboardingRun.jsx`

Problems:
- Log text uses `text-gray-600` (nearly invisible on black background)
- Timestamp uses `text-gray-700` (invisible)
- Step label uses `text-gray-600` (invisible)

Fix: Make each level legible — info = gray-300, success = emerald-400, error = red-400. Timestamps = gray-500. Step = gray-500. Add copy-all button.

- [ ] **Step 1: Replace OnboardingRun.jsx**

```jsx
// src/pages/admin/OnboardingRun.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  doc, setDoc, onSnapshot, collection,
  query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const LEVEL_STYLE = {
  info:    { line: 'text-gray-300', msg: 'text-gray-200' },
  success: { line: 'text-emerald-400', msg: 'text-emerald-300' },
  error:   { line: 'text-red-400', msg: 'text-red-300' },
  warn:    { line: 'text-yellow-400', msg: 'text-yellow-300' },
};

const STATUS_BADGE = {
  queued:  'bg-gray-700 text-gray-300',
  running: 'bg-blue-800 text-blue-200 animate-pulse',
  success: 'bg-emerald-800 text-emerald-200',
  failed:  'bg-red-900 text-red-300',
};

export default function OnboardingRun({ db, functions }) {
  const { runId } = useParams();
  const location = useLocation();
  const email = location.state?.email || new URLSearchParams(location.search).get('email') || '';

  const [runStatus, setRunStatus] = useState('queued');
  const [logs, setLogs] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (!runId || !email) return;
    setDoc(doc(db, 'onboardingRuns', runId),
      { email, status: 'queued', createdAt: serverTimestamp() },
      { merge: true }
    );
  }, [db, runId, email]);

  useEffect(() => {
    if (!runId) return;
    return onSnapshot(doc(db, 'onboardingRuns', runId), snap => {
      if (snap.exists()) setRunStatus(snap.data().status || 'queued');
    });
  }, [db, runId]);

  useEffect(() => {
    if (!runId) return;
    return onSnapshot(
      query(collection(db, 'onboardingRuns', runId, 'logs'), orderBy('ts', 'asc')),
      snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [db, runId]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  async function handleStart() {
    if (!email) { setError('No email provided for this run.'); return; }
    setStarting(true);
    setError('');
    try {
      await httpsCallable(functions, 'onboardUser')({ email, runId });
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  function handleCopyLogs() {
    const text = logs.map(l =>
      `[${l.ts?.toDate?.()?.toLocaleTimeString('pt-BR') ?? '—'}] [step ${l.step}] ${l.message}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      <div className="flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={starting || runStatus === 'running' || runStatus === 'success'}
          className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg"
        >
          {starting ? 'Starting...' : runStatus === 'running' ? 'Running...' : runStatus === 'success' ? 'Completed' : 'Start Onboarding'}
        </button>
        {logs.length > 0 && (
          <button
            onClick={handleCopyLogs}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg"
          >
            {copied ? '✓ Copied' : 'Copy logs'}
          </button>
        )}
      </div>

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="bg-gray-950 border border-gray-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-0.5"
      >
        {logs.length === 0 && (
          <p className="text-gray-600">Waiting for logs...</p>
        )}
        {logs.map(log => {
          const style = LEVEL_STYLE[log.level] || LEVEL_STYLE.info;
          return (
            <div key={log.id} className={`flex gap-3 ${style.line}`}>
              <span className="text-gray-500 shrink-0 select-none">
                {log.ts?.toDate?.()?.toLocaleTimeString('pt-BR') ?? '—'}
              </span>
              <span className="text-gray-500 shrink-0 select-none">[{log.step}]</span>
              <span className={style.msg}>{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/OnboardingRun.jsx
git commit -m "fix(admin): readable terminal colors + copy-logs button in OnboardingRun"
```

---

## Task 4: Firebase/GCloud Transfer Script + Admin UI

**Files:**
- Create: `scripts/transfer-client.sh`
- Create: `src/pages/admin/TransferScript.jsx`

### The shell script

The script:
1. Accepts `--project PROJECT_ID --client-email EMAIL [--billing-account BILLING_ACCOUNT_ID] [--remove-self]`
2. Grants `roles/owner` to the client email on the GCP project
3. If `--billing-account` is provided, links it to the project
4. If `--remove-self` is set, removes the current gcloud auth user from `roles/owner`

Billing account ID format: `XXXXXX-XXXXXX-XXXXXX` (found in `gcloud billing accounts list`)

### The admin UI page

Reads `public/clients/*.json` to list all client projects. For each, shows the `projectId` from the firebase config and pre-fills the copy command. Admin enters the client email + billing account ID in a form, and the page renders the ready-to-run shell command.

- [ ] **Step 1: Create scripts/transfer-client.sh**

```bash
mkdir -p /Users/jonathalima/Developer/personal/limas-finance/scripts
```

```bash
#!/usr/bin/env bash
# scripts/transfer-client.sh
# Usage:
#   ./scripts/transfer-client.sh \
#     --project PROJECT_ID \
#     --client-email CLIENT_EMAIL \
#     [--billing-account BILLING_ACCOUNT_ID] \
#     [--remove-self]
#
# Requirements: gcloud CLI authenticated as project owner

set -euo pipefail

PROJECT_ID=""
CLIENT_EMAIL=""
BILLING_ACCOUNT=""
REMOVE_SELF=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)         PROJECT_ID="$2";       shift 2 ;;
    --client-email)    CLIENT_EMAIL="$2";     shift 2 ;;
    --billing-account) BILLING_ACCOUNT="$2";  shift 2 ;;
    --remove-self)     REMOVE_SELF=true;      shift   ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_ID" || -z "$CLIENT_EMAIL" ]]; then
  echo "Error: --project and --client-email are required"
  exit 1
fi

echo "→ Granting roles/owner to $CLIENT_EMAIL on project $PROJECT_ID..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="user:$CLIENT_EMAIL" \
  --role="roles/owner" \
  --quiet

echo "✓ Owner role granted."

if [[ -n "$BILLING_ACCOUNT" ]]; then
  echo "→ Linking billing account $BILLING_ACCOUNT to project $PROJECT_ID..."
  gcloud billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT"
  echo "✓ Billing account linked."
fi

if [[ "$REMOVE_SELF" == true ]]; then
  SELF_EMAIL=$(gcloud config get-value account 2>/dev/null)
  if [[ -n "$SELF_EMAIL" ]]; then
    echo "→ Removing $SELF_EMAIL from roles/owner..."
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
      --member="user:$SELF_EMAIL" \
      --role="roles/owner" \
      --quiet
    echo "✓ Self removed from project."
  else
    echo "⚠ Could not determine current gcloud account. Skipping --remove-self."
  fi
fi

echo ""
echo "✓ Transfer complete for $PROJECT_ID → $CLIENT_EMAIL"
```

Make it executable:

```bash
chmod +x /Users/jonathalima/Developer/personal/limas-finance/scripts/transfer-client.sh
```

- [ ] **Step 2: Create src/pages/admin/TransferScript.jsx**

```jsx
// src/pages/admin/TransferScript.jsx
import { useState } from 'react';

// Client list — add new entries as you onboard clients
// projectId comes from public/clients/{id}.json → firebase.projectId
const CLIENTS = [
  { id: 'jonathalimax',          projectId: 'moneywise-jonathalimax' },
  { id: 'carloscalzadillar',     projectId: 'moneywise-carloscalzadillar' },
  { id: 'palomabandeiramatos5',  projectId: 'moneywise-palomabandeiramatos5' },
];

export default function TransferScript() {
  const [selectedClient, setSelectedClient] = useState(CLIENTS[0]);
  const [clientEmail, setClientEmail] = useState('');
  const [billingAccount, setBillingAccount] = useState('');
  const [removeSelf, setRemoveSelf] = useState(false);
  const [copied, setCopied] = useState(false);

  const parts = [
    './scripts/transfer-client.sh',
    `--project ${selectedClient.projectId}`,
    clientEmail ? `--client-email ${clientEmail}` : '--client-email YOUR_CLIENT_EMAIL',
    billingAccount ? `--billing-account ${billingAccount}` : null,
    removeSelf ? '--remove-self' : null,
  ].filter(Boolean);

  const command = parts.join(' \\\n  ');

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Firebase / GCloud Transfer</h2>
        <p className="text-sm text-gray-400 mt-1">
          Grants the client <code className="text-emerald-400">roles/owner</code> on their Firebase project and optionally links a billing account.
          Run this script from your terminal after configuring the fields below.
        </p>
      </div>

      {/* Client picker */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Client</label>
        <select
          value={selectedClient.id}
          onChange={e => setSelectedClient(CLIENTS.find(c => c.id === e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        >
          {CLIENTS.map(c => (
            <option key={c.id} value={c.id}>{c.id} ({c.projectId})</option>
          ))}
        </select>
      </div>

      {/* Client email */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Client Email (Google account)</label>
        <input
          type="email"
          value={clientEmail}
          onChange={e => setClientEmail(e.target.value)}
          placeholder="client@gmail.com"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Billing account */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">
          Billing Account ID <span className="normal-case text-gray-600">(optional — from <code>gcloud billing accounts list</code>)</span>
        </label>
        <input
          type="text"
          value={billingAccount}
          onChange={e => setBillingAccount(e.target.value)}
          placeholder="XXXXXX-XXXXXX-XXXXXX"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Remove self */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={removeSelf}
          onChange={e => setRemoveSelf(e.target.checked)}
          className="w-4 h-4 rounded accent-emerald-500"
        />
        <span className="text-sm text-gray-300">Remove myself as owner after transfer</span>
      </label>

      {/* Generated command */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 uppercase tracking-wide">Generated Command</label>
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-lg"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-emerald-300 font-mono whitespace-pre overflow-x-auto">
          {command}
        </pre>
      </div>

      <div className="bg-amber-900/30 border border-amber-800 rounded-xl p-4 text-xs text-amber-300 space-y-1">
        <p className="font-semibold">Before running:</p>
        <p>• Make sure you're authenticated: <code>gcloud auth login</code></p>
        <p>• Verify you're an owner: <code>gcloud projects get-iam-policy {selectedClient.projectId}</code></p>
        <p>• The client must have a Google account for IAM transfer.</p>
        <p>• Billing link requires <code>billing.resourceAssociations.create</code> permission on the billing account.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

- [ ] **Step 4: Commit**

```bash
git add scripts/transfer-client.sh src/pages/admin/TransferScript.jsx
git commit -m "feat(admin): Firebase/GCloud transfer script + admin Transfer page"
```

---

## Task 5: Deploy

- [ ] **Step 1: Final build check**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs`

- [ ] **Step 2: Deploy frontend**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && firebase deploy --only hosting 2>&1 | tail -8
```

Expected: `✔  Deploy complete!`

- [ ] **Step 3: Deploy Cloud Functions**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance/functions && firebase deploy --only functions:createDiscountCheckout 2>&1 | tail -8
```

Expected: `✔  Deploy complete!`

- [ ] **Step 4: Push branch**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ Merge Sales + Users → LeadsDashboard (Task 1)
- ✅ Fix terminal colors (Task 3)
- ✅ Revenue per user column (Task 1 — `revenueByEmail` join)
- ✅ One-time discount checkout (Task 2 — Stripe coupon `max_redemptions: 1`)
- ✅ Discount option in admin per-lead row (Task 2 — Discount button + DiscountModal)
- ✅ Firebase transfer script (Task 4 — shell script + admin UI page)
- ✅ Billing account linking (Task 4 — `--billing-account` flag + `gcloud billing projects link`)

**Placeholder scan:** None found.

**Type consistency:**
- `lead` object shape is consistent across LeadsDashboard, EmailModal, DiscountModal: `{ id, email, name, whatsapp, state, paid, paidAt }`
- `createDiscountCheckout` callable returns `{ url, couponId }` — DiscountModal reads `data.url` ✅
- `brl(centavos)` divides by 100 — `amountTotal` in Firestore is stored in centavos (from Stripe) ✅
