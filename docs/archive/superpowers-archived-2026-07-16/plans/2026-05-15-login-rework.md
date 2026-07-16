# Login Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Realwise login feel fast and reliable: hide the second sign-in behind a branded Lottie loader, persist sessions across visits, kill white-screens on refresh, and auto-redirect signed-in users away from `/login`.

**Architecture:** Keep the existing two-Firebase-project + custom-token flow unchanged. Add a new `/{clientId}/loading` route that owns the post-popup work (per-client config fetch, `getCustomToken`, `signInWithCustomToken`). The login button handler navigates there immediately after `signInWithCredential` resolves on the shared project. Replace the final `window.location.href` hop to dashboard with React Router SPA navigation. Add `navigator.storage.persist()` for iOS PWA durability, fix the `onAuthStateChanged` race in `AppRouter`, wrap the app in an error boundary, and add a build-hash mismatch guard for stale chunks.

**Tech Stack:** React 19, React Router v7, Vite, Firebase Web SDK v12, Tailwind v4, `lottie-react` (new dependency), Vitest (existing — pure-function tests only).

**Spec:** [`docs/superpowers/specs/2026-05-15-login-rework-design.md`](../specs/2026-05-15-login-rework-design.md)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/components/LoginLoader.jsx` | NEW | Lottie + rotating Portuguese copy, max display time |
| `src/components/LoginLoader.timing.js` | NEW | Pure functions for timing logic — testable |
| `src/components/LoginLoader.timing.test.js` | NEW | Vitest unit tests for timing logic |
| `src/components/AppErrorBoundary.jsx` | NEW | Top-level React error boundary |
| `src/pages/LoadingPage.jsx` | NEW | The `/{clientId}/loading` route — orchestrates per-client init then SPA-navigates to dashboard |
| `public/lottie/login-loader.json` | NEW | Lottie animation file (~30–60 KB) |
| `src/pages/SharedLogin.jsx` | MODIFY | Navigate to `/{clientId}/loading` immediately after shared sign-in; auto-redirect on mount if already signed in |
| `src/contexts/ClientConfigContext.jsx` | MODIFY | Surface fetch errors with a reload button |
| `src/contexts/PWAInstallContext.jsx` | MODIFY | Call `navigator.storage.persist()` after first auth |
| `src/App.jsx` | MODIFY | Add `/{clientId}/loading` route inside per-client router; wrap router in `<AppErrorBoundary>`; fix `onAuthStateChanged` race |
| `src/lib/buildHash.js` | NEW | Reads `__BUILD_HASH__` injected by Vite + one-time reload guard |
| `vite.config.js` | MODIFY | Inject `__BUILD_HASH__` define at build time |
| `index.html` | MODIFY | Add `<meta http-equiv="Cache-Control" content="no-cache">` so the index always re-fetches |
| `src/main.jsx` | MODIFY | Call `checkBuildHash()` at startup |

---

## Task 1: Add `lottie-react` dependency and Lottie animation file

**Files:**
- Modify: `package.json` (via npm)
- Create: `public/lottie/login-loader.json`

- [ ] **Step 1: Install lottie-react**

```bash
npm install lottie-react@^2.4.1
```

Expected: package added, `package.json` updated.

- [ ] **Step 2: Add the Lottie animation file**

Download a calm, finance-themed Lottie JSON from [LottieFiles](https://lottiefiles.com) (search: "money chart" or "finance loader"). Pick one with muted/rose-compatible colors. **Constraint: file must be < 60 KB on disk.** Save to `public/lottie/login-loader.json`.

If you cannot pick one inline, use this fallback inline animation (a minimal pulsing dot — replace later with a nicer one). Create `public/lottie/login-loader.json` containing:

```json
{"v":"5.7.4","fr":30,"ip":0,"op":60,"w":200,"h":200,"nm":"pulse","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"dot","sr":1,"ks":{"o":{"a":1,"k":[{"t":0,"s":[100],"e":[30]},{"t":30,"s":[30],"e":[100]},{"t":60,"s":[100]}]},"r":{"a":0,"k":0},"p":{"a":0,"k":[100,100,0]},"a":{"a":0,"k":[0,0,0]},"s":{"a":1,"k":[{"t":0,"s":[100,100,100],"e":[140,140,100]},{"t":30,"s":[140,140,100],"e":[100,100,100]},{"t":60,"s":[100,100,100]}]}},"ao":0,"shapes":[{"ty":"el","p":{"a":0,"k":[0,0]},"s":{"a":0,"k":[60,60]},"nm":"e"},{"ty":"fl","c":{"a":0,"k":[0.96,0.27,0.4,1]},"o":{"a":0,"k":100},"nm":"f"}],"ip":0,"op":60,"st":0,"bm":0}]}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json public/lottie/login-loader.json
git commit -m "feat: add lottie-react and login loader animation"
```

---

## Task 2: Pure-function timing helpers for `LoginLoader`

**Files:**
- Create: `src/components/LoginLoader.timing.js`
- Test: `src/components/LoginLoader.timing.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/components/LoginLoader.timing.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeRemainingHold, pickMessageIndex } from './LoginLoader.timing';

