# Seamless Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a single `/login` entry point where any user can sign in with Google against the shared Firebase project (`limas-finance`). After successful auth the backend mints a custom token scoped to the user's own Firebase project; the frontend silently swaps auth contexts and hard-navigates to `/{username}/dashboard`.

**Architecture:**
- A new standalone React page (`SharedLogin.jsx`) lives outside `ClientConfigProvider` — it bootstraps its own Firebase app from `/clients/app.json`.
- A new Cloud Function (`getCustomToken`) reads a pre-stored service account from `serviceAccounts/{username}` in the shared Firestore, initialises an ephemeral Admin SDK app for that project, mints a custom token, and tears the app down.
- `App.jsx` intercepts `/login` before the `extractClientId` + `ClientConfigProvider` path, returning `SharedLogin` directly.
- A Node CLI script (`scripts/onboard-user.js`) automates the end-to-end provisioning of a new user's Firebase project: GCP project creation → Firebase activation → Firestore/Auth APIs → service account → shared Firestore write → `public/clients/{username}.json`.

**Tech Stack:** React 19, Firebase JS SDK v10 (modular), Firebase Functions v1 (Node 18), `firebase-admin` v12, `googleapis` npm package, Node 18 CLI.

---

## Task 1 — `src/lib/sharedFirebase.js` + `src/pages/SharedLogin.jsx`

### 1a. Create `src/lib/sharedFirebase.js`

- [ ] Create the file `/Users/jonathalima/Developer/personal/limas-finance/src/lib/sharedFirebase.js`:

```js
// src/lib/sharedFirebase.js
// Initialises a Firebase app bound to the shared project (public/clients/app.json).
// Exported instances are lazily initialised on first call to initSharedFirebase().

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const APP_NAME = 'shared';

/**
 * Fetch /clients/app.json, initialise the "shared" Firebase app (idempotent),
 * and return { auth, functions }.
 *
 * @returns {Promise<{ auth: import('firebase/auth').Auth, functions: import('firebase/functions').Functions }>}
 */
export async function initSharedFirebase() {
  // Return existing app if already initialised
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    return {
      auth: getAuth(existing),
      functions: getFunctions(existing),
    };
  }

  const res = await fetch('/clients/app.json');
  if (!res.ok) throw new Error(`Failed to load shared Firebase config: ${res.status}`);
  const config = await res.json();

  const app = initializeApp(config.firebase, APP_NAME);
  return {
    auth: getAuth(app),
    functions: getFunctions(app),
  };
}
```

### 1b. Create `src/pages/SharedLogin.jsx`

- [ ] Create the file `/Users/jonathalima/Developer/personal/limas-finance/src/pages/SharedLogin.jsx`:

