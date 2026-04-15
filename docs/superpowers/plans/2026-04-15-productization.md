# Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Moneywise from a personal app into a multi-client SaaS — one deployment, many clients, each with isolated Firebase data and per-client feature flags.

**Architecture:** App detects client ID from the URL path (`/clienta/dashboard`), fetches `/clients/clienta.json` at runtime, initializes Firebase with that config, and gates features via flags in the JSON. React Router uses a dynamic `basename` so all internal routes work correctly under the client path.

**Tech Stack:** React 19, Vite, Firebase SDK v12, React Router v7, Vitest (node environment, pure function tests)

---

## Branch Setup

### Task 1: Create feature branch

**Files:**
- No file changes

- [ ] **Step 1: Create and checkout branch**

```bash
git checkout -b feat/productization
```

- [ ] **Step 2: Verify clean state**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

---

## Phase 1: Foundation — Client Config & Dynamic Firebase

### Task 2: Client config pure logic

**Files:**
- Create: `src/config/clientConfig.js`
- Create: `src/config/clientConfig.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/config/clientConfig.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { extractClientId } from './clientConfig';

describe('extractClientId', () => {
  it('extracts first segment from a nested path', () => {
    expect(extractClientId('/clienta/dashboard')).toBe('clienta');
  });

  it('extracts first segment from a top-level client path', () => {
    expect(extractClientId('/clienta')).toBe('clienta');
  });

  it('returns app when path is root', () => {
    expect(extractClientId('/')).toBe('app');
  });

  it('returns app when path is empty string', () => {
    expect(extractClientId('')).toBe('app');
  });

  it('returns app when first segment is a known non-client path', () => {
    expect(extractClientId('/__/auth/handler')).toBe('app');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test src/config/clientConfig.test.js
```
Expected: FAIL — `extractClientId` not found

- [ ] **Step 3: Implement `clientConfig.js`**

Create `src/config/clientConfig.js`:

```js
const RESERVED_PATHS = ['__', 'api', 'clients'];

/**
 * Extracts the client identifier from the URL pathname.
 * e.g. '/clienta/dashboard' → 'clienta'
 * Falls back to 'app' for root or reserved paths.
 */
export function extractClientId(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (!first || RESERVED_PATHS.includes(first)) return 'app';
  return first;
}

/**
 * Fetches the client config JSON from the hosting's public folder.
 * Used in production. Throws if response is not ok.
 */
export async function fetchClientConfig(clientId) {
  const response = await fetch(`/clients/${clientId}.json`);
  if (!response.ok) {
    throw new Error(`Config not found for client: ${clientId} (${response.status})`);
  }
  return response.json();
}

/**
 * Builds a config object from Vite env vars.
 * Used in development so we don't need a /clients/app.json locally.
 */
export function buildDevConfig() {
  return {
    clientName: 'Dev',
    firebase: {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    },
    features: {
      investments: true,
      b3Sync: true,
      whatsapp: true,
      goals: true,
      salaryBreakdown: true,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/config/clientConfig.test.js
```
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/config/clientConfig.js src/config/clientConfig.test.js
git commit -m "feat: add client config extraction and fetch logic"
```

---

### Task 3: Lazy Firebase initialization

**Files:**
- Modify: `src/firebase.js`

The current `firebase.js` throws immediately if env vars are missing and initializes Firebase at module load time. We need to change it to a lazy pattern — `initializeFirebase(config)` is called at runtime after config loads.

- [ ] **Step 1: Rewrite `src/firebase.js`**

Replace the entire contents of `src/firebase.js` with:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// These are live bindings — they start as undefined and are populated
// when initializeFirebase() is called before any component renders.
let app;
export let auth;
export let db;
export let storage;
export let functions;

/**
 * Called once by ClientConfigContext after loading the client config JSON.
 * Must be called before any component that uses auth/db/storage/functions renders.
 */
export function initializeFirebase(firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functions = getFunctions(app);

  if (import.meta.env.DEV) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('[Firebase] Connected to Emulator Suite');
  }
}

export { app };
```