describe('computeRemainingHold', () => {
  it('returns the full minimum when no time has elapsed', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 1000, minMs: 800 })).toBe(800);
  });

  it('returns zero when minimum has already elapsed', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 2000, minMs: 800 })).toBe(0);
  });

  it('returns the remaining ms when partway through', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 1300, minMs: 800 })).toBe(500);
  });

  it('never returns a negative number', () => {
    expect(computeRemainingHold({ startedAt: 1000, now: 5000, minMs: 800 })).toBe(0);
  });
});

describe('pickMessageIndex', () => {
  it('cycles through messages on a 2200ms interval', () => {
    expect(pickMessageIndex({ elapsedMs: 0, intervalMs: 2200, count: 4 })).toBe(0);
    expect(pickMessageIndex({ elapsedMs: 2199, intervalMs: 2200, count: 4 })).toBe(0);
    expect(pickMessageIndex({ elapsedMs: 2200, intervalMs: 2200, count: 4 })).toBe(1);
    expect(pickMessageIndex({ elapsedMs: 4400, intervalMs: 2200, count: 4 })).toBe(2);
    expect(pickMessageIndex({ elapsedMs: 6600, intervalMs: 2200, count: 4 })).toBe(3);
  });

  it('clamps to the last message after all have rotated once', () => {
    expect(pickMessageIndex({ elapsedMs: 8800, intervalMs: 2200, count: 4 })).toBe(3);
    expect(pickMessageIndex({ elapsedMs: 100000, intervalMs: 2200, count: 4 })).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npx vitest run src/components/LoginLoader.timing.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/LoginLoader.timing.js`:

```js
export function computeRemainingHold({ startedAt, now, minMs }) {
  const elapsed = now - startedAt;
  return Math.max(0, minMs - elapsed);
}

export function pickMessageIndex({ elapsedMs, intervalMs, count }) {
  const raw = Math.floor(elapsedMs / intervalMs);
  return Math.min(raw, count - 1);
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
npx vitest run src/components/LoginLoader.timing.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/LoginLoader.timing.js src/components/LoginLoader.timing.test.js
git commit -m "feat: add LoginLoader timing helpers with tests"
```

---

## Task 3: Build the `LoginLoader` component

**Files:**
- Create: `src/components/LoginLoader.jsx`

- [ ] **Step 1: Write the component**

Create `src/components/LoginLoader.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';
import { pickMessageIndex } from './LoginLoader.timing';

const MESSAGES = [
  'Preparando seu painel...',
  'Carregando suas transações...',
  'Sincronizando seus cartões...',
  'Quase lá...',
];
const ROTATE_INTERVAL_MS = 2200;
const MAX_DISPLAY_MS = 8000;

export default function LoginLoader({ onTimeout }) {
  const startedAt = useRef(performance.now());
  const [, setTick] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    fetch('/lottie/login-loader.json')
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, MAX_DISPLAY_MS);
    return () => {
      clearInterval(id);
      clearTimeout(timeoutId);
    };
  }, [onTimeout]);

  const elapsedMs = performance.now() - startedAt.current;
  const messageIndex = pickMessageIndex({
    elapsedMs,
    intervalMs: ROTATE_INTERVAL_MS,
    count: MESSAGES.length,
  });

  const message = timedOut ? 'Demorando mais que o normal...' : MESSAGES[messageIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
      <div className="w-48 h-48">
        {animationData ? (
          <Lottie animationData={animationData} loop={true} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
          </div>
        )}
      </div>
      <p className="mt-6 text-base text-gray-600 dark:text-gray-300 text-center min-h-[1.5rem]">
        {message}
      </p>
      {timedOut && (
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm rounded-lg bg-rose-500 text-white hover:bg-rose-600"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/LoginLoader.jsx
git commit -m "feat: add LoginLoader component with rotating copy and timeout"
```

---

## Task 4: Create the `LoadingPage` route component

**Files:**
- Create: `src/pages/LoadingPage.jsx`

This page lives at `/{clientId}/loading` (inside the per-client `BrowserRouter` basename). Its responsibility: run the post-popup work (per-client config fetch + `getCustomToken` + `signInWithCustomToken`), then SPA-navigate to `/dashboard` (which under the basename resolves to `/{clientId}/dashboard`). The `LoginLoader` is shown the entire time.

- [ ] **Step 1: Write the page**

Create `src/pages/LoadingPage.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { initSharedFirebase } from '../lib/sharedFirebase';
import LoginLoader from '../components/LoginLoader';
import { devMark } from '../lib/devMarker';
import { computeRemainingHold } from '../components/LoginLoader.timing';

const MIN_DISPLAY_MS = 800;

export default function LoadingPage() {
  const navigate = useNavigate();
  const params = useParams();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const startedAt = performance.now();

    async function run() {
      try {
        devMark('LoadingPage: start');
        const { auth: sharedAuth, functions: sharedFunctions } = await initSharedFirebase();
        if (!sharedAuth.currentUser) {
          devMark('LoadingPage: no shared session — back to /login');
          window.location.href = '/login';
          return;
        }
        const username = sharedAuth.currentUser.email.split('@')[0];

        if (import.meta.env.DEV) {
          // Dev: shared and per-client are the same Firebase project; skip custom-token exchange.
          await holdMin(startedAt);
          devMark('LoadingPage: dev — navigate to dashboard');
          navigate('/dashboard', { replace: true });
          return;
        }

        const getCustomToken = httpsCallable(sharedFunctions, 'getCustomToken');
        const tokenResp = await getCustomToken({ username });
        const token = tokenResp.data.token;

        const configRes = await fetch(`/clients/${username}.json`);
        if (!configRes.ok) throw new Error('client_config_not_found');
        const userConfig = await configRes.json();

        const userAppName = username;
        const existingUserApp = getApps().find((a) => a.name === userAppName);
        const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
        const userAuth = getAuth(userApp);

        await signInWithCustomToken(userAuth, token);

        await holdMin(startedAt);
        devMark('LoadingPage: navigate to dashboard');
        navigate('/dashboard', { replace: true });
      } catch (err) {
        devMark('LoadingPage ERR: ' + (err?.message || 'unknown'));
        console.error('[LoadingPage] sign-in pipeline failed', err);
        sessionStorage.setItem('__rw_login_error', err?.message || 'unknown');
        window.location.href = '/login';
      }
    }

    function holdMin(startedAt) {
      const remaining = computeRemainingHold({
        startedAt,
        now: performance.now(),
        minMs: MIN_DISPLAY_MS,
      });
      return new Promise((r) => setTimeout(r, remaining));
    }

    run();
  }, [navigate, params]);

  return <LoginLoader />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/LoadingPage.jsx
git commit -m "feat: add LoadingPage that orchestrates post-popup sign-in pipeline"
```

---

## Task 5: Wire the new `/loading` route inside the per-client router

**Files:**
- Modify: `src/App.jsx` (add the route inside the same `<Routes>` block that hosts `/dashboard`)

- [ ] **Step 1: Add the lazy import near the other lazy imports (around line 30)**

```jsx
const LoadingPage = lazy(() => import('./pages/LoadingPage'));
```

- [ ] **Step 2: Add the route inside the per-client `<Routes>` block**

Find the block (around line 85) that contains `<Route element={<Layout />}>` followed by `<Route path="dashboard" element={<DashboardPage />} />`. Add the loading route as a sibling **outside** the `Layout` wrapper (because the `Layout` assumes a fully signed-in user with `useAccess`):

```jsx
<Routes>
  <Route path="loading" element={<LoadingPage />} />
  <Route element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    {/* ...rest unchanged */}
  </Route>
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

- [ ] **Step 3: Verify build still succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: register /loading route inside per-client router"
```

---

## Task 6: Refactor `SharedLogin.jsx` — navigate-early + auto-redirect

**Files:**
- Modify: `src/pages/SharedLogin.jsx`

This is the highest-impact change in the plan. Two behaviors:
1. On mount, if the user is already signed in to the shared project, redirect immediately to `/{clientId}/loading` without showing the form.
2. On Google sign-in success, navigate to `/{clientId}/loading` IMMEDIATELY after `signInWithCredential` resolves — do NOT call `getCustomToken` or `signInWithCustomToken` here.

- [ ] **Step 1: Replace the `useEffect` that initializes shared Firebase**

Find the existing `useEffect` near the top of `SharedLogin` (the one calling `initSharedFirebase().then(...)`) and replace it with:

```jsx
useEffect(() => {
  initSharedFirebase()
    .then((shared) => {
      sharedRef.current = shared;
      // Auto-redirect: already signed in → go straight through the loader
      if (shared.auth.currentUser) {
        const username = shared.auth.currentUser.email.split('@')[0];
        window.location.href = `/${username}/loading`;
        return;
      }
      // Surface any error left by LoadingPage on a previous failed attempt
      const prior = sessionStorage.getItem('__rw_login_error');
      if (prior) {
        sessionStorage.removeItem('__rw_login_error');
        if (prior === 'client_config_not_found') {
          setError('Configuração do usuário não encontrada.');
        } else {
          setError('Falha na autenticação. Tente novamente.');
        }
      }
      setInitDone(true);
    })
    .catch((err) => {
      console.error('[SharedLogin] init error', err);
      setError('Erro ao carregar configuração. Tente novamente.');
      setInitDone(true);
    });
}, []);
```

- [ ] **Step 2: Replace `handlePostSignIn` with an early navigation**

Delete the entire existing `handlePostSignIn` function (the one that calls `getCustomToken`, fetches client JSON, calls `signInWithCustomToken`, and ends with `window.location.href`). Replace with:

```jsx
const handlePostSignIn = async (email) => {
  devMark('SharedLogin: signed in as ' + email);
  if (!email) throw new Error('No email returned from Google');
  const username = email.split('@')[0];
  // Navigate immediately to the per-client loading route. The LoadingPage
  // owns the rest of the pipeline (config fetch, getCustomToken,
  // signInWithCustomToken). This is what makes the login button stop spinning fast.
  window.location.href = `/${username}/loading`;
};
```

- [ ] **Step 3: Update `handleGoogleSignIn` and `handleDevEmulatorSignIn` to drop the `functions` arg**

In `handleGoogleSignIn`, change:

```jsx
await handlePostSignIn(result.user.email, functions);
```

to:

```jsx
await handlePostSignIn(result.user.email);
```

Apply the same change in `handleDevEmulatorSignIn`.

- [ ] **Step 4: Run the dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173/login`, click the dev-emulator sign-in button. Expected:
- Button briefly shows spinner.
- Page navigates to `/{username}/loading`.
- Lottie + rotating copy appears for at least 800ms.
- Then dashboard appears.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SharedLogin.jsx
git commit -m "feat: SharedLogin navigates to /loading immediately after shared sign-in"
```

---

## Task 7: PWA persistent storage — request after first auth

**Files:**
- Modify: `src/contexts/PWAInstallContext.jsx`

- [ ] **Step 1: Read the current file**

```bash
cat src/contexts/PWAInstallContext.jsx
```

- [ ] **Step 2: Add a one-time `navigator.storage.persist()` call inside `PWAInstallProvider`**

Add at the top of the file (if missing):

```jsx
import { devMark } from '../lib/devMarker';
```

Inside the `PWAInstallProvider` component body, add:

```jsx
useEffect(() => {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  if (sessionStorage.getItem('__rw_storage_persist_asked') === '1') return;
  sessionStorage.setItem('__rw_storage_persist_asked', '1');
  navigator.storage.persist().then((granted) => {
    devMark('storage.persist granted=' + granted);
  }).catch(() => {});
}, []);
```

(Ensure `useEffect` is imported from `react`.)

- [ ] **Step 3: Commit**

```bash
git add src/contexts/PWAInstallContext.jsx
git commit -m "feat: request persistent IndexedDB storage on first session"
```

---

## Task 8: Fix the `onAuthStateChanged` race in `AppRouter`

**Files:**
- Modify: `src/App.jsx` (the `AppRouter` component, around line 130)

The current `AppRouter` subscribes to `onAuthStateChanged(auth, ...)` at the top of the React tree, but `auth` from `firebase.js` is a live binding that may be `undefined` until `ClientConfigContext` initializes it. The fix is to delay the subscription until `auth` is non-null.

- [ ] **Step 1: Replace the `useEffect` body in `AppRouter`**

Replace the existing `useEffect` in `AppRouter` (the one that calls `onAuthStateChanged(auth, ...)`) with:

```jsx
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
        resolved = true;
        if (devTimer) clearTimeout(devTimer);
        setUser(currentUser);
        setLoading(false);
        return;
      }

      // Dev sessionStorage fallback — preserve existing 3s wait
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
```

- [ ] **Step 2: Build and run dev server, manually verify**

```bash
npm run build && npm run dev
```

Open `http://localhost:5173/{username}/dashboard` directly (after a prior login). Expected: spinner → dashboard, no flash to "/login" redirect.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix: defer onAuthStateChanged subscription until firebase auth is initialized"
```

---

## Task 9: Add `AppErrorBoundary` and wrap the router

**Files:**
- Create: `src/components/AppErrorBoundary.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the error boundary**

Create `src/components/AppErrorBoundary.jsx`:

```jsx
import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }

  handleReload = () => {
    sessionStorage.removeItem('__rw_reload_guard');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Algo deu errado.
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
            </p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap the outermost return in `App.jsx`**

At the top of `src/App.jsx`, add:

```jsx
import AppErrorBoundary from './components/AppErrorBoundary';
```

Find the top-level returned JSX in `App.jsx` (typically wrapping `<ClientConfigProvider>` or `<BrowserRouter>`). Wrap it as:

```jsx
return (
  <AppErrorBoundary>
    {/* existing top-level JSX (ClientConfigProvider / BrowserRouter / etc.) */}
  </AppErrorBoundary>
);
```

- [ ] **Step 3: Verify build succeeds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AppErrorBoundary.jsx src/App.jsx
git commit -m "feat: add AppErrorBoundary to prevent blank screens on render errors"
```

---

## Task 10: Surface JSON fetch errors in `ClientConfigContext` with a reload button

**Files:**
- Modify: `src/contexts/ClientConfigContext.jsx`

- [ ] **Step 1: Update the error render branch**

Find the `if (error)` branch (around line 45) and replace with:

```jsx
if (error) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-300">
          Não foi possível carregar a configuração.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600"
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/ClientConfigContext.jsx
git commit -m "feat: show reload button when client config fetch fails"
```

---

## Task 11: Stale-chunk guard via build hash

**Files:**
- Modify: `vite.config.js`
- Modify: `index.html`
- Create: `src/lib/buildHash.js`
- Modify: `src/main.jsx`

- [ ] **Step 1: Inject `__BUILD_HASH__` at build time**

Open `vite.config.js`. Add at the top of the file (after existing imports):

```js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readBuildHash() {
  try {
    // Read .git/HEAD without spawning a subprocess (safer for build hooks).
    const head = readFileSync(resolve(process.cwd(), '.git/HEAD'), 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const refPath = head.slice(5);
      const sha = readFileSync(resolve(process.cwd(), '.git', refPath), 'utf8').trim();
      return sha.slice(0, 7);
    }
    return head.slice(0, 7);
  } catch {
    return Date.now().toString(36);
  }
}
const buildHash = readBuildHash();
```

Inside `defineConfig({...})`, add (or merge with existing `define`):

```js
define: {
  __BUILD_HASH__: JSON.stringify(buildHash),
},
```

- [ ] **Step 2: Add cache-control to `index.html`**

Open `index.html`. Inside `<head>`, add (if not already present):

```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

- [ ] **Step 3: Create the runtime guard**

Create `src/lib/buildHash.js`:

```js
const KEY = '__rw_build_hash';
const RELOAD_GUARD = '__rw_reload_guard';

export function checkBuildHash() {
  try {
    const current = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : null;
    if (!current) return;
    const stored = localStorage.getItem(KEY);
    if (stored && stored !== current) {
      // Hash changed since last load. Reload — but only once per session.
      if (sessionStorage.getItem(RELOAD_GUARD) === '1') {
        sessionStorage.removeItem(RELOAD_GUARD);
        localStorage.setItem(KEY, current);
        return;
      }
      sessionStorage.setItem(RELOAD_GUARD, '1');
      localStorage.setItem(KEY, current);
      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .finally(() => window.location.reload());
      } else {
        window.location.reload();
      }
      return;
    }
    localStorage.setItem(KEY, current);
  } catch {
    // storage unavailable — best-effort, skip.
  }
}
```

- [ ] **Step 4: Call `checkBuildHash()` from `src/main.jsx`**

Open `src/main.jsx`. Add at the very top of the file:

```jsx
import { checkBuildHash } from './lib/buildHash';
checkBuildHash();
```

- [ ] **Step 5: Verify build succeeds and inspect output**

```bash
npm run build
```

Inspect `dist/index.html` and confirm the cache-control meta tags are present.

- [ ] **Step 6: Commit**

```bash
git add vite.config.js index.html src/lib/buildHash.js src/main.jsx
git commit -m "feat: stale-chunk guard via build hash + no-cache index"
```

---

## Task 12: Manual QA pass

**Files:** none

- [ ] **Step 1: Build & deploy to a preview channel**

```bash
npm run build
firebase hosting:channel:deploy login-rework
```

Expected: a preview URL is printed.

- [ ] **Step 2: Run the QA checklist on each target**

For each environment (Chrome desktop, Safari desktop, iOS Safari PWA, Android Chrome PWA), verify:

- [ ] Click "Entrar com Google" — Google popup appears within 1s of click.
- [ ] After picking the Google account, the branded loading screen appears within ~500ms (no long button-spin).
- [ ] Loading screen shows for at least 800ms even if backend is fast.
- [ ] Dashboard appears after the loader.
- [ ] Close tab, reopen `realwise.com.br` — landing page; click "Entrar"; auto-redirected straight to dashboard with no popup.
- [ ] Sign out from inside the app, then visit `/login` — login form appears.
- [ ] Refresh `/{clientId}/dashboard` — dashboard re-renders, no white screen.
- [ ] Disconnect network mid-loading — error path shows the "Demorando mais que o normal..." copy + retry button after 8s.
- [ ] After deploy of a new build, the previously-loaded tab does not stay on the old version forever (build hash guard reloads once).

- [ ] **Step 3: If all targets pass, promote to production**

```bash
firebase deploy --only hosting
```

- [ ] **Step 4: Tag the release**

```bash
git tag login-rework-v1
git push origin main --tags
```

---

## Self-review notes

- **Spec coverage:** §1 → Tasks 4+5+6, §2 (loader relationship) → Task 5, §3 (LoginLoader) → Tasks 2+3+4, §3a/b/c persistence → Tasks 7+8, §4 white-screen → Tasks 9+10+11, §5 auto-redirect → Task 6, §6 SPA navigation → Task 4 (uses `navigate(...)`).
- **Placeholder scan:** No `TBD`, no "implement later", no "add appropriate error handling" — every step shows the code or command.
- **Type consistency:** `LoginLoader`, `LoadingPage`, `AppErrorBoundary`, `checkBuildHash`, `pickMessageIndex`, `computeRemainingHold` are referenced consistently across tasks.
- **Out of scope (per spec):** No instrumentation/telemetry tasks, no Identity Platform / OIDC tasks, no UID migration, no `getCustomToken` deletion.
