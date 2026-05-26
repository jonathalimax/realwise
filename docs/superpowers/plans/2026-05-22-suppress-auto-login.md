# Suppress Auto-Login on Auth Failure / Explicit Login Intent

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two UX bugs caused by `SharedLogin`'s unconditional auto-redirect: (A) an auth-failure loop where `LoadingPage` redirects back to `/login` while the shared Firebase session is still set, and (B) the landing page Login button silently bouncing logged-in users back to their app instead of showing the form.

**Architecture:** Three small, surgical edits across three existing files. No new modules, no new dependencies, no auth mechanism changes. We sign out the shared Firebase user in `LoadingPage`'s catch block (mirroring the existing `handleGoToLogin` pattern), and gate `SharedLogin`'s auto-redirect on a one-shot `sessionStorage` flag `__rw_show_login` set by the landing page Login button. Flag naming follows the existing `__rw_login_error` / `__rw_dev_auth_at` convention.

**Tech Stack:** React 19, Vite, Firebase Web SDK v10 (`firebase/auth`), `sessionStorage`.

**Out of scope:** `src/lib/auth/logout.js` (already correct — `logoutAndRedirect` signs out all apps before redirect, so `currentUser` is null by the time `SharedLogin` runs). `ClientConfigContext.handleGoToLogin` (already signs out before navigating to `/login`).

---

### Task 1: Sign out shared Firebase user on LoadingPage failure

**Files:**
- Modify: `src/pages/LoadingPage.jsx`

**Why:** Today the `catch` writes `__rw_login_error` and redirects to `/login`, but leaves `sharedAuth.currentUser` populated. `SharedLogin` auto-redirects back to `/${username}/loading`, which throws the same error → infinite loop. Signing out the shared user breaks the loop and lets `SharedLogin` reach the form, where the `__rw_login_error` banner is rendered.

- [ ] **Step 1: Add `signOut` to the `firebase/auth` import**

  In `src/pages/LoadingPage.jsx` line 4, change:
  ```js
  import { signInWithCustomToken } from 'firebase/auth';
  ```
  to:
  ```js
  import { signInWithCustomToken, signOut } from 'firebase/auth';
  ```

- [ ] **Step 2: Sign out shared user inside the catch block before redirecting**

  Replace the current catch block:
  ```js
  } catch (err) {
    devMark('LoadingPage ERR: ' + (err?.message || 'unknown'));
    console.error('[LoadingPage] sign-in pipeline failed', err);
    sessionStorage.setItem('__rw_login_error', err?.message || 'unknown');
    window.location.href = '/login';
  }
  ```
  with:
  ```js
  } catch (err) {
    devMark('LoadingPage ERR: ' + (err?.message || 'unknown'));
    console.error('[LoadingPage] sign-in pipeline failed', err);
    sessionStorage.setItem('__rw_login_error', err?.message || 'unknown');
    const { auth: sharedAuthForLogout } = await initSharedFirebase().catch(() => ({ auth: null }));
    if (sharedAuthForLogout) await signOut(sharedAuthForLogout).catch(() => {});
    window.location.href = '/login';
  }
  ```

- [ ] **Step 3: Lint and verify**

  ```bash
  cd /Users/jonathalima/Developer/personal/limas-finance && npm run lint
  ```

---

### Task 2: Honor explicit login intent in SharedLogin

**Files:**
- Modify: `src/pages/SharedLogin.jsx`

**Why:** A one-shot `sessionStorage` flag is consumed on read so the auto-redirect remains the default for every other entry path (PWA reopen, direct `/login` visit after natural session expiry, etc.).

- [ ] **Step 1: Promote `.then` callback to `async`**

  Change line 19 from:
  ```js
        .then((shared) => {
  ```
  to:
  ```js
        .then(async (shared) => {
  ```

- [ ] **Step 2: Read and consume `__rw_show_login` before the auto-redirect check**

  Replace the block at lines 21–30:
  ```js
          // Auto-redirect: already signed in → go straight through the loader
          if (shared.auth.currentUser) {
            if (isLoginSessionExpired()) {
              signOut(shared.auth).finally(() => setInitDone(true));
              return;
            }
            const username = shared.auth.currentUser.email.split('@')[0];
            window.location.href = `/${username}/loading`;
            return;
          }
  ```
  with:
  ```js
          // Explicit login intent from landing page suppresses auto-redirect.
          // One-shot: consume immediately so refresh / PWA reopen behaves normally.
          const showLogin = sessionStorage.getItem('__rw_show_login');
          if (showLogin) {
            sessionStorage.removeItem('__rw_show_login');
            if (shared.auth.currentUser) {
              await signOut(shared.auth).catch(() => {});
            }
          } else if (shared.auth.currentUser) {
            // Auto-redirect: already signed in → go straight through the loader
            if (isLoginSessionExpired()) {
              signOut(shared.auth).finally(() => setInitDone(true));
              return;
            }
            const username = shared.auth.currentUser.email.split('@')[0];
            window.location.href = `/${username}/loading`;
            return;
          }
  ```

- [ ] **Step 3: Lint and verify**

  ```bash
  cd /Users/jonathalima/Developer/personal/limas-finance && npm run lint
  ```

  Manual check in dev server:
  1. Sign in so a shared session exists.
  2. Run `sessionStorage.setItem('__rw_show_login', '1')` in the console, navigate to `/login` → form renders (no redirect). Confirm `sessionStorage.getItem('__rw_show_login')` is `null`.
  3. Refresh `/login` directly (no flag) → auto-redirect still fires for active sessions.

---

### Task 3: Set the flag from the landing page Login button

**Files:**
- Modify: `landing_page/components/landing/Header.jsx`

- [ ] **Step 1: Set the flag before navigating**

  Find the Login button (the `onClick` that navigates to `/login`) and add the flag:
  ```jsx
  <button
    onClick={() => {
      sessionStorage.setItem('__rw_show_login', '1');
      window.location.href = '/login';
    }}
    className="h-9 px-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
  >
    Login
  </button>
  ```

- [ ] **Step 2: Build and verify**

  ```bash
  cd /Users/jonathalima/Developer/personal/limas-finance && npm run lint && npm run build
  ```

  In the dev server: load the landing page, click Login while a shared session is active → `SharedLogin` form renders (not an auto-redirect).

---

### Definition of Done

- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run src/` passes (no regressions in existing pure-function tests)
- [ ] Auth failure in `LoadingPage` no longer loops — red error banner appears on `/login`
- [ ] Landing page Login button shows the form even with an active shared session
- [ ] Direct `/login` visits (PWA reopen, bookmarks) still auto-redirect when a valid session exists
- [ ] `logoutAndRedirect()` behavior unchanged
