# Design: Environment Separation, Reset Script & WhatsApp Guide

**Date:** 2026-04-10  
**Status:** Approved

---

## Overview

Three related improvements to the Limas Finance developer workflow:

1. **Environment separation** — local dev uses Firebase Emulator Suite; production uses the existing `limas-finance` Firebase project
2. **Reset script** — deletes a specific user's data from Firestore, targeting either emulator or production
3. **WhatsApp permanent token guide** — desktop Markdown reference for replacing the expiring Facebook dev token

---

## 1. Environment Separation

### Strategy

Use Vite's built-in env mode system:

| File | Purpose | Loaded when |
|------|---------|-------------|
| `.env.development` | Emulator config (same project ID, emulator ports active) | `npm run dev` |
| `.env.production` | Real Firebase project credentials | `npm run build` / `npm run preview` |
| `.env` | **Delete** — replaced by mode-specific files | — |
| `.env.example` | Updated to document all vars for both modes | — |

Both files use the same `VITE_FIREBASE_*` variable names. The project ID in `.env.development` can be `limas-finance` (or a dummy like `demo-limas`) — the emulator ignores cloud credentials.

### Firebase Emulator Connection (`src/firebase.js`)

When `import.meta.env.DEV` is true, connect all services to local emulator ports:

```js
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFunctionsEmulator } from 'firebase/functions';

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### `firebase.json` Emulators Block

Add an `emulators` section to `firebase.json`:

```json
"emulators": {
  "auth": { "port": 9099 },
  "firestore": { "port": 8080 },
  "functions": { "port": 5001 },
  "ui": { "enabled": true, "port": 4000 }
}
```

### npm Scripts (`package.json`)

```json
"dev": "vite",
"build": "vite build",
"emulators": "firebase emulators:start",
"dev:full": "concurrently \"npm run emulators\" \"npm run dev\""
```

`npm run dev` already uses `.env.development` via Vite's default mode. `npm run emulators` starts the local Firebase stack. `dev:full` runs both in parallel.

---

## 2. Reset Script

### File

`scripts/reset-user-data.js`

### Usage

```bash
node scripts/reset-user-data.js --env=local    # targets emulator, no confirmation needed
node scripts/reset-user-data.js --env=prod     # targets production, requires typing DELETE
```

### Collections Cleared (filtered by userId)

- `transactions`
- `bills`
- `settings`
- `purchases`
- `pending_payments`
- `goals`
- `budgets`
- `cards`
- `investments`

### Flow

1. Parse `--env` flag (default: `local`)
2. If `--env=prod`: print warning, prompt user to type `DELETE` to confirm
3. Initialize Firebase Admin SDK:
   - Local: point to emulator (`FIRESTORE_EMULATOR_HOST=localhost:8080`), no credentials
   - Prod: use `scripts/service-account.json` (gitignored)
4. For each collection: query `where('userId', '==', uid)`, delete in batches of 500
5. Print summary: `Deleted N documents across M collections`

### Auth / Credentials

- `scripts/service-account.json` — Firebase service account key, **gitignored**
- `.gitignore` entry: `scripts/service-account.json`
- The script reads `uid` from a `--uid` flag or prompts for it if not provided

### Script Dependencies

```json
"firebase-admin": "^11.x"  // already in functions/package.json, needs to be available globally or via npx
```

The script will use `firebase-admin` installed in `functions/node_modules` via a relative require, or users can `npm install firebase-admin` at root.

---

## 3. WhatsApp Permanent Token Guide

### File

`~/Desktop/WhatsApp-Permanent-Token-Guide.md`

### Sections

1. **Why Your Token Keeps Expiring** — explains Facebook's 24h dev token vs System User tokens
2. **Step-by-Step: Get a Permanent Token**
   - Meta Business Manager → Settings → System Users
   - Create admin System User
   - Assign WhatsApp app
   - Generate token with "never expire" + `whatsapp_business_messaging` + `whatsapp_business_management` permissions
3. **Update Firebase Function Config**
   - `firebase functions:config:set whatsapp.access_token="<token>"`
   - `firebase functions:config:set whatsapp.phone_number_id="<id>"`
   - `firebase deploy --only functions`
4. **Verify It's Working**
   - Check Firebase Functions logs in console
   - Use `testWhatsApp` endpoint for a test send
5. **Reference: All WhatsApp Config Keys**
   - `whatsapp.access_token`
   - `whatsapp.phone_number_id`
   - `whatsapp.verify_token`

---

## Out of Scope

- Creating a second Firebase cloud project (emulator is sufficient for local dev)
- Migrating existing production data
- Automating the WhatsApp token renewal

---

## Files Changed

| File | Action |
|------|--------|
| `.env` | Delete (replaced by mode-specific files) |
| `.env.development` | Create — emulator config |
| `.env.production` | Create — current prod values |
| `.env.example` | Update — document both modes |
| `src/firebase.js` | Add emulator connection block |
| `firebase.json` | Add `emulators` block |
| `package.json` | Add `emulators` and `dev:full` scripts |
| `scripts/reset-user-data.js` | Create — reset script |
| `.gitignore` | Add `scripts/service-account.json` |
| `~/Desktop/WhatsApp-Permanent-Token-Guide.md` | Create — desktop guide |