```jsx
// src/pages/SharedLogin.jsx
// Standalone login page served at /login.
// Does NOT rely on ClientConfigProvider or the per-client firebase.js bindings.

import { useState, useEffect, useRef } from 'react';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { initSharedFirebase } from '../lib/sharedFirebase';

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
  </div>
);

export default function SharedLogin() {
  const [loading, setLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [error, setError] = useState('');
  const sharedRef = useRef(null); // { auth, functions }

  useEffect(() => {
    initSharedFirebase()
      .then((shared) => {
        sharedRef.current = shared;
        setInitDone(true);
      })
      .catch((err) => {
        console.error('[SharedLogin] init error', err);
        setError('Erro ao carregar configuração. Tente novamente.');
        setInitDone(true);
      });
  }, []);

  const handleGoogleSignIn = () => {
    if (!sharedRef.current) return;
    setError('');
    setLoading(true);

    const { auth } = sharedRef.current;
    const apiKey = auth.app.options.apiKey;
    const authDomain = auth.app.options.authDomain;

    const popup = window.open(
      `https://${authDomain}/__/auth/handler?apiKey=${apiKey}`,
      'mw-google-auth',
      'width=500,height=600,left=300,top=200'
    );

    // Detect popup closed without completing auth
    const pollClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollClosed);
        window.removeEventListener('message', onMessage);
        setLoading(false);
      }
    }, 500);

    const authOrigin = `https://${authDomain}`;

    const onMessage = async (event) => {
      if (event.origin !== window.location.origin && event.origin !== authOrigin) return;
      if (event.data?.type !== 'lf-google-auth') return;

      clearInterval(pollClosed);
      window.removeEventListener('message', onMessage);

      try {
        const { auth, functions } = sharedRef.current;
        const credential = GoogleAuthProvider.credential(event.data.idToken);
        const result = await signInWithCredential(auth, credential);

        const email = result.user.email;
        if (!email) throw new Error('No email returned from Google');

        const username = email.split('@')[0];

        // Ask the backend to mint a custom token for the user's own Firebase project
        let token;
        try {
          const getCustomToken = httpsCallable(functions, 'getCustomToken');
          const response = await getCustomToken({ username });
          token = response.data.token;
        } catch (fnErr) {
          if (fnErr.code === 'functions/not-found') {
            setError('Acesso não autorizado.');
            setTimeout(() => { window.location.href = '/'; }, 3000);
            return;
          }
          throw fnErr;
        }

        // Fetch the user's own Firebase config
        const configRes = await fetch(`/clients/${username}.json`);
        if (!configRes.ok) {
          setError('Configuração do usuário não encontrada.');
          setTimeout(() => { window.location.href = '/'; }, 3000);
          return;
        }
        const userConfig = await configRes.json();

        // Initialise the user's Firebase app (idempotent)
        const userAppName = `user-${username}`;
        const existingUserApp = getApps().find((a) => a.name === userAppName);
        const userApp = existingUserApp ?? initializeApp(userConfig.firebase, userAppName);
        const userAuth = getAuth(userApp);

        await signInWithCustomToken(userAuth, token);

        // Hard-navigate so App.jsx re-runs with the correct clientId in the URL
        window.location.href = `/${username}/dashboard`;
      } catch (err) {
        console.error('[SharedLogin] auth error', err);
        setError('Falha na autenticação. Tente novamente.');
        setLoading(false);
      }
    };

    window.addEventListener('message', onMessage);
  };

  if (!initDone) return <PageLoader />;

  return (
    <div className="min-h-screen flex">
      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-2xl font-semibold text-white">Moneywise</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Controle suas finanças com clareza
          </h1>
          <p className="text-lg text-gray-400">
            Seu painel financeiro pessoal, seguro e isolado.
          </p>
        </div>

        <p className="text-sm text-gray-500">Moneywise — feito com cuidado</p>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-gray-800">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white">Moneywise</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Bem-vindo</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Entre com sua conta Google para acessar seu painel
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 rounded-xl">
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl
              font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700
              active:bg-gray-100 dark:active:bg-gray-600 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continuar com Google
          </button>

          <p className="text-center mt-8 text-sm text-gray-400">
            Acesso restrito a usuários cadastrados
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Verify the files exist and contain no syntax errors:

```bash
node --input-type=module <<'EOF'
import { readFileSync } from 'fs';
readFileSync('/Users/jonathalima/Developer/personal/limas-finance/src/lib/sharedFirebase.js', 'utf8');
readFileSync('/Users/jonathalima/Developer/personal/limas-finance/src/pages/SharedLogin.jsx', 'utf8');
console.log('OK');
EOF
# Expected output: OK
```

---

## Task 2 — `functions/getCustomToken.js` + update `functions/index.js`

### 2a. Create `functions/getCustomToken.js`

- [ ] Create the file `/Users/jonathalima/Developer/personal/limas-finance/functions/getCustomToken.js`:

```js
// functions/getCustomToken.js
// Callable Cloud Function — mints a Firebase custom token for a user's own project.
//
// Caller must be authenticated against the shared Firebase project.
// The shared Firestore must contain a document at serviceAccounts/{username}
// with the full JSON key of a service account in the user's Firebase project.
//
// Returns: { token: string }
// Throws:
//   functions/unauthenticated  — caller not signed in
//   functions/not-found        — serviceAccounts/{username} does not exist
//   functions/internal         — any other failure

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Shared Firestore (already initialised by admin.initializeApp() in index.js)
const db = admin.firestore();

exports.getCustomToken = functions.https.onCall(async (data, context) => {
  // 1. Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to call this function.'
    );
  }

  const { username } = data;
  if (!username || typeof username !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'username is required.'
    );
  }

  // 2. Read service account from shared Firestore
  const saDoc = await db.collection('serviceAccounts').doc(username).get();
  if (!saDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      `No service account configured for user "${username}".`
    );
  }

  const serviceAccountData = saDoc.data();

  // 3. Initialise an ephemeral Admin SDK app for the user's project
  const appName = `user-${username}-${Date.now()}`;
  let userApp;
  try {
    userApp = admin.initializeApp(
      { credential: admin.credential.cert(serviceAccountData) },
      appName
    );
  } catch (err) {
    console.error(`[getCustomToken] Failed to init app for ${username}:`, err);
    throw new functions.https.HttpsError('internal', 'Could not initialise user Firebase app.');
  }

  // 4. Mint the custom token — uid is the username (matches public/clients/{username}.json)
  let token;
  try {
    token = await userApp.auth().createCustomToken(username);
  } catch (err) {
    console.error(`[getCustomToken] createCustomToken failed for ${username}:`, err);
    throw new functions.https.HttpsError('internal', 'Failed to create custom token.');
  } finally {
    // 5. Always clean up the ephemeral app
    await userApp.delete().catch((e) =>
      console.warn(`[getCustomToken] Failed to delete ephemeral app ${appName}:`, e)
    );
  }

  return { token };
});
```

### 2b. Export `getCustomToken` from `functions/index.js`

- [ ] Add the following block at the end of `/Users/jonathalima/Developer/personal/limas-finance/functions/index.js` (after the `exports.stripeWebhook` line):

```js
// ============================================================
// SEAMLESS LOGIN
// ============================================================

const { getCustomToken } = require('./getCustomToken');
exports.getCustomToken = getCustomToken;
```

- [ ] Verify no syntax errors in the new function file:

```bash
cd /Users/jonathalima/Developer/personal/limas-finance/functions && node -e "require('./getCustomToken')" && echo OK
# Expected output: OK
```

- [ ] Deploy the new function:

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && firebase deploy --only functions:getCustomToken
# Expected: functions[getCustomToken(us-central1)]: Successful create operation.
```

---

## Task 3 — `src/App.jsx` — add `/login` intercept

The existing intercept block must be extended with a `/login` check **after** `/purchase-success` and **before** `extractClientId`.

- [ ] Open `/Users/jonathalima/Developer/personal/limas-finance/src/App.jsx` and add the lazy import near the other landing-page lazies (after the `PurchaseSuccessPage` lazy import on line 41):

```jsx
const SharedLogin = lazy(() => import('./pages/SharedLogin'));
```

- [ ] In the `App()` function body, add the `/login` intercept immediately after the `/purchase-success` block. Replace this existing block:

```jsx
  if (window.location.pathname === '/purchase-success') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PurchaseSuccessPage />
      </Suspense>
    );
  }

  const clientId = extractClientId(window.location.pathname);
