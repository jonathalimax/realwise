# Login Rework — Design

**Date:** 2026-05-15
**Status:** Approved, ready for implementation planning
**Target launch:** within 1 week (3–4 working days of implementation)

## Problem

Today's login flow has four user-visible pains:

1. **Two sign-ins.** The Google popup signs in to the shared Firebase project, then a `getCustomToken` Cloud Function mints a token that is exchanged via `signInWithCustomToken` against the per-client project. The user perceives this as a slow, double-step login.
2. **Sessions don't persist.** Users — including on PWA installs and the same browser — are forced to log in again on most visits.
3. **Loading feels boring and broken.** A blank popup followed by a generic spinner makes the wait feel longer than it is.
4. **White screens on refresh.** Reloading `/{clientId}/dashboard` occasionally renders a blank document until a second refresh.

## Non-goals (out of scope)

- ❌ Identity Platform / OIDC federation (a.k.a. "Implementation C")
- ❌ UID migration script
- ❌ Deleting the `getCustomToken` Cloud Function
- ❌ Replacing per-client Firebase Auth with shared-project tokens
- ❌ Any change to Firestore security rules
- ❌ Any change to backend functions
- ❌ Service worker rewrite (a targeted stale-chunk guard only — not a full SW redesign)
- ❌ Login latency telemetry / `loginMetrics` instrumentation

The architectural change ("collapse to one Firebase project / one auth") was evaluated and explicitly deferred. The cost analysis showed it is essentially free in dollars but costs ~1 week of engineering and carries migration risk on the same week we plan to launch. The decision is documented in this conversation; this spec covers only the UX wins that solve the user-visible pain without touching the auth architecture.

## Approach

Keep today's two-Firebase-project architecture and the custom-token sign-in unchanged. Solve the pain through UX and bug fixes:

- Hide the second sign-in behind a branded loading screen so the wait feels intentional, not broken.
- Replace the final `window.location.href` navigation with SPA navigation to remove a full-page reload from the critical path.
- Fix the persistence bugs that cause unwanted logouts.
- Fix the three known sources of white-screen-on-refresh.

The result: the user sees one Google popup, then a Realwise-branded loading screen with rotating Portuguese copy, then their dashboard. No second popup, no blank intermediate states, sessions stick across visits.

## Design

### 1. New login flow

```
[user clicks Entrar com Google]
    ↓
[Google popup — unchanged]
    ↓
[signInWithCredential on shared project]
    ↓
[SPA navigate to /{clientId}/loading — new dedicated route]
    ↓
   ┌─────────────────────────────────────┐
   │  Lottie + rotating Portuguese copy: │
   │  "Preparando seu painel..."         │
   │  "Carregando suas transações..."    │
   │  "Sincronizando seus cartões..."    │
   │  "Quase lá..."                      │
   └─────────────────────────────────────┘
        (running in parallel with the work below)
    ↓
[fetch /clients/{clientId}.json]
[initializeFirebase per-client]
[getCustomToken + signInWithCustomToken]
[onAuthStateChanged confirms session ready]
    ↓
[SPA navigate to /{clientId}/dashboard — no full reload]
```

**Three key changes from today:**

1. The wait is visible and branded instead of being a blank popup → blank navigation → spinner.
2. The final hop uses React Router `navigate(...)` instead of `window.location.href`. This eliminates a full page reload, killing the worst latency contributor in the current flow.
3. **The navigation to `/{clientId}/loading` happens immediately after `signInWithCredential` on the shared project resolves — NOT after `getCustomToken`, per-client config fetch, or `signInWithCustomToken`.** This is the single most important ordering rule in this spec.

#### Why ordering matters (the login-button-spin problem)

Today, `setLoading(true)` is set on the login button click and stays true through the entire post-sign-in pipeline (`getCustomToken` + per-client init + `signInWithCustomToken` + `window.location.href`). The user sees the button spin for ~1.2s–4s of "did anything happen?" before any new screen appears.

