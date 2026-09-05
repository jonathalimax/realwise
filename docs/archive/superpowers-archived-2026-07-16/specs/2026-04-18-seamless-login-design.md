# Seamless Login with Per-User Firebase Projects

**Date:** 2026-04-18  
**Status:** Approved

## Goal

Replace per-client login URLs (`/{clientId}/login`) with a single shared `/login` page. User clicks Google Sign-In once, gets silently authenticated into their own isolated Firebase project, and lands on `/{username}/dashboard` — fully invisible to the user.

## Constraints

- Each user has their own Firebase project (non-negotiable for data isolation)
- One Google button, no double login, no visible redirects
- Unauthorized users (not yet onboarded) see an error and are redirected to `/`
- New user onboarding is fully automated via a CLI script

---

## Architecture

Two Firebase projects at play at runtime:

| Project | Role |
|---|---|
| `limas-finance` (shared) | Hosts `/login` auth, owns `serviceAccounts` Firestore collection |
| `limas-finance-{username}` (per-user) | Owns all financial data, Auth session after token swap |

### Shared Firestore Collections

```
serviceAccounts/{username}  →  { ...googleServiceAccountJson }
```

- Document ID is the username (email prefix, e.g. `jonathalimax`)
- Contains the full Google service account private key JSON
- Firestore security rules: **not readable by any client** — only accessible by Cloud Functions via admin SDK
- Serves double duty: authorization check (doc exists = user is onboarded) + credential store

---

## Login Flow

```
User clicks Google button
  → authenticates against shared Firebase project (limas-finance)
  → get email from result (e.g. jonathalimax@gmail.com)
  → derive username: email.split('@')[0] → "jonathalimax"
  → call Cloud Function getCustomToken({ username })
      → reads serviceAccounts/jonathalimax
      → if not found: throw "not-found" → show error 3s → redirect to /
      → init Firebase Admin for their project using service account
      → mint custom token with uid = username
      → return { token }
  → load /clients/jonathalimax.json → initialize user's Firebase app
  → signInWithCustomToken(userFirebaseAuth, token)
  → window.location.href = "/jonathalimax/dashboard"
```

User sees: Google button → brief spinner → their dashboard.

---

## Components

### 1. `/login` page — `src/pages/SharedLogin.jsx`

- Standalone component, lives **outside** `ClientConfigProvider`
- Initializes the shared Firebase app directly using the config from `public/clients/app.json`
- Reuses the same Google Sign-In UI as `Auth.jsx`
- Contains the full token swap logic (steps above)
- Error state: "Acesso não autorizado" message shown for 3 seconds, then `window.location.href = '/'`

### 2. Cloud Function `getCustomToken` — `functions/getCustomToken.js`

- Firebase callable HTTPS function
- Requires caller to be authenticated on the shared project (Firebase enforces this automatically)
- Input: `{ username: string }`
- Reads `serviceAccounts/{username}` from shared Firestore
- Initializes a separate Firebase Admin app instance for the user's project
- Mints custom token with `uid = username`
- Returns `{ token: string }`
- Cleans up the temporary Admin app instance after use

### 3. `App.jsx` — new `/login` intercept

Add top-level path check before `BrowserRouter`, same pattern as `/` and `/purchase-success`:

```jsx
if (window.location.pathname === '/login') {
  return (
    <Suspense fallback={<PageLoader />}>
      <SharedLogin />
    </Suspense>
  );
}
```

### 4. `functions/index.js`

Export the new `getCustomToken` function alongside existing functions.

---

## Onboarding Script — `scripts/onboard-user.js`

Run: `node scripts/onboard-user.js mariasouza@gmail.com`

Steps performed automatically:

1. Derive username from email (`mariasouza`)
2. Create GCP project `limas-finance-mariasouza` via `gcloud projects create`
3. Add Firebase to project via Firebase Management API
4. Enable Firestore and Firebase Auth on the new project
5. Create a Firebase web app → fetch its SDK config
6. Create a service account + generate private key via GCP IAM API
7. Store service account JSON in shared Firestore → `serviceAccounts/mariasouza`
8. Write `public/clients/mariasouza.json` with web app config (all features enabled)
9. Run `firebase deploy --only hosting`

**Prerequisites:**
- `gcloud` CLI authenticated with an account that has Owner role on the billing account
- `GOOGLE_APPLICATION_CREDENTIALS` set to a service account with Firebase Admin + Project Creator permissions
- `firebase` CLI authenticated

---

## Firestore Security Rules (shared project)

```
match /serviceAccounts/{username} {
  allow read, write: if false;  // only Cloud Functions admin SDK
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| User not in `serviceAccounts` | Show "Acesso não autorizado" 3s → redirect to `/` |
| `getCustomToken` Cloud Function error | Show generic error message |
| `/clients/{username}.json` not found | Show "Aplicativo não encontrado" (existing behavior) |
| `signInWithCustomToken` fails | Show generic error message |

---

## Out of Scope

- Removing the existing `/{clientId}/login` route (kept for backwards compatibility during transition)
- Email/password auth (Google only)
- Self-service signup (onboarding remains manual + scripted by admin)
