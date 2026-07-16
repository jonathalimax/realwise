# Auth & Loading Bug Fixes — Design Spec
**Date:** 2026-05-21

## Overview

Two independent auth bugs causing infinite loading states:

1. **Google popup dirty state** — after a failed `signInWithPopup`, Firebase leaves internal pending state; the next retry silently misbehaves or hangs.
2. **LoadingPage wrong Firebase app** — `LoadingPage` signs the user into a named Firebase app instance (`realwisetest2`), but `AppRouter` listens to the default app's auth. The sign-in event never propagates → infinite loading for users without an existing cached session.

---

## Bug 1 — Google Popup Dirty State

**File:** `src/components/Auth.jsx`

**Root cause:** `handleGoogleSignIn` catches errors and calls `setError(message)`, but never calls `signOut(auth)`. Firebase's internal popup state machine tracks a pending popup request. On the next button click, `signInWithPopup` sees the stale pending request and throws `auth/cancelled-popup-request`, which shows an error — but if the loading state gets confused, the button stays disabled.

**Fix:** Add `await signOut(auth).catch(() => {})` at the top of the catch block, before `setError(...)`. This resets Firebase's auth state machine so the next attempt starts clean.

**Scope:** `src/components/Auth.jsx` — catch block in `handleGoogleSignIn` only.

---

## Bug 2 — LoadingPage Signs into Wrong Firebase App

**File:** `src/pages/LoadingPage.jsx`

**Root cause:** LoadingPage calls:
```js
const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
const userAuth = getAuth(userApp); // named app: 'realwisetest2'
await signInWithCustomToken(userAuth, token);
```

But `AppRouter` uses:
```js
import { auth } from '../firebase'; // default app: '[DEFAULT]'
unsubscribe = onAuthStateChanged(auth, ...);
```

Firebase auth instances are isolated per app instance. Sign-in on the named app is invisible to the default app's listener. `AppRouter` stays in `loading: true` forever.

**Why jonathalimax works:** Users with a prior session have the auth token cached in IndexedDB under the default app. The `onAuthStateChanged` fires from cache on mount, resolving `loading` before the named-app sign-in would even matter. A fresh account (realwisetest2) has no cache → hangs.

**Fix:** Remove the named-app initialization entirely from `LoadingPage`. Since `LoadingPage` renders inside `ClientConfigProvider`, `auth` from `firebase.js` is already initialized with the client's config. Import and use `auth` directly for `signInWithCustomToken`.

```js
// Before
const existingUserApp = getApps().find((a) => a.name === userAppName);
const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
const userAuth = getAuth(userApp);
await signInWithCustomToken(userAuth, token);

// After
import { auth as clientAuth } from '../firebase';
// ...
await signInWithCustomToken(clientAuth, token);
```

The `userConfig` fetch (for the client JSON) and `initializeApp` call can both be removed — `ClientConfigProvider` already handled this.

**Scope:** `src/pages/LoadingPage.jsx` — remove named-app logic, use imported `auth`.

---

## Error Handling

- Both fixes are additions/removals with no new error paths.
- LoadingPage already has a catch block that redirects to `/login` on any failure — unchanged.
- Auth.jsx already shows error messages — the signOut call is best-effort (`.catch(() => {})`).

---

## Testing Checklist

- [ ] Sign in as realwisetest2 fresh (no cached session) — should land on dashboard
- [ ] Sign in as jonathalimax — still works as before
- [ ] Close Google popup mid-flow → shows error → retry → succeeds (no infinite loading)
- [ ] Sign in from a private window — first attempt may show Firebase error page (known upstream issue), second attempt works