```

With:

```jsx
  if (window.location.pathname === '/purchase-success') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PurchaseSuccessPage />
      </Suspense>
    );
  }

  if (window.location.pathname === '/login') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SharedLogin />
      </Suspense>
    );
  }

  const clientId = extractClientId(window.location.pathname);
```

- [ ] Confirm the build succeeds with no errors:

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm run build 2>&1 | tail -20
# Expected: dist/index.html and chunk files listed, no ERROR lines
```

---

## Task 4 — `scripts/onboard-user.js`

This CLI script provisions a complete Firebase project for a new user and stores the required artefacts.

**Prerequisites before running:**
- `gcloud` CLI authenticated: `gcloud auth login`
- `firebase` CLI authenticated: `firebase login`
- `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account key with:
  - `roles/resourcemanager.projectCreator`
  - `roles/firebase.admin`
  - `roles/iam.serviceAccountAdmin`
  - `roles/iam.serviceAccountKeyAdmin`
- `BILLING_ACCOUNT_ID` env var (or pass as 3rd CLI arg)
- `SHARED_PROJECT_ID` env var (defaults to `limas-finance`)

### 4a. Install `googleapis` dependency

- [ ] Install `googleapis` as a dev dependency in the repo root:

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npm install --save-dev googleapis
# Expected: added N packages
```

### 4b. Create `scripts/onboard-user.js`

- [ ] Create `/Users/jonathalima/Developer/personal/limas-finance/scripts/onboard-user.js`:

