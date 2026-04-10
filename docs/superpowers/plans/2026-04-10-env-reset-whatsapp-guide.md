# Environment Separation, Reset Script & WhatsApp Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Firebase Emulator for local dev, create a user-data reset script that targets either emulator or production, and write a desktop guide for obtaining a permanent WhatsApp token.

**Architecture:** Vite's built-in env modes handle environment separation (`.env.development` → emulator, `.env.production` → cloud). The reset script uses Firebase Admin SDK with an `--env` flag to select target. The WhatsApp guide is a standalone Markdown file on the desktop.

**Tech Stack:** Vite env modes, Firebase Emulator Suite, Firebase Admin SDK (Node.js ESM), Node.js `readline` for interactive confirmation.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `.env.development` | Create | Emulator-pointing Firebase config |
| `.env.production` | Create | Current production Firebase credentials |
| `.env` | Delete | Replaced by mode-specific files |
| `.env.example` | Modify | Document both modes for new developers |
| `.gitignore` | Modify | Add `.env.development`, `.env.production`, `scripts/service-account.json` |
| `firebase.json` | Modify | Add `emulators` block |
| `src/firebase.js` | Modify | Connect to emulators when `import.meta.env.DEV` is true |
| `package.json` | Modify | Add `emulators` and `dev:full` scripts; add `concurrently` dev dep |
| `scripts/reset-user-data.js` | Create | Delete a user's Firestore data (emulator or prod) |
| `~/Desktop/WhatsApp-Permanent-Token-Guide.md` | Create | Step-by-step permanent token setup |

---

## Task 1: Update `.gitignore` and create env files

**Files:**
- Modify: `.gitignore`
- Create: `.env.development`
- Create: `.env.production`
- Modify: `.env.example`

- [ ] **Step 1: Add env files and service account to `.gitignore`**

Open `.gitignore`. After the existing `.env` line, add:

```
.env.development
.env.production
scripts/service-account.json
```

- [ ] **Step 2: Create `.env.development`**

Create `.env.development` with the same project ID as production (credentials are only used for SDK initialization — emulator intercepts all actual network calls):

```
# Firebase config for LOCAL DEVELOPMENT
# All traffic is routed to the Firebase Emulator Suite (localhost)
# These credentials initialize the SDK only — emulator overrides actual Firebase calls

VITE_FIREBASE_API_KEY=AIzaSyBWjz67b6zGgX48QmTV-AL73YaMQY3ViiI
VITE_FIREBASE_AUTH_DOMAIN=limas-finance.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=limas-finance
VITE_FIREBASE_STORAGE_BUCKET=limas-finance.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=223174084388
VITE_FIREBASE_APP_ID=1:223174084388:web:ead52b9db953df90b555b1
```

- [ ] **Step 3: Create `.env.production`**

Copy current `.env` values into `.env.production`:

```
# Firebase config for PRODUCTION
# Do not use this file locally — run `npm run dev` which uses .env.development

VITE_FIREBASE_API_KEY=AIzaSyBWjz67b6zGgX48QmTV-AL73YaMQY3ViiI
VITE_FIREBASE_AUTH_DOMAIN=limas-finance.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=limas-finance
VITE_FIREBASE_STORAGE_BUCKET=limas-finance.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=223174084388
VITE_FIREBASE_APP_ID=1:223174084388:web:ead52b9db953df90b555b1
```

- [ ] **Step 4: Update `.env.example`**

Replace the contents of `.env.example` with:

```
# Firebase Configuration — copy this file to .env.development (local) or .env.production (prod)
# Get values from: https://console.firebase.google.com/ → Project Settings → Your Apps

# For LOCAL DEV: copy to .env.development — traffic goes to Firebase Emulator (localhost)
# For PRODUCTION: copy to .env.production — traffic goes to real Firebase project

VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

- [ ] **Step 5: Delete the old `.env` file**

```bash
rm .env
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example .env.development .env.production
git commit -m "chore: add environment-specific env files for emulator and production"
```

---

## Task 2: Add Firebase Emulator config to `firebase.json`

**Files:**
- Modify: `firebase.json`

- [ ] **Step 1: Add the `emulators` block to `firebase.json`**

Open `firebase.json`. Add the `emulators` key at the top level (alongside `firestore`, `hosting`, etc.):

```json
{
  "storage": {
    "rules": "storage.rules"
  },
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  },
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/payment/create",
        "function": "createPayment"
      },
      {
        "source": "/api/webhook/mercadopago",
        "function": "mercadoPagoWebhook"
      },
      {
        "source": "/api/payment/status",
        "function": "checkPaymentStatus"
      },
      {
        "source": "/__/auth/handler",
        "destination": "/index.html"
      },
      {
        "source": "/[!_]**",
        "destination": "/index.html"
      },
      {
        "source": "/",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add firebase.json
git commit -m "chore: add Firebase Emulator Suite configuration"
```

---

## Task 3: Connect frontend to emulators in dev mode

**Files:**
- Modify: `src/firebase.js`

- [ ] **Step 1: Update `src/firebase.js` to connect to emulators when in dev mode**

Replace the entire file content with:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const missingFirebaseEnvVars = Object.entries({
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
})
  .filter(([, value]) => !value || String(value).trim() === '')
  .map(([key]) => key);

if (missingFirebaseEnvVars.length > 0) {
  throw new Error(
    `Missing Firebase environment variables: ${missingFirebaseEnvVars.join(', ')}. ` +
    'Check your .env.development or .env.production file and restart the Vite dev server.'
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to Firebase Emulator Suite when running locally
// import.meta.env.DEV is true during `npm run dev`, false in production builds
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.log('[Firebase] Connected to Emulator Suite (localhost)');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/firebase.js
git commit -m "feat: connect Firebase SDK to emulators in development mode"
```

---

## Task 4: Add emulator scripts to `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `concurrently` as dev dependency**

```bash
npm install --save-dev concurrently
```

Expected output: `added 1 package` (or similar, no errors)

- [ ] **Step 2: Add `emulators` and `dev:full` scripts to `package.json`**

In `package.json`, replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "emulators": "firebase emulators:start",
  "dev:full": "concurrently \"npm run emulators\" \"npm run dev\""
},
```

- [ ] **Step 3: Verify dev server starts correctly**

```bash
npm run dev
```

Expected: Vite starts on `http://localhost:5173`. Check browser console — you should see `[Firebase] Connected to Emulator Suite (localhost)`. Note: Emulator must also be running (`npm run emulators` in a separate terminal) for actual data operations to work.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add emulators and dev:full npm scripts, install concurrently"
```

---

## Task 5: Create the Firestore reset script

**Files:**
- Create: `scripts/reset-user-data.js`

- [ ] **Step 1: Create the `scripts` directory and reset script**

Create `scripts/reset-user-data.js`:

```js
#!/usr/bin/env node
/**
 * Reset a user's Firestore data.
 *
 * Usage:
 *   node scripts/reset-user-data.js --env=local --uid=<your-firebase-uid>
 *   node scripts/reset-user-data.js --env=prod  --uid=<your-firebase-uid>
 *
 * For --env=prod: requires scripts/service-account.json (download from Firebase Console
 * → Project Settings → Service Accounts → Generate new private key)
 *
 * For --env=local: no credentials needed — targets Firestore Emulator on localhost:8080
 */

import { createRequire } from 'module';
import { createInterface } from 'readline';

const require = createRequire(import.meta.url);

// Parse CLI flags
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);

const env = args.env ?? 'local';
const uid = args.uid;

if (!uid) {
  console.error('Error: --uid=<firebase-user-uid> is required');
  console.error('Find your UID in Firebase Console → Authentication → Users');
  process.exit(1);
}

if (!['local', 'prod'].includes(env)) {
  console.error('Error: --env must be "local" or "prod"');
  process.exit(1);
}

// Collections to clear (all filtered by userId == uid)
const COLLECTIONS = [
  'transactions',
  'bills',
  'settings',
  'purchases',
  'pending_payments',
  'goals',
  'budgets',
  'cards',
  'investments',
];