The fix is to **navigate to the loading screen as early as possible**, then run the remaining work from inside the loading route's effect. The login button's spinner only needs to cover `signInWithCredential` on the shared project (~150–400ms) — everything after that is hidden behind the branded Lottie.

**Hard constraint for implementation:** the login button handler in `SharedLogin.jsx` MUST navigate to `/{clientId}/loading` as soon as `signInWithCredential` resolves. `getCustomToken`, the per-client config fetch, and `signInWithCustomToken` MUST run from inside the loading route's effect, NOT from the button handler. Reviewers should reject any implementation that blocks on these calls before navigating.

### 2. Relationship to existing loaders

Today there are four spinner/loader instances in the codebase:

| Loader | Location | Trigger | Plan |
|---|---|---|---|
| Spinner in `SharedLogin.jsx` | `/login` | While `initSharedFirebase()` resolves | **Keep** — pre-auth, brief, fine as-is |
| Spinner in `ClientConfigContext.jsx` | Wraps the authenticated tree | While client JSON fetch + Firebase init runs | **Superseded by `LoginLoader` on the login happy path** — kept as a safety-net fallback for direct dashboard refresh |
| Spinner in `AuthenticatedShell` (`App.jsx`) | Inside the auth tree | While `useAccess()` loads `ownerId` | **Superseded by `LoginLoader` on the login happy path** — kept as a safety-net fallback |
| `PageLoader` Suspense fallback in `App.jsx` | Each lazy-loaded page route | While the route's JS chunk downloads | **Keep** — page-level concern, fires after the app shell is already painted |

The two "post-login" spinners (`ClientConfigContext` and `AuthenticatedShell`) are not deleted. They remain in place as safety nets for non-login scenarios (e.g. a direct refresh of `/{clientId}/dashboard`, or deep-linking into the app). On the login happy path they simply do not fire, because by the time the user arrives at `/{clientId}/dashboard` from the new `/{clientId}/loading` route, both `ClientConfigContext` and `AccessContext` are already initialized.

User-visible result on the login happy path: **only the new `LoginLoader` is seen** between Google popup and dashboard. None of the old spinners flash.

### 3. Loading screen — `LoginLoader` component

New component at `src/components/LoginLoader.jsx`. Mounted by the new `/{clientId}/loading` route.

