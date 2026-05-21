# Auth & Loading Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two auth bugs — stale popup state causing infinite loading on retry, and LoadingPage signing into the wrong Firebase app instance causing infinite loading for fresh sessions.

**Architecture:** Both fixes are single-file, surgical changes. Fix 1 flushes Firebase popup state after a failed sign-in. Fix 2 removes LoadingPage's named-app initialization so `signInWithCustomToken` targets the default app that `AppRouter` actually listens to.

**Tech Stack:** React 19, Firebase Auth (`signOut`, `signInWithCustomToken`), Vite

---

## File Map

| File | Change |
|------|--------|
| `src/components/Auth.jsx` | Add `signOut(auth)` call in catch block of `handleGoogleSignIn` |
| `src/pages/LoadingPage.jsx` | Remove named-app logic; import and use `auth` from `../firebase` |

No new files. No test files (these fixes have no pure-function logic to unit test; manual QA steps are included).

---

### Task 1: Clean auth state after failed Google popup

**Files:**
- Modify: `src/components/Auth.jsx` (lines 72–74, the catch block)

- [ ] **Step 1: Open the file and locate the catch block**

In `src/components/Auth.jsx`, find `handleGoogleSignIn` (line 53). The catch block currently looks like:

```js
} catch (err) {
  setError(getErrorMessage(err.code));
} finally {
  setLoading(false);
}
```

- [ ] **Step 2: Add the signOut cleanup**

Replace the catch block with:

```js
} catch (err) {
  await signOut(auth).catch(() => {});
  setError(getErrorMessage(err.code));
} finally {
  setLoading(false);
}
```

`signOut` is already imported at line 6 (`import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'`). No new imports needed. The `.catch(() => {})` prevents the signOut call itself from masking the original error.

- [ ] **Step 3: Verify the full handleGoogleSignIn function looks correct**

After the edit, `handleGoogleSignIn` should be:

```js
const handleGoogleSignIn = async () => {
  setError('');
  setLoading(true);

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const isAllowed = await checkEmailAllowed(result.user.email);
    if (!isAllowed) {
      await signOut(auth);
      setError(language === 'pt'
        ? 'Acesso não autorizado. Entre em contato com o administrador.'
        : 'Access not authorized. Please contact the administrator.');
    } else if (result.additionalUserInfo?.isNewUser) {
      analytics.userSignup(result.user.uid);
    }
  } catch (err) {
    await signOut(auth).catch(() => {});
    setError(getErrorMessage(err.code));
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 4: Manual smoke test**

1. Open the app login page in a browser
2. Click "Continuar com Google"
3. Close the popup window before selecting an account
4. Verify the error message appears ("auth.errors.popupClosed" translation)
5. Click "Continuar com Google" again
6. Complete the sign-in — should succeed without hanging

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/Auth.jsx
rtk git commit -m "fix: flush Firebase auth state after failed Google popup"
```

---

### Task 2: Fix LoadingPage signing into wrong Firebase app instance

**Files:**
- Modify: `src/pages/LoadingPage.jsx`

- [ ] **Step 1: Understand what to remove**

Currently `LoadingPage.jsx` imports from Firebase at the top:

```js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
```

And in `run()`, after getting the token, it does:

```js
const configRes = await fetch(`/clients/${username}.json`);
if (!configRes.ok) throw new Error('client_config_not_found');
const userConfig = await configRes.json();

const userAppName = username;
const existingUserApp = getApps().find((a) => a.name === userAppName);
const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
const userAuth = getAuth(userApp);

await signInWithCustomToken(userAuth, token);
```

This fetches the client config again (already loaded by `ClientConfigProvider`) and creates a named Firebase app. The named app's auth instance is invisible to `AppRouter`'s `onAuthStateChanged`.

- [ ] **Step 2: Add the import for auth from firebase.js**

Add to the existing imports at the top of `src/pages/LoadingPage.jsx`:

```js
import { auth as clientAuth } from '../firebase';
```

The full import block should become:

```js
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { initSharedFirebase } from '../lib/sharedFirebase';
import { auth as clientAuth } from '../firebase';
import LoginLoader from '../components/LoginLoader';
import { devMark } from '../lib/devMarker';
import { markLoginSession } from '../lib/auth/sessionAge';
```

Note: `initializeApp` and `getApps` imports are removed entirely. `getAuth` is also removed.

- [ ] **Step 3: Replace the named-app sign-in block**

Find this block inside the `run()` function (after `const token = tokenResp.data.token`):

```js
const configRes = await fetch(`/clients/${username}.json`);
if (!configRes.ok) throw new Error('client_config_not_found');
const userConfig = await configRes.json();

const userAppName = username;
const existingUserApp = getApps().find((a) => a.name === userAppName);
const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
const userAuth = getAuth(userApp);

await signInWithCustomToken(userAuth, token);
```

Replace it with:

```js
await signInWithCustomToken(clientAuth, token);
```

`clientAuth` is the default Firebase app's auth instance, already initialized by `ClientConfigProvider` with the client's Firebase config before `LoadingPage` ever renders.

- [ ] **Step 4: Verify the complete run() function looks correct**

After the edit, the full `run()` function inside the `useEffect` should be:

```js
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
      devMark('LoadingPage: dev — set isReady');
      setIsReady(true);
      return;
    }

    const getCustomToken = httpsCallable(sharedFunctions, 'getCustomToken');
    const tokenResp = await getCustomToken({ username });
    const token = tokenResp.data.token;

    await signInWithCustomToken(clientAuth, token);
    markLoginSession();
    localStorage.setItem('rw_last_client', username);

    devMark('LoadingPage: set isReady');
    setIsReady(true);
  } catch (err) {
    devMark('LoadingPage ERR: ' + (err?.message || 'unknown'));
    console.error('[LoadingPage] sign-in pipeline failed', err);
    sessionStorage.setItem('__rw_login_error', err?.message || 'unknown');
    window.location.href = '/login';
  }
}
```

- [ ] **Step 5: Manual smoke test**

1. Open an incognito/private window
2. Go to `realwise.com.br/realwisetest2/loading` (or the equivalent staging URL)
3. Verify the animation plays and transitions to `/dashboard` within ~3 seconds
4. Also test `jonathalimax` — should still work as before

- [ ] **Step 6: Commit**

```bash
rtk git add src/pages/LoadingPage.jsx
rtk git commit -m "fix: sign into default Firebase app in LoadingPage — fixes infinite loading for fresh sessions"
```

---

## Post-Deploy Verification

- [ ] Deploy hosting: `npm run deploy:hosting` (or `firebase deploy --only hosting`)
- [ ] Log in as `realwisetest2` from a browser with no cached session — confirm dashboard loads
- [ ] Log in as `jonathalimax` — confirm no regression
- [ ] Attempt a popup cancel → retry flow — confirm second attempt works cleanly