```js
#!/usr/bin/env node
// scripts/onboard-user.js
//
// Provisions a complete Firebase project for a new Moneywise user.
//
// Usage:
//   node scripts/onboard-user.js <email> [billingAccountId]
//   BILLING_ACCOUNT_ID=XXXXXX node scripts/onboard-user.js mariasouza@gmail.com
//
// All gcloud/firebase CLI calls use execSync with static, sanitised arguments
// (username is stripped to [a-z0-9] before use — no shell injection risk).

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const admin = require('firebase-admin');

// ─── Config ────────────────────────────────────────────────────────────────

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/onboard-user.js <email> [billingAccountId]');
  process.exit(1);
}

// Sanitise username: lowercase, alphanumeric only
const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
const projectId = `limas-finance-${username}`;
const billingAccountId = process.argv[3] || process.env.BILLING_ACCOUNT_ID;
const sharedProjectId = process.env.SHARED_PROJECT_ID || 'limas-finance';
const repoRoot = path.resolve(__dirname, '..');

console.log('\nOnboarding user:', email);
console.log('  username    :', username);
console.log('  GCP project :', projectId);
console.log('  shared proj :', sharedProjectId, '\n');

// ─── Helpers ───────────────────────────────────────────────────────────────

// run() is only called with static string literals — no user input is interpolated
// into the shell command string, so execSync is safe here.
function run(cmd, opts = {}) {
  console.log('$', cmd);
  return execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  });
  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  const resourceManager = google.cloudresourcemanager('v1');
  const serviceUsage = google.serviceusage('v1');
  const iam = google.iam('v1');
  const firebaseApi = google.firebase('v1beta1');

  // ── Step 1: Create GCP project ───────────────────────────────────────────
  console.log('[1/9] Creating GCP project...');
  try {
    await resourceManager.projects.create({
      requestBody: { projectId, name: `Moneywise ${username}` },
    });
    console.log('    Created project', projectId);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('    Project already exists — continuing');
    } else {
      throw err;
    }
  }

  // Wait for ACTIVE state (max 60 s)
  for (let i = 0; i < 20; i++) {
    const { data } = await resourceManager.projects.get({ projectId });
    if (data.lifecycleState === 'ACTIVE') break;
    console.log('    Waiting for ACTIVE...', data.lifecycleState);
    await sleep(3000);
  }

  // ── Step 2: Link billing account ─────────────────────────────────────────
  if (billingAccountId) {
    console.log('[2/9] Linking billing account...');
    const billing = google.cloudbilling('v1');
    await billing.projects.updateBillingInfo({
      name: `projects/${projectId}`,
      requestBody: { billingAccountName: `billingAccounts/${billingAccountId}` },
    });
    console.log('    Billing linked');
  } else {
    console.log('[2/9] Skipping billing link (BILLING_ACCOUNT_ID not set)');
  }

  // ── Step 3: Add Firebase to project ──────────────────────────────────────
  console.log('[3/9] Adding Firebase to project...');
  try {
    const op = await firebaseApi.projects.addFirebase({
      project: `projects/${projectId}`,
      requestBody: {},
    });
    let opName = op.data.name;
    let done = false;
    while (!done) {
      await sleep(4000);
      const { data: opData } = await firebaseApi.operations.get({ name: opName });
      done = opData.done;
      if (!done) console.log('    Waiting for Firebase provisioning...');
    }
    console.log('    Firebase added');
  } catch (err) {
    if (err.message?.includes('already')) {
      console.log('    Firebase already enabled — continuing');
    } else {
      throw err;
    }
  }

  // ── Step 4: Enable required APIs ─────────────────────────────────────────
  console.log('[4/9] Enabling Firestore + Auth APIs...');
  for (const api of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) {
    await serviceUsage.services.enable({
      name: `projects/${projectId}/services/${api}`,
      requestBody: {},
    });
    console.log('    Enabled', api);
    await sleep(1000);
  }

  // ── Step 5: Create Firebase web app + fetch SDK config ───────────────────
  console.log('[5/9] Creating Firebase web app...');
  let sdkConfig;
  const fetchSdkConfig = async (appId) => {
    const { data: configData } = await firebaseApi.projects.webApps.getConfig({
      name: `projects/${projectId}/webApps/${appId}/config`,
    });
    return {
      apiKey: configData.apiKey,
      authDomain: configData.authDomain,
      projectId: configData.projectId,
      storageBucket: configData.storageBucket,
      messagingSenderId: configData.messagingSenderId,
      appId: configData.appId,
    };
  };

  try {
    const createOp = await firebaseApi.projects.webApps.create({
      parent: `projects/${projectId}`,
      requestBody: { displayName: `Moneywise ${username}` },
    });
    let opName = createOp.data.name;
    let appData;
    let done = false;
    while (!done) {
      await sleep(3000);
      const { data: opData } = await firebaseApi.operations.get({ name: opName });
      done = opData.done;
      if (done) appData = opData.response;
      else console.log('    Waiting for web app creation...');
    }
    console.log('    Web app created:', appData?.appId);
    sdkConfig = await fetchSdkConfig(appData.appId);
  } catch (err) {
    if (err.message?.includes('already')) {
      console.log('    Web app already exists — fetching config...');
      const { data } = await firebaseApi.projects.webApps.list({
        parent: `projects/${projectId}`,
      });
      sdkConfig = await fetchSdkConfig(data.apps[0].appId);
    } else {
      throw err;
    }
  }
  console.log('    SDK config fetched');

  // ── Step 6: Create service account ───────────────────────────────────────
  console.log('[6/9] Creating service account...');
  const saId = 'moneywise-admin';
  const saEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;

  try {
    await iam.projects.serviceAccounts.create({
      name: `projects/${projectId}`,
      requestBody: {
        accountId: saId,
        serviceAccount: { displayName: 'Moneywise Admin' },
      },
    });
    console.log('    Service account created:', saEmail);
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('    Service account already exists — continuing');
    } else {
      throw err;
    }
  }

  // Grant Firebase Admin role
  const crm = google.cloudresourcemanager('v1');
  const { data: policy } = await crm.projects.getIamPolicy({
    resource: projectId,
    requestBody: {},
  });
  policy.bindings = policy.bindings || [];
  const adminRole = 'roles/firebase.admin';
  const member = `serviceAccount:${saEmail}`;
  const binding = policy.bindings.find((b) => b.role === adminRole);
  if (binding) {
    if (!binding.members.includes(member)) binding.members.push(member);
  } else {
    policy.bindings.push({ role: adminRole, members: [member] });
  }
  await crm.projects.setIamPolicy({ resource: projectId, requestBody: { policy } });
  console.log('    Granted roles/firebase.admin to service account');

  // ── Step 7: Generate private key ─────────────────────────────────────────
  console.log('[7/9] Generating private key...');
  const { data: keyData } = await iam.projects.serviceAccounts.keys.create({
    name: `projects/${projectId}/serviceAccounts/${saEmail}`,
    requestBody: { privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' },
  });
  const serviceAccountJson = JSON.parse(
    Buffer.from(keyData.privateKeyData, 'base64').toString('utf8')
  );
  console.log('    Private key generated');

  // ── Step 8: Store service account in shared Firestore ────────────────────
  console.log('[8/9] Writing service account to shared Firestore...');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: sharedProjectId });
  }
  const sharedDb = admin.firestore();
  await sharedDb.collection('serviceAccounts').doc(username).set(serviceAccountJson);
  console.log('    serviceAccounts/' + username + ' written');

  // ── Step 9: Write public/clients/{username}.json + deploy ─────────────────
  console.log('[9/9] Writing client config + deploying hosting...');
  const clientConfig = {
    clientName: `Moneywise ${username}`,
    firebase: sdkConfig,
    features: {
      investments: true,
      goals: true,
      b3Sync: true,
      whatsapp: false,
      salaryBreakdown: true,
    },
  };
  const configPath = path.join(repoRoot, 'public', 'clients', `${username}.json`);
  fs.writeFileSync(configPath, JSON.stringify(clientConfig, null, 2) + '\n', 'utf8');
  console.log('    Written', configPath);

  // Deploy hosting (static string — no user input in command)
  run(
    `firebase deploy --only hosting --project ${sharedProjectId}`,
    { cwd: repoRoot }
  );

  console.log('\nOnboarding complete for', email);
  console.log('  Login URL :', 'https://moneywise.web.app/login');
  console.log('  Dashboard :', `https://moneywise.web.app/${username}/dashboard\n`);
}

main().catch((err) => {
  console.error('\nOnboarding failed:', err.message || err);
  process.exit(1);
});
```

- [ ] Make the script executable and verify it parses cleanly:

```bash
chmod +x /Users/jonathalima/Developer/personal/limas-finance/scripts/onboard-user.js
node --check /Users/jonathalima/Developer/personal/limas-finance/scripts/onboard-user.js && echo OK
# Expected output: OK
```

- [ ] Dry-run smoke test (no email arg exits with usage message):

```bash
node /Users/jonathalima/Developer/personal/limas-finance/scripts/onboard-user.js 2>&1 | head -2
# Expected output: Usage: node scripts/onboard-user.js <email> [billingAccountId]
```

---

## Commit

- [ ] Stage and commit all new and modified files:

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && \
  git add \
    src/lib/sharedFirebase.js \
    src/pages/SharedLogin.jsx \
    functions/getCustomToken.js \
    functions/index.js \
    src/App.jsx \
    scripts/onboard-user.js && \
  git commit -m "feat: implement seamless /login with shared Firebase + custom token swap"
# Expected: [feat/productization <sha>] feat: implement seamless /login...
```