- One Lottie animation file from LottieFiles ("money chart" / "finance loader" style, muted colors that match Realwise's rose accent). Target ~30–60 KB.
- Rotates through 4 Portuguese copy strings on a 2.2s interval:
  1. "Preparando seu painel..."
  2. "Carregando suas transações..."
  3. "Sincronizando seus cartões..."
  4. "Quase lá..."
- **Hard minimum display time: 800ms.** Even if background work finishes faster, hold the screen for 800ms so it doesn't flash. Prevents the "did something happen?" flicker.
- **Hard maximum display time: 8000ms.** After 8s, swap the rotating copy for "Demorando mais que o normal..." with a manual "Tentar novamente" button that re-runs the post-sign-in pipeline.
- Tone: calm, competent, financial-grade. Matches the existing landing page voice.

### 3. Persistence fixes

Three concrete fixes for the "users keep getting logged out" problem.

**3a. Request persistent storage on PWA install / first successful auth.**

```js
// in PWAInstallContext or right after first successful login
if (navigator.storage?.persist) {
  await navigator.storage.persist();
}
```

Tells the browser "do not evict my IndexedDB under storage pressure." Critical for iOS PWAs which evict aggressively.

**3b. Fix the `onAuthStateChanged` race in `App.jsx`.**

Today, `App.jsx` subscribes to `onAuthStateChanged(auth, ...)` but `auth` is a live binding from `firebase.js` — it is `undefined` until `ClientConfigContext` initializes it. If the subscription fires before init, the app falls into the "not signed in" branch.

Fix: defer the subscription until after `useClientConfig()` returns a config. Concretely, move the `onAuthStateChanged` subscription out of the top-level `App` component and into a child component that is only rendered after `ClientConfigContext` resolves (e.g. inside `AuthenticatedShell` or a sibling).

**3c. Verify no code path re-calls `setPersistence` after sign-in.**

`firebase.js` already correctly skips `setPersistence` in its `REUSE app` branch (per the existing inline comment in that file). Audit the codebase for any other `setPersistence` calls and remove them — calling `setPersistence` after a session exists clears it.

### 4. White-screen on refresh — three sources, three fixes

| Source | Fix |
|---|---|
| Service worker serves a stale JS chunk after a deploy (the index.html references hashed chunks the SW does not have cached) | On app init, if `window.__BUILD_HASH__` (injected at build time) does not match the SW's known hash, call `registration.update()` and reload **once** — guarded by a `sessionStorage` flag to prevent reload loops |
| `/clients/{clientId}.json` fetch fails silently in `ClientConfigContext` | Already partially handled — `setError` shows "Aplicativo não encontrado." Verify the error renders end-to-end with no swallowing in a parent boundary; add a manual "Recarregar" button |
| React renders nothing if a lazy import or render throws before the spinner mounts | Wrap `<BrowserRouter>` in a new `<AppErrorBoundary>` that renders a "Algo deu errado. Recarregue a página." card with a reload button instead of a blank document |

### 5. Auto-redirect already-signed-in users away from `/login`

If a user lands on `/login` (e.g. from the landing page header) and they already have a valid session on the shared Firebase project, they should never see the login form. They should be sent straight through the same loading screen to their dashboard.

Implementation in `SharedLogin.jsx`:

```js
useEffect(() => {
  initSharedFirebase().then((shared) => {
    sharedRef.current = shared;
    if (shared.auth.currentUser) {
      // Already signed in — skip the popup, go straight through the loader.
      const username = shared.auth.currentUser.email.split('@')[0];
      window.location.href = `/${username}/loading`;
      return;
    }
    setInitDone(true);
  });
}, []);
```

This means: as long as the user has not explicitly logged out (and storage hasn't been evicted), revisiting `/login` is a no-op — they bounce straight to their dashboard. The login form is only shown when there is genuinely no session.

The "explicit logout" path is unchanged — `signOut(sharedAuth)` clears `currentUser`, after which `/login` shows the form normally.

### 6. SPA navigation refactor

Today the login flow ends with `window.location.href = '/${username}/dashboard'`, forcing a full page reload that re-parses the entire bundle, re-initializes Firebase, and re-mounts the React tree.

Replace with React Router's `useNavigate()` from inside `SharedLogin.jsx` and `ClientConfigContext`:

```js
const navigate = useNavigate();
// ...after sign-in completes:
navigate(`/${clientId}/dashboard`);
```

Constraints to verify during implementation:
- The login route is currently outside the per-client `BrowserRouter basename`. The new `/{clientId}/loading` route must live inside the per-client router so SPA navigation works without reloading.
- The redirect from `/login` → `/{clientId}/loading` will still need a `window.location.href` (or equivalent) because we are crossing basename scopes. Once on `/{clientId}/loading`, all further navigation is SPA.

This is the single biggest latency win in this spec — likely larger than any of the other changes individually.

## Files touched

| File | Change |
|---|---|
| `src/components/LoginLoader.jsx` | **NEW** — Lottie loader component with rotating copy, min/max display time |
| `src/components/AppErrorBoundary.jsx` | **NEW** — top-level React error boundary |
| `src/pages/SharedLogin.jsx` | Strip `window.location.href` from happy path; navigate to per-client loading route after shared sign-in. Add early-return: if `sharedAuth.currentUser` already exists on mount, redirect to `/{clientId}/loading` without showing the form. |
| `src/contexts/ClientConfigContext.jsx` | Use `useNavigate` for the post-init hop to dashboard; surface fetch errors with a reload button |
| `src/contexts/PWAInstallContext.jsx` | Call `navigator.storage.persist()` after first successful auth |
| `src/App.jsx` | Add `/{clientId}/loading` route; wrap router in `<AppErrorBoundary>`; move `onAuthStateChanged` subscription below `ClientConfigProvider` |
| `src/firebase.js` | Audit & document the "do not call `setPersistence` twice" invariant; no functional change unless the audit finds a violation |
| `vite.config.js` | Inject `__BUILD_HASH__` at build time for the stale-chunk guard |
| `public/sw.js` (or wherever the SW lives) | Add the build-hash check + one-time reload guard |

No backend changes. No Firestore rule changes. No new dependencies except Lottie's player (`@lottiefiles/dotlottie-react` or `lottie-react` — pick one during implementation).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| The `onAuthStateChanged` race fix changes provider ordering and breaks an existing context dependency | Implementation plan must trace every `useContext` consumer and verify ordering before/after. Manual QA on every protected page. |
| `navigator.storage.persist()` returns `false` (browser denied) | Best-effort only — no fallback needed. iOS Safari is the primary target and grants it for installed PWAs. |
| Stale-chunk SW guard creates a reload loop if the hash check itself is broken | The guard sets a `sessionStorage` flag before reloading; if the flag is already set on entry, the guard skips the reload and surfaces an error toast instead. |
| Lottie file size bloats the login bundle | Hard cap: 60 KB. Lazy-load the `LoginLoader` component so it only loads on the loading route. |
| 800ms minimum display time makes fast logins feel artificially slow | Acceptable trade-off for eliminating the "did something happen?" flicker. Revisit after launch if user feedback says otherwise. |

## Implementation order (3–4 working days)

| Day | Work |
|---|---|
| Mon | `LoginLoader` component + Lottie pick + new `/{clientId}/loading` route + minimum/maximum display time logic |
| Tue | SPA navigation refactor (kill `window.location.href` from the post-init hop) + `onAuthStateChanged` race fix |
| Wed | PWA `storage.persist()` call + persistence audit + `AppErrorBoundary` |
| Thu | Stale-chunk SW guard + manual QA on iOS PWA, Android PWA, Chrome desktop, Safari desktop |
| Fri | Buffer / polish / ship |

## Acceptance criteria

- After clicking "Entrar com Google" the user sees, in order: Google popup → Realwise-branded loading screen → dashboard. No blank screens between steps.
- Closing and reopening the PWA (or browser tab) does not require re-login. Sessions persist indefinitely until the user explicitly signs out, the refresh token is revoked, or browser storage is evicted (mitigated by `navigator.storage.persist()` in 3a).
- A signed-in user visiting `/login` (e.g. from the landing page header) is auto-redirected to their dashboard via the same loading screen — they never see the login form.
- A user who has explicitly signed out and visits `/login` sees the normal login form.
- Refreshing `/{clientId}/dashboard` renders the dashboard (or a clear error state) — never a blank document.
- The post-popup loading screen shows for at least 800ms and at most 8000ms before navigating to the dashboard.
- Manual QA passes on: iOS Safari PWA, Android Chrome PWA, Chrome desktop, Safari desktop.

## Deferred follow-up (not part of this spec)

If after launch the login still feels slow in production, the natural next spec is **Implementation C — OIDC federation on per-client projects via Identity Platform**. That work would:

- Upgrade each per-client Firebase project to Identity Platform.
- Configure an OIDC provider on each per-client project pointing at `securetoken.google.com/{sharedProjectId}`.
- Replace the `getCustomToken` + `signInWithCustomToken` pair with `signInWithCredential(perClientAuth, OAuthProvider.credential(sharedIdToken))`.
- Delete `functions/getCustomToken.js`.

Estimated win: ~500ms–1.5s of additional latency removed from the post-popup pipeline (one Cloud Function cold start + one Auth round-trip eliminated). Estimated cost: ~1 week of engineering, plus a one-time per-tenant Identity Platform configuration step.

This is documented here so that future-you (or another session) has the option pre-evaluated rather than re-discovered.