- [ ] **Step 2: Verify build still compiles**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in` (no errors — contexts import `auth`/`db` lazily inside hooks/effects, not at module level)

- [ ] **Step 3: Commit**

```bash
git add src/firebase.js
git commit -m "feat: make Firebase initialization lazy (called from ClientConfigContext)"
```

---

### Task 4: ClientConfigContext

**Files:**
- Create: `src/contexts/ClientConfigContext.jsx`

- [ ] **Step 1: Create `src/contexts/ClientConfigContext.jsx`**

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { initializeFirebase } from '../firebase';
import { extractClientId, fetchClientConfig, buildDevConfig } from '../config/clientConfig';

const ClientConfigContext = createContext(null);

export function ClientConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        let cfg;
        if (import.meta.env.DEV) {
          cfg = buildDevConfig();
        } else {
          const clientId = extractClientId(window.location.pathname);
          cfg = await fetchClientConfig(clientId);
        }
        initializeFirebase(cfg.firebase);
        setConfig(cfg);
      } catch (err) {
        console.error('[ClientConfig] Failed to load config:', err);
        setError(err.message);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Aplicativo não encontrado.
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <ClientConfigContext.Provider value={config}>
      {children}
    </ClientConfigContext.Provider>
  );
}

export function useClientConfig() {
  return useContext(ClientConfigContext);
}

/**
 * Returns true if the named feature flag is enabled for this client.
 * Defaults to false for unknown flags.
 *
 * Usage: const hasInvestments = useFeature('investments');
 */
export function useFeature(flag) {
  const config = useContext(ClientConfigContext);
  return config?.features?.[flag] ?? false;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in` (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/contexts/ClientConfigContext.jsx
git commit -m "feat: add ClientConfigContext with runtime Firebase init and feature flags"
```

---

### Task 5: App.jsx — path-based routing and ClientConfigProvider

**Files:**
- Modify: `src/App.jsx`
- Create: `public/clients/app.json`

The `App` component needs to:
1. Wrap everything in `ClientConfigProvider`
2. Pass `basename` to `BrowserRouter` so routes work under `/clienta/`
3. Remove all personal/marketing page imports and routes

- [ ] **Step 1: Create demo client config**

Create `public/clients/app.json` with all features enabled. Replace the Firebase values with your actual project credentials (same as in your `.env`):

```json
{
  "clientName": "Moneywise Demo",
  "firebase": {
    "apiKey": "REPLACE_WITH_YOUR_API_KEY",
    "authDomain": "REPLACE_WITH_YOUR_AUTH_DOMAIN",
    "projectId": "REPLACE_WITH_YOUR_PROJECT_ID",
    "storageBucket": "REPLACE_WITH_YOUR_STORAGE_BUCKET",
    "messagingSenderId": "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
    "appId": "REPLACE_WITH_YOUR_APP_ID"
  },
  "features": {
    "investments": true,
    "b3Sync": true,
    "whatsapp": true,
    "goals": true,
    "salaryBreakdown": true
  }
}
```

- [ ] **Step 2: Rewrite `src/App.jsx`**

Replace the entire file contents:

```jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ClientConfigProvider, useFeature } from './contexts/ClientConfigContext';
import { extractClientId } from './config/clientConfig';
import Auth from './components/Auth';
import Layout from './components/Layout';
import { SettingsProvider } from './contexts/SettingsContext';
import { AccessProvider } from './contexts/AccessContext';
import { CardsProvider } from './contexts/CardsContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { BillsProvider } from './contexts/BillsContext';
import { PWAInstallProvider } from './contexts/PWAInstallContext';
import { MonthProvider } from './contexts/MonthContext';

// Lazy-loaded page components (code splitting — each page is its own chunk)
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SettingsPage = lazy(() => import('./pages/Settings'));
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

