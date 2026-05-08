# URL Schema Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `/app` segment from all authenticated routes, fix the broken `/purchase-success` top-level route, and ensure `purchase-success` and `login` are never misidentified as clientIds.

**Architecture:** The `App()` component uses a path-prefix switch before mounting any Router — we extend it to also intercept `/purchase-success`. `clientConfig.js` gets two new reserved paths. All internal route definitions and redirects in `App.jsx` are updated to drop `/app`.

**Tech Stack:** React Router v7, Vite, Vitest

---

### Task 1: Guard `purchase-success` and `login` as reserved paths

**Files:**
- Modify: `src/config/clientConfig.js`
- Modify: `src/config/clientConfig.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the `extractClientId` describe block in `src/config/clientConfig.test.js`:

```js
it('returns app when first segment is purchase-success', () => {
  expect(extractClientId('/purchase-success')).toBe('app');
});

it('returns app when first segment is login', () => {
  expect(extractClientId('/login')).toBe('app');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance
npx vitest run src/config/clientConfig.test.js
```

Expected: 2 new tests FAIL — `extractClientId('/purchase-success')` returns `'purchase-success'`, not `'app'`.

- [ ] **Step 3: Update RESERVED_PATHS in `src/config/clientConfig.js`**

```js
const RESERVED_PATHS = ['__', 'api', 'clients', 'purchase-success', 'login'];
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/config/clientConfig.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/clientConfig.js src/config/clientConfig.test.js
git commit -m "feat: reserve purchase-success and login as non-clientId paths"
```

---

### Task 2: Fix `/purchase-success` top-level route in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

**Context:** Currently `/purchase-success` falls through to the `BrowserRouter` with `basename="/purchase-success"`, which means the inner `purchase-success` route never matches. Fix: intercept it before the Router, same as `/`.

- [ ] **Step 1: Add the `/purchase-success` intercept in `App()`**

In `src/App.jsx`, the `App` function currently looks like:

```jsx
function App() {
  if (window.location.pathname.startsWith('/__/auth/')) {
    return <FirebaseAuthHandler />;
  }

  const clientId = extractClientId(window.location.pathname);

  if (window.location.pathname === '/') {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  return (
    <ClientConfigProvider>
      ...
    </ClientConfigProvider>
  );
}
```

Replace it with:

```jsx
function App() {
  if (window.location.pathname.startsWith('/__/auth/')) {
    return <FirebaseAuthHandler />;
  }

  if (window.location.pathname === '/') {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  if (window.location.pathname === '/purchase-success') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PurchaseSuccessPage />
      </Suspense>
    );
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
```

- [ ] **Step 2: Remove the `purchase-success` route from `AppRouter`**

In `AppRouter`, remove:

```jsx
<Route
  path="purchase-success"
  element={
    <Suspense fallback={<PageLoader />}>
      <PurchaseSuccessPage />
    </Suspense>
  }
/>
```

- [ ] **Step 3: Manually verify**

Start dev server: `npm run dev`

Visit `http://localhost:5173/purchase-success` — should render the PurchaseSuccess page, not redirect to login.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "fix: handle /purchase-success as top-level route before BrowserRouter"
```

---

### Task 3: Remove `/app` from all authenticated routes

**Files:**
- Modify: `src/App.jsx`

**Context:** Currently `AuthenticatedApp` has `path="app"` for the dashboard and redirects to `/app`. These all become `/dashboard`.

- [ ] **Step 1: Update routes in `AuthenticatedApp`**

Find this block in `AuthenticatedApp`:

```jsx
<Routes>
  <Route element={<Layout />}>
    <Route index element={<Navigate to="/app" replace />} />
    <Route path="app" element={<DashboardPage />} />
    ...
  </Route>
  <Route path="*" element={<Navigate to="/app" replace />} />
</Routes>
```

Replace with:

```jsx
<Routes>
  <Route element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    ...
  </Route>
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

All other routes (`planner`, `expenses`, `income`, `bills`, `cards`, `transactions`, `transactions/:id/edit`, `settings`, `budget`, `help`, `notifications`, `import`, `goals`, `investments`, `investments/new`, `investments/:id/edit`, `investments/:id/withdraw`) remain unchanged — they never had `/app` in their path.

- [ ] **Step 2: Update the login success redirect in `AppRouter`**

Find:

```jsx
path="login"
element={user ? <Navigate to="/app" replace /> : <Auth />}
```

Replace with:

```jsx
path="login"
element={user ? <Navigate to="/dashboard" replace /> : <Auth />}
```

- [ ] **Step 3: Manually verify the full flow**

Start dev server: `npm run dev`

1. Visit `http://localhost:5173/jonathalimax` — should redirect to `http://localhost:5173/jonathalimax/login` (unauthenticated).
2. Log in — should land at `http://localhost:5173/jonathalimax/dashboard`.
3. Navigate to any page (bills, planner, etc.) — URL should be `/{clientId}/{page}` with no `/app` segment.
4. Visit `http://localhost:5173/jonathalimax/app` — should redirect to `/jonathalimax/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace /app route with /dashboard, clean up URL schema"
```