async function confirm(message) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function deleteCollection(db, collectionName, userId) {
  const collectionRef = db.collection(collectionName);
  let deleted = 0;

  // Firestore batch delete limit is 500 writes
  while (true) {
    const snapshot = await collectionRef
      .where('userId', '==', userId)
      .limit(500)
      .get();

    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
  }

  return deleted;
}

async function main() {
  // For local, point admin SDK at emulator before initialization
  if (env === 'local') {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    console.log('Target: Firebase Emulator (localhost:8080)');
  } else {
    console.log('Target: PRODUCTION Firestore (limas-finance)');
  }

  // Production requires explicit confirmation
  if (env === 'prod') {
    console.log('\n⚠️  WARNING: This will permanently delete all Firestore documents');
    console.log(`   for user UID: ${uid}`);
    console.log('   from the PRODUCTION database. This cannot be undone.\n');
    const answer = await confirm('Type DELETE to confirm: ');
    if (answer !== 'DELETE') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Initialize Firebase Admin SDK
  let admin;
  try {
    admin = require('firebase-admin');
  } catch {
    // Try loading from functions/node_modules if not installed at root
    admin = require('../functions/node_modules/firebase-admin');
  }

  if (env === 'prod') {
    const serviceAccount = require('./service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'limas-finance',
    });
  } else {
    admin.initializeApp({ projectId: 'limas-finance' });
  }

  const db = admin.firestore();

  console.log(`\nDeleting data for UID: ${uid}`);
  console.log('Collections:', COLLECTIONS.join(', '), '\n');

  let totalDeleted = 0;
  for (const col of COLLECTIONS) {
    const count = await deleteCollection(db, col, uid);
    if (count > 0) {
      console.log(`  ✓ ${col}: ${count} document(s) deleted`);
    } else {
      console.log(`  - ${col}: nothing to delete`);
    }
    totalDeleted += count;
  }

  console.log(`\nDone. Deleted ${totalDeleted} document(s) across ${COLLECTIONS.length} collections.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script runs without errors on local (emulator must be running)**

First start the emulator in a separate terminal:
```bash
npm run emulators
```

Then in your main terminal:
```bash
node scripts/reset-user-data.js --env=local --uid=test-uid-123
```

Expected output:
```
Target: Firebase Emulator (localhost:8080)

Deleting data for UID: test-uid-123
Collections: transactions, bills, settings, purchases, pending_payments, goals, budgets, cards, investments

  - transactions: nothing to delete
  - bills: nothing to delete
  ...

Done. Deleted 0 document(s) across 9 collections.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/reset-user-data.js
git commit -m "feat: add Firestore user-data reset script (emulator and production)"
```

---

## Task 6: Create the WhatsApp Permanent Token Guide on desktop

**Files:**
- Create: `~/Desktop/WhatsApp-Permanent-Token-Guide.md`

- [ ] **Step 1: Create the guide file**

Create `~/Desktop/WhatsApp-Permanent-Token-Guide.md`:

```markdown
# WhatsApp Permanent Token — Limas Finance Setup Guide

Last updated: 2026-04-10

---

## Why Your Token Keeps Expiring

When you generate a token directly from the Meta for Developers dashboard, you get a **temporary User Access Token** that expires in 24 hours. This is Facebook's default for developer testing.

The fix is a **System User Token**, which:
- Belongs to your Business Manager (not your personal account)
- Can be set to **never expire**
- Is not affected if your personal Facebook account changes

---

## Step-by-Step: Get a Permanent Token

### Prerequisites
- Access to Meta Business Manager for your app
- Your WhatsApp Business app already created in Meta for Developers

### 1. Open Meta Business Manager

Go to: https://business.facebook.com/settings/

Log in with the account that owns the WhatsApp Business app.

### 2. Create a System User

1. In the left sidebar, click **Users → System Users**
2. Click **Add** (top right)
3. Name it: `limas-finance-whatsapp`
4. Set role: **Admin**
5. Click **Create system user**

### 3. Assign the WhatsApp App to the System User

1. Still in System Users, select your new system user
2. Click **Add Assets**
3. Under **Apps**, find your WhatsApp app (the one in Meta for Developers)
4. Toggle **Full control** ON
5. Click **Save changes**

### 4. Generate the Permanent Token

1. Still on your system user's page, click **Generate new token**
2. Select your app from the dropdown
3. Set **Token expiration** to: **Never**
4. Under permissions, enable:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Click **Generate token**
6. **Copy the token immediately** — it is only shown once

---

## Update Firebase Function Config

Run these commands from the project root (`limas-finance/`):

```bash
# Set the permanent token
firebase functions:config:set whatsapp.access_token="YOUR_PERMANENT_TOKEN_HERE"

# Verify all current WhatsApp config keys
firebase functions:config:get whatsapp
```

Expected output of `config:get`:
```json
{
  "whatsapp": {
    "access_token": "YOUR_TOKEN",
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "verify_token": "YOUR_VERIFY_TOKEN"
  }
}
```

If `phone_number_id` or `verify_token` are missing, set them:
```bash
firebase functions:config:set whatsapp.phone_number_id="YOUR_PHONE_NUMBER_ID"
firebase functions:config:set whatsapp.verify_token="YOUR_VERIFY_TOKEN"
```

Find **Phone Number ID** in: Meta for Developers → Your App → WhatsApp → API Setup → Phone number ID

### Deploy the updated config

```bash
firebase deploy --only functions
```

---

## Verify It's Working

### Check Function Logs

```bash
firebase functions:log --only scheduledBillReminders
firebase functions:log --only whatsappWebhook
```

Look for `[WhatsApp]` log lines. No `401 Unauthorized` errors means the token is valid.

### Send a Test Message

```bash
curl -X POST https://your-project.cloudfunctions.net/testWhatsApp \
  -H "Content-Type: application/json" \
  -d '{"phone": "YOUR_WHATSAPP_NUMBER"}'
```

Replace `your-project` with `limas-finance` and `YOUR_WHATSAPP_NUMBER` with your number in international format (e.g., `5511999999999`).

---

## Reference: All WhatsApp Firebase Config Keys

| Key | Where to find it |
|-----|-----------------|
| `whatsapp.access_token` | Generated in System Users (this guide) |
| `whatsapp.phone_number_id` | Meta for Developers → App → WhatsApp → API Setup |
| `whatsapp.verify_token` | You choose this — must match what's set in the Meta webhook config |

---

## When the Token Needs to Be Replaced

System User tokens with "never expire" do not expire on their own. You only need to regenerate if:
- You revoke the token manually
- The System User is removed from the app
- Meta forces a security reset (rare, you'll receive an email)

---

*Project: Limas Finance | Functions: `functions/index.js` | WhatsApp service: `functions/whatsapp-service.js` (gitignored — contains sensitive config)*
```

- [ ] **Step 2: Verify the file exists**

```bash
ls ~/Desktop/WhatsApp-Permanent-Token-Guide.md
```

Expected: the file path printed (no error)

- [ ] **Step 3: Commit plan completion note**

```bash
git add docs/superpowers/plans/2026-04-10-env-reset-whatsapp-guide.md
git commit -m "docs: add implementation plan for env separation, reset script, WhatsApp guide"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `npm run dev` starts Vite and browser console shows `[Firebase] Connected to Emulator Suite (localhost)`
- [ ] `npm run emulators` starts Firebase Emulator UI at `http://localhost:4000`
- [ ] `npm run dev:full` starts both in parallel
- [ ] `npm run build` completes without errors (uses `.env.production`)
- [ ] `node scripts/reset-user-data.js --env=local --uid=<uid>` runs cleanly against emulator
- [ ] `node scripts/reset-user-data.js --env=prod --uid=<uid>` requires typing `DELETE` before proceeding
- [ ] `~/Desktop/WhatsApp-Permanent-Token-Guide.md` exists and is readable in Preview or any Markdown viewer
- [ ] `.env.development` and `.env.production` are NOT committed (verify with `git status`)