// Feature-flagged pages (only imported when flags are enabled)
const GoalsPage = lazy(() => import('./pages/Goals'));
const InvestmentsPage = lazy(() => import('./pages/Investments'));
const InvestmentForm = lazy(() => import('./pages/InvestmentForm'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
  </div>
);

function AuthenticatedApp() {
  const hasGoals = useFeature('goals');
  const hasInvestments = useFeature('investments');

  return (
    <AccessProvider>
      <SettingsProvider>
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
                          <Route index element={<Navigate to="dashboard" replace />} />
                          <Route path="dashboard" element={<DashboardPage />} />
                          <Route path="planner" element={<PlannerPage />} />
                          <Route path="expenses" element={<ExpensesPage />} />
                          <Route path="income" element={<IncomePage />} />
                          <Route path="bills" element={<BillsPage />} />
                          <Route path="cards" element={<CardsPage />} />
                          <Route path="transactions" element={<TransactionsPage />} />
                          <Route path="transactions/:id/edit" element={<TransactionEditPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="budget" element={<BudgetPage />} />
                          <Route path="help" element={<HelpPage />} />
                          <Route path="notifications" element={<NotificationsPage />} />
                          <Route path="import" element={<ImportPage />} />
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
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                      </Routes>
                    </Suspense>
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
    return <PageLoader />;
  }

  return (
    <Routes>
      <Route
        path="login"
        element={user ? <Navigate to="dashboard" replace /> : <Auth />}
      />
      {user
        ? <Route path="/*" element={<AuthenticatedApp />} />
        : <Route path="*" element={<Navigate to="login" replace />} />
      }
    </Routes>
  );
}

// FirebaseAuthHandler handles /__/auth/handler popup — same logic as before,
// kept outside BrowserRouter because the auth handler URL doesn't follow the
// /{clientId}/... pattern and must match the absolute path.
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

    // Need authDomain for the continueUri — read from the loaded config or fall
    // back to the current host. In practice the popup is on firebaseapp.com.
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
  if (window.location.pathname.startsWith('/__/auth/')) {
    return <FirebaseAuthHandler />;
  }

  const clientId = extractClientId(window.location.pathname);

  return (
    <ClientConfigProvider>
      <PWAInstallProvider>
        <BrowserRouter basename={`/${clientId}`}>
          <AppRouter />
        </BrowserRouter>
      </PWAInstallProvider>
    </ClientConfigProvider>
  );
}

export default App;
```

Note: `InvestmentProvider` and `GoalsProvider` are removed from the top-level wrapper since those pages are feature-flagged. If needed, they can be re-added inside the feature-flagged routes.

- [ ] **Step 3: Run build to verify no import errors**

```bash
npm run build 2>&1 | grep -E 'error|Error|FAIL'
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx public/clients/app.json
git commit -m "feat: path-based routing with dynamic basename and lazy-loaded pages"
```

---

## Phase 2: Feature Flags & Project Cleanup

### Task 6: Gate WhatsApp and B3 sync behind feature flags

**Files:**
- Modify: `src/components/ImportModal.jsx` (B3 sync button)
- Modify: `src/components/WhatsAppButton.jsx` (or wherever WhatsApp is rendered in Layout/Sidebar)

- [ ] **Step 1: Find where B3 sync button and WhatsApp are rendered**

```bash
grep -n 'b3\|B3\|whatsapp\|WhatsApp' src/components/ImportModal.jsx | head -20
grep -rn 'WhatsAppButton\|whatsappNumber' src/components/ | head -10
```

- [ ] **Step 2: Gate B3 sync in ImportModal**

In `src/components/ImportModal.jsx`, add the feature flag import at the top:

```jsx
import { useFeature } from '../contexts/ClientConfigContext';
```

Inside the `ImportModal` component, add:

```jsx
const hasB3Sync = useFeature('b3Sync');
```

Then wrap the B3 sync button/section with `{hasB3Sync && ...}`.

- [ ] **Step 3: Gate WhatsApp button**

In the component that renders `<WhatsAppButton />` (check result of grep above), add:

```jsx
import { useFeature } from '../contexts/ClientConfigContext';
// ...
const hasWhatsapp = useFeature('whatsapp');
// ...
{hasWhatsapp && <WhatsAppButton />}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportModal.jsx src/components/
git commit -m "feat: gate B3 sync and WhatsApp behind feature flags"
```

---

### Task 7: Remove personal/marketing pages

**Files:**
- Modify: Delete `src/pages/Home.jsx`, `src/pages/Donations.jsx`, `src/pages/FeatureRequest.jsx`, `src/pages/Support.jsx`, `src/pages/Admin.jsx`, `src/pages/Purchase.jsx`, `src/pages/PurchaseSuccess.jsx`, `src/pages/PurchaseFailure.jsx`

The `App.jsx` rewrite in Task 5 already removed all imports and routes for these pages. Now delete the files.

- [ ] **Step 1: Delete the files**

```bash
rm src/pages/Home.jsx src/pages/Donations.jsx src/pages/FeatureRequest.jsx \
   src/pages/Support.jsx src/pages/Admin.jsx src/pages/Purchase.jsx \
   src/pages/PurchaseSuccess.jsx src/pages/PurchaseFailure.jsx
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 3: Remove Mercado Pago proxy from vite.config.js**

In `vite.config.js`, remove the entire `server.proxy` block:

```js
// Remove this entire block from vite.config.js:
proxy: {
  '/api/payment/create': { ... },
  '/api/payment/process': { ... },
  '/api/payment/status': { ... },
},
```

- [ ] **Step 4: Remove Mercado Pago rewrites from firebase.json**

In `firebase.json`, remove these rewrite entries from the `"rewrites"` array:

```json
{ "source": "/api/payment/create", "function": "createPayment" },
{ "source": "/api/webhook/mercadopago", "function": "mercadoPagoWebhook" },
{ "source": "/api/payment/status", "function": "checkPaymentStatus" },
```

- [ ] **Step 5: Update PWA manifest in vite.config.js**

In `vite.config.js`, update the PWA manifest to reflect the Moneywise brand:

```js
manifest: {
  name: 'Moneywise',
  short_name: 'Moneywise',
  start_url: '/app/dashboard',
  description: 'Controle financeiro pessoal simples e eficiente.',
  theme_color: '#ffffff',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
},
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove personal marketing pages, Mercado Pago integration, rebrand to Moneywise"
```

---

## Phase 3: Planner — Renda Tab

### Task 8: Renda calculation pure logic

**Files:**
- Create: `src/pages/planner/rendaCalc.js`
- Create: `src/pages/planner/rendaCalc.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/pages/planner/rendaCalc.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeNetSalary, computeDeductionTotal } from './rendaCalc';

describe('computeNetSalary', () => {
  it('returns gross when deductions array is empty', () => {
    expect(computeNetSalary(5000, [])).toBe(5000);
  });

  it('subtracts all deduction values from gross', () => {
    const deductions = [
      { id: '1', label: 'INSS', value: 400 },
      { id: '2', label: 'IR', value: 300 },
    ];
    expect(computeNetSalary(5000, deductions)).toBe(4300);
  });

  it('returns 0 when deductions exceed gross (floors at 0)', () => {
    const deductions = [{ id: '1', label: 'INSS', value: 6000 }];
    expect(computeNetSalary(5000, deductions)).toBe(0);
  });

  it('ignores deductions with NaN or undefined values', () => {
    const deductions = [
      { id: '1', label: 'INSS', value: 400 },
      { id: '2', label: 'Rascunho', value: NaN },
      { id: '3', label: 'Outro', value: undefined },
    ];
    expect(computeNetSalary(5000, deductions)).toBe(4600);
  });
});

describe('computeDeductionTotal', () => {
  it('sums all valid deduction values', () => {
    const deductions = [
      { id: '1', label: 'INSS', value: 400 },
      { id: '2', label: 'IR', value: 300 },
    ];
    expect(computeDeductionTotal(deductions)).toBe(700);
  });

  it('returns 0 for empty array', () => {
    expect(computeDeductionTotal([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test src/pages/planner/rendaCalc.test.js
```
Expected: FAIL — `rendaCalc` not found

- [ ] **Step 3: Implement `rendaCalc.js`**

Create `src/pages/planner/rendaCalc.js`:

```js
/**
 * Computes the total of all deduction values, ignoring NaN/undefined.
 */
export function computeDeductionTotal(deductions) {
  return deductions.reduce((sum, d) => {
    const v = Number(d.value);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}

/**
 * Computes net salary: gross minus all deductions, floored at 0.
 */
export function computeNetSalary(gross, deductions) {
  return Math.max(0, gross - computeDeductionTotal(deductions));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/pages/planner/rendaCalc.test.js
```
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/pages/planner/rendaCalc.js src/pages/planner/rendaCalc.test.js
git commit -m "feat: add renda calculation pure logic with tests"
```

---

### Task 9: Add salarioBruto/deductions to usePlannerState

**Files:**
- Modify: `src/pages/planner/usePlannerState.js`

Add the new Renda fields to `DEFAULT_STATE` and replace the complex `liquidezFinal` computation with the simple `computeNetSalary` call.

- [ ] **Step 1: Add import at top of `usePlannerState.js`**

After the existing imports at the top of the file, add:

```js
import { computeNetSalary } from './rendaCalc';
```

- [ ] **Step 2: Add new fields to `DEFAULT_STATE`**

In `DEFAULT_STATE` object (around line 18), add these fields at the top of the object, before `rendaBruta`:

```js
// Renda tab
salarioBruto: 5000,
salarioDeductions: [], // [{ id: string, label: string, value: number }]
```

- [ ] **Step 3: Replace `liquidezFinal` computation**

Find this block (around line 383):

```js
const liquidezFinal = useMemo(
  () => computedRendaBruta - simplesValue - despesasPJ,
  [computedRendaBruta, simplesValue, despesasPJ]
);
```

Replace it with:

```js
const liquidezFinal = useMemo(
  () => computeNetSalary(state.salarioBruto, state.salarioDeductions),
  [state.salarioBruto, state.salarioDeductions]
);
```

- [ ] **Step 4: Add new fields to the return object**

Find the `return {` block at the end of the hook (around line 555). Add these fields:

```js
// Renda tab
liquidezFinal,
```

(It's already there — just verify `liquidezFinal` is in the return. If not, add it.)

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 6: Commit**

```bash
git add src/pages/planner/usePlannerState.js
git commit -m "feat: replace PJ liquidezFinal computation with simple net salary"
```

---

### Task 10: RendaTab component

**Files:**
- Create: `src/pages/planner/RendaTab.jsx`

- [ ] **Step 1: Create `src/pages/planner/RendaTab.jsx`**

```jsx
import { useFeature } from '@/contexts/ClientConfigContext';
import { formatBRL } from './usePlannerState';
import { computeNetSalary } from './rendaCalc';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function RendaTab({ state, update }) {
  const hasSalaryBreakdown = useFeature('salaryBreakdown');

  const deductions = state.salarioDeductions ?? [];
  const netSalary = computeNetSalary(state.salarioBruto, deductions);

  function addDeduction() {
    const newDeduction = {
      id: crypto.randomUUID(),
      label: '',
      value: 0,
    };
    update('salarioDeductions', [...deductions, newDeduction]);
  }

  function updateDeduction(id, field, value) {
    update(
      'salarioDeductions',
      deductions.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  }

  function removeDeduction(id) {
    update('salarioDeductions', deductions.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        {/* Gross salary input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {hasSalaryBreakdown ? 'Salário Bruto' : 'Salário Líquido'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              R$
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={state.salarioBruto}
              onChange={(e) => update('salarioBruto', Number(e.target.value))}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Deduction fields — only when salaryBreakdown feature is on */}
        {hasSalaryBreakdown && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Descontos
              </p>
              <button
                onClick={addDeduction}
                className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>

            {deductions.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                Nenhum desconto cadastrado.
              </p>
            )}

            {deductions.map((d) => (
              <div key={d.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ex: INSS"
                  value={d.label}
                  onChange={(e) => updateDeduction(d.id, 'label', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    R$
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={d.value}
                    onChange={(e) => updateDeduction(d.id, 'value', Number(e.target.value))}
                    className="w-full pl-8 pr-2 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <button
                  onClick={() => removeDeduction(d.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remover desconto"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Net salary result */}
        {hasSalaryBreakdown && (
          <div className="flex items-center justify-between pt-3 border-t-2 border-violet-500">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Salário Líquido
            </span>
            <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
              {formatBRL(netSalary)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/RendaTab.jsx
git commit -m "feat: add RendaTab component with salary breakdown feature flag"
```

---

### Task 11: Restructure PlannerPage to 2 tabs

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx`

Replace the 4-tab layout (sistema, carteira, dashboard, allocation) with 2 tabs (renda, allocation).

- [ ] **Step 1: Update `TABS` array and imports in PlannerPage.jsx**

At the top of `PlannerPage.jsx`, replace the planner tab imports:

```jsx
// Remove these imports:
// import SistemaTab from './SistemaTab';
// import CarteiraTab from './carteira';
// import DashboardTab from './DashboardTab';

// Add these:
import RendaTab from './RendaTab';
import AllocationTab from './AllocationTab';
```

- [ ] **Step 2: Replace `TABS` constant**

Find:
```js
const TABS = [
  { value: 'sistema',    label: 'Sistema',   icon: '🧭' },
  { value: 'carteira',   label: 'Carteira',  icon: '💼' },
  { value: 'dashboard',  label: 'Dashboard', icon: '📊' },
  { value: 'allocation', label: 'Alocação',  icon: '📐' },
];
```

Replace with:
```js
const TABS = [
  { value: 'renda',      label: 'Renda',    icon: '💰' },
  { value: 'allocation', label: 'Alocação', icon: '📐' },
];
```

- [ ] **Step 3: Replace `useState` initial tab value**

Find:
```js
const [activeTab, setActiveTab] = useState('sistema');
```

Replace with:
```js
const [activeTab, setActiveTab] = useState('renda');
```

- [ ] **Step 4: Replace tab content in the JSX**

Find the `<TabsContent>` blocks and replace all four with:

```jsx
<TabsContent value="renda">
  <RendaTab
    state={state}
    update={update}
  />
</TabsContent>

<TabsContent value="allocation">
  <AllocationTab
    state={state}
    liquidezFinal={liquidezFinal}
    necessidadesValue={necessidadesValue}
    poupancaValue={poupancaValue}
    desejosValue={desejosValue}
    monthAllocation={monthAllocation}
    updateMonthAllocation={updateMonthAllocation}
    resetMonthAllocation={resetMonthAllocation}
    selectedMonth={state.selectedPlannerMonth}
    updateCategoryBudgetPct={updateCategoryBudgetPct}
  />
</TabsContent>
```

- [ ] **Step 5: Clean up unused props from planner destructure**

In `PlannerPage.jsx`, find the large destructure of `planner`:

```js
const {
  state, update, isLoading,
  simplesValue, despesasPJ, liquidezFinal,
  updateCategoryBudgetPct,
  necessidadesValue, poupancaValue, desejosValue,
  selectedMonthIncome, yearIncomeStats, computedRendaBruta,
  monthAllocation, updateMonthAllocation, resetMonthAllocation,
} = planner;
```

Remove the props no longer used by any tab (`simplesValue`, `despesasPJ`, `selectedMonthIncome`, `yearIncomeStats`, `computedRendaBruta`):

```js
const {
  state, update, isLoading,
  liquidezFinal,
  updateCategoryBudgetPct,
  necessidadesValue, poupancaValue, desejosValue,
  monthAllocation, updateMonthAllocation, resetMonthAllocation,
} = planner;
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 7: Run all tests**

```bash
npm test
```
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: reduce Planner to Renda + Alocação tabs, remove Sistema/Carteira/Dashboard"
```

---

## Phase 4: Onboarding Wizard

### Task 12: Onboarding step logic (pure functions)

**Files:**
- Create: `src/config/onboardingSteps.js`
- Create: `src/config/onboardingSteps.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/config/onboardingSteps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  getNextStep,
  isOnboardingComplete,
  getStepIndex,
} from './onboardingSteps';

describe('ONBOARDING_STEPS', () => {
  it('has exactly 4 steps in correct order', () => {
    expect(ONBOARDING_STEPS).toEqual(['accounts', 'income', 'allocation', 'transaction']);
  });
});

describe('getNextStep', () => {
  it('returns income after accounts', () => {
    expect(getNextStep('accounts')).toBe('income');
  });

  it('returns allocation after income', () => {
    expect(getNextStep('income')).toBe('allocation');
  });

  it('returns transaction after allocation', () => {
    expect(getNextStep('allocation')).toBe('transaction');
  });

  it('returns null after the last step', () => {
    expect(getNextStep('transaction')).toBeNull();
  });

  it('returns null for unknown step', () => {
    expect(getNextStep('unknown')).toBeNull();
  });
});

describe('isOnboardingComplete', () => {
  it('returns true when completedAt is set', () => {
    expect(isOnboardingComplete({ completedAt: '2026-04-15' })).toBe(true);
  });

  it('returns false when completedAt is null', () => {
    expect(isOnboardingComplete({ completedAt: null })).toBe(false);
  });

  it('returns false when onboarding object is null', () => {
    expect(isOnboardingComplete(null)).toBe(false);
  });
});

describe('getStepIndex', () => {
  it('returns 0 for accounts', () => {
    expect(getStepIndex('accounts')).toBe(0);
  });

  it('returns 3 for transaction', () => {
    expect(getStepIndex('transaction')).toBe(3);
  });

  it('returns -1 for unknown step', () => {
    expect(getStepIndex('unknown')).toBe(-1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test src/config/onboardingSteps.test.js
```
Expected: FAIL

- [ ] **Step 3: Implement `onboardingSteps.js`**

Create `src/config/onboardingSteps.js`:

```js
export const ONBOARDING_STEPS = ['accounts', 'income', 'allocation', 'transaction'];

/** Returns the next step after the given step, or null if it's the last. */
export function getNextStep(currentStep) {
  const index = ONBOARDING_STEPS.indexOf(currentStep);
  if (index === -1 || index === ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[index + 1];
}

/** Returns true if onboarding is complete (completedAt is set). */
export function isOnboardingComplete(onboarding) {
  return Boolean(onboarding?.completedAt);
}

/** Returns the 0-based index of the given step, or -1 if not found. */
export function getStepIndex(step) {
  return ONBOARDING_STEPS.indexOf(step);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/config/onboardingSteps.test.js
```
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/config/onboardingSteps.js src/config/onboardingSteps.test.js
git commit -m "feat: add onboarding step logic with tests"
```

---

### Task 13: OnboardingWizard component

**Files:**
- Create: `src/components/OnboardingWizard.jsx`
- Modify: `src/components/Layout.jsx` (wire wizard)

The wizard stores progress in Firestore at `settings/{userId}` under the `onboarding` field: `{ currentStep: 'accounts', completedAt: null }`.

- [ ] **Step 1: Create `src/components/OnboardingWizard.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAccess } from '../contexts/AccessContext';
import { ONBOARDING_STEPS, getNextStep, getStepIndex } from '../config/onboardingSteps';

const STEP_LABELS = {
  accounts: 'Contas & Cartões',
  income: 'Sua Renda',
  allocation: 'Alocação',
  transaction: 'Primeira Transação',
};

const STEP_DESCRIPTIONS = {
  accounts: 'Cadastre pelo menos uma conta ou cartão para começar.',
  income: 'Informe seu salário para que o planejador funcione corretamente.',
  allocation: 'Defina como você quer distribuir sua renda.',
  transaction: 'Adicione sua primeira transação para ver o dashboard em ação.',
};

function StepIndicator({ currentStep }) {
  const currentIndex = getStepIndex(currentStep);
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {ONBOARDING_STEPS.map((step, index) => (
        <div
          key={step}
          className={`h-2 rounded-full transition-all ${
            index <= currentIndex
              ? 'w-8 bg-violet-500'
              : 'w-2 bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingWizard({ onComplete }) {
  const { ownerId } = useAccess();
  const userId = ownerId || auth.currentUser?.uid;
  const [currentStep, setCurrentStep] = useState('accounts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, 'settings', userId);
    getDoc(ref).then((snap) => {
      const data = snap.data();
      const onboarding = data?.onboarding;
      if (onboarding?.currentStep) {
        setCurrentStep(onboarding.currentStep);
      }
      setLoading(false);
    });
  }, [userId]);

  async function advanceStep() {
    const next = getNextStep(currentStep);
    const ref = doc(db, 'settings', userId);

    if (!next) {
      // Final step completed
      await updateDoc(ref, {
        'onboarding.completedAt': serverTimestamp(),
        'onboarding.currentStep': 'transaction',
      });
      onComplete();
      return;
    }

    await updateDoc(ref, { 'onboarding.currentStep': next });
    setCurrentStep(next);
  }

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-violet-600 px-6 pt-6 pb-4 text-white">
          <StepIndicator currentStep={currentStep} />
          <h2 className="text-lg font-bold text-center">
            {STEP_LABELS[currentStep]}
          </h2>
          <p className="text-sm text-violet-200 text-center mt-1">
            {STEP_DESCRIPTIONS[currentStep]}
          </p>
        </div>

        {/* Step content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {currentStep === 'accounts' && (
            <AccountsStep onDone={advanceStep} />
          )}
          {currentStep === 'income' && (
            <IncomeStep onDone={advanceStep} userId={userId} />
          )}
          {currentStep === 'allocation' && (
            <AllocationStep onDone={advanceStep} />
          )}
          {currentStep === 'transaction' && (
            <TransactionStep onDone={advanceStep} />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountsStep({ onDone }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Vá para <strong>Cartões</strong> e adicione pelo menos uma conta ou cartão.
        Isso nos permite organizar suas transações por banco.
      </p>
      <Link
        to="/cards"
        className="block w-full text-center py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
      >
        Adicionar Conta / Cartão
      </Link>
      <button
        onClick={onDone}
        className="block w-full text-center py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700"
      >
        Já tenho conta cadastrada →
      </button>
    </div>
  );
}

function IncomeStep({ onDone, userId }) {
  const [salary, setSalary] = useState('');

  async function saveSalary() {
    if (!salary || Number(salary) <= 0) return;
    const ref = doc(db, 'planner', userId);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(ref, { ...existing, salarioBruto: Number(salary) }, { merge: true });
    onDone();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Salário mensal
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
          <input
            type="number"
            min="0"
            step="100"
            placeholder="5000"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>
      <button
        onClick={saveSalary}
        disabled={!salary || Number(salary) <= 0}
        className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-40"
      >
        Salvar e Continuar
      </button>
    </div>
  );
}

function AllocationStep({ onDone }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        No <strong>Planejador</strong>, aba <strong>Alocação</strong>, você define
        como distribuir sua renda entre necessidades, poupança e desejos.
        A sugestão inicial é 64% / 28% / 8%.
      </p>
      <Link
        to="/planner"
        className="block w-full text-center py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
      >
        Abrir Planejador
      </Link>
      <button
        onClick={onDone}
        className="block w-full text-center py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700"
      >
        Configurei minha alocação →
      </button>
    </div>
  );
}

function TransactionStep({ onDone }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Adicione sua primeira transação para ver o dashboard em ação.
        Você pode importar um extrato CSV ou adicionar manualmente.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/import"
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-violet-200 dark:border-violet-800 hover:border-violet-500 transition-colors text-center"
        >
          <span className="text-2xl">📁</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Importar CSV
          </span>
        </Link>
        <Link
          to="/transactions"
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-violet-200 dark:border-violet-800 hover:border-violet-500 transition-colors text-center"
        >
          <span className="text-2xl">✏️</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Adicionar manualmente
          </span>
        </Link>
      </div>
      <button
        onClick={onDone}
        className="block w-full text-center py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700"
      >
        Já adicionei uma transação →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire OnboardingWizard into `Layout.jsx`**

Open `src/components/Layout.jsx`. Add the following:

At the top, add imports:
```jsx
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAccess } from '../contexts/AccessContext';
import { isOnboardingComplete } from '../config/onboardingSteps';
import OnboardingWizard from './OnboardingWizard';
```

Inside the `Layout` component, add state to track if onboarding should be shown:
```jsx
const { ownerId } = useAccess();
const userId = ownerId || auth.currentUser?.uid;
const [showOnboarding, setShowOnboarding] = useState(false);

useEffect(() => {
  if (!userId) return;
  const ref = doc(db, 'settings', userId);
  getDoc(ref).then((snap) => {
    const onboarding = snap.data()?.onboarding;
    if (!isOnboardingComplete(onboarding)) {
      setShowOnboarding(true);
    }
  });
}, [userId]);
```

Then in the JSX, render the wizard before (or after) the existing `<Outlet />`:
```jsx
{showOnboarding && (
  <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in`

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingWizard.jsx src/components/Layout.jsx
git commit -m "feat: add OnboardingWizard with 4-step flow (accounts → income → allocation → transaction)"
```

---

## Phase 5: Bundle Size

### Task 14: Verify code splitting reduced bundle size

The lazy imports added in Task 5 should have already split the bundle. Verify the improvement.

- [ ] **Step 1: Build and check chunk sizes**

```bash
npm run build 2>&1 | grep -E 'dist/|kB'
```
Expected: multiple smaller chunks instead of one 2.4 MB bundle. The main `index.js` should be significantly smaller.

- [ ] **Step 2: If any single chunk is still above 500 kB, identify it**

```bash
npm run build 2>&1 | grep 'kB' | sort -t'.' -k2 -rn | head -10
```

If `@mui` or `firebase` are still in the main chunk, add manual chunking to `vite.config.js`:

In `vite.config.js`, add `build.rollupOptions` inside the returned config object:

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
        'vendor-mui': ['@mui/material', '@mui/x-charts', '@emotion/react', '@emotion/styled'],
        'vendor-motion': ['framer-motion'],
      },
    },
  },
},
```

- [ ] **Step 3: Rebuild and verify no chunk exceeds 500 kB**

```bash
npm run build 2>&1 | grep 'kB'
```
Expected: no single chunk above 500 kB (gzipped values in parentheses will be much smaller)

- [ ] **Step 4: Run all tests one final time**

```bash
npm test
```
Expected: all pass

- [ ] **Step 5: Final commit**

```bash
git add vite.config.js
git commit -m "perf: add manual chunks to split Firebase and MUI vendor bundles"
```

---

## Done

All phases complete. The app now:

- Routes clients via `moneywise.web.app/clienta` — one deploy, many clients
- Initializes Firebase at runtime from per-client JSON config
- Feature-gates investments, goals, B3 sync, WhatsApp, and salary breakdown
- Has a clean 2-tab Planner (Renda + Alocação)
- Guides new users through a 4-step onboarding wizard
- Loads pages lazily, with vendor chunks split for fast initial load

To add a new client: create `public/clients/{clientId}.json` → deploy.
