# Admin System Design

**Date:** 2026-04-18
**Status:** Approved

## Goal

Build an internal admin dashboard at `/admin` for managing users, tracking sales, running onboarding scripts with live output, and sending templated emails. Accessible only to a configurable list of admin emails.

## Scope

- Admin auth (email/password) and authorization check against `admins` Firestore collection
- User management list with actions: onboard, change state, send email
- Sales dashboard reading `leads` + `purchases` Firestore data with state tracking
- Live onboarding script execution with real-time log streaming via Firestore
- Email sending with templated messages

---

## Architecture

All admin functionality runs on the **shared** Firebase project (`limas-finance`). The admin never touches per-user Firebase projects — those are only managed via the onboarding Cloud Function (which has admin credentials).

### Routing

`/admin` is a new top-level intercept in `App.jsx`, same pattern as `/`, `/login`, and `/purchase-success`. It renders a standalone admin app outside `ClientConfigProvider`, using the shared Firebase config directly.

### Auth Flow

1. Admin visits `/admin` → sees email/password login form
2. Authenticates against shared Firebase Auth (email/password provider)
3. App checks `admins/{email}` exists in shared Firestore
4. If not found → sign out + show "Not authorized" → redirect to `/`
5. If found → show admin dashboard

### Shared Firestore Collections (new)

```
admins/{email}                              → { createdAt }
onboardingRuns/{runId}                      → { email, status, startedAt, completedAt, error? }
onboardingRuns/{runId}/logs/{timestamp}     → { step, message, level, ts }
```

### Shared Firestore Collections (existing, updated)

```
leads/{email}                               → { ..., state: "pending"|"not_paid"|"paid"|"onboarding"|"active"|"cancelled"|"refunded" }
serviceAccounts/{username}                  → { ...serviceAccountJson } (from seamless-login spec)
purchases/{autoId}                          → existing
```

Purchase states:

| State | Meaning |
|---|---|
| `pending` | Checkout started, not completed |
| `not_paid` | Lead exists, never started checkout |
| `paid` | Payment confirmed by Stripe |
| `onboarding` | Paid + client JSON created, not yet deployed |
| `active` | Fully onboarded, using the app |
| `cancelled` | Stripe checkout cancelled |
| `refunded` | Payment refunded |

---

## Pages

### `/admin` (Login)

Email/password form. On successful sign-in + authorization, redirect to `/admin/dashboard`.

### `/admin/dashboard` (Sales Dashboard)

Reads `leads` collection. Shows:

- **Summary cards:** total leads, paid count, active count, revenue total, revenue this month
- **State breakdown:** chart/counts per state
- **Leads table:** columns = email, name, state, amount, purchase date, actions (change state, send email, onboard if paid)

### `/admin/users` (User Management)

Reads `serviceAccounts` joined with `leads`. Shows all onboarded users:

- Columns: username, email, state, onboarded date, actions
- Actions per user: **Send email** (opens modal), **View onboarding logs** (opens last run)

### `/admin/onboard/:runId` (Live Onboarding View)

Shown when admin clicks "Onboard" on a `paid` lead. Creates a new `onboardingRuns/{runId}` doc, calls `onboardUser({ email, runId })`, then displays a terminal-style log panel subscribing via `onSnapshot` to `onboardingRuns/{runId}/logs`. On completion, shows success/failure + link back to dashboard.

---

## Components

### Admin routing in `App.jsx`

```jsx
if (window.location.pathname.startsWith('/admin')) {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminApp />
    </Suspense>
  );
}
```

### `src/pages/admin/AdminApp.jsx`

- Sets up nested routing for `/admin`, `/admin/dashboard`, `/admin/users`, `/admin/onboard/:runId`
- Initializes shared Firebase app
- Wraps auth + authorization check

### `src/pages/admin/AdminAuth.jsx`

Email/password form. Uses `signInWithEmailAndPassword()`. After sign-in, check `admins/{email}` document existence.

### `src/pages/admin/SalesDashboard.jsx`

Reads `leads` via `onSnapshot`. Displays summary cards + table.

### `src/pages/admin/UserList.jsx`

Reads `serviceAccounts` + `leads`. Displays user table.

### `src/pages/admin/OnboardingRun.jsx`

Streams log entries via Firestore subscription. Terminal-style UI.

### `src/pages/admin/EmailModal.jsx`

Opens from any user row. Dropdown of templates, preview pane, send button.

---

## Cloud Functions

### `onboardUser` (new — callable)

Input: `{ email, runId }`
Requires caller authenticated on shared project + email in `admins` collection.

Logic:
1. **Cleanup** — delete `onboardingRuns` docs older than 60 days (and their `logs` subcollections)
2. Update `onboardingRuns/{runId}` → `status: "running"`, `email`, `startedAt`
3. Run the 9 onboarding steps (from seamless-login spec Section 5), writing log entries to `onboardingRuns/{runId}/logs` after each step:
   - Derive username from email
   - Create GCP project via `gcloud projects create`
   - Add Firebase to project via Firebase Management API
   - Enable Firestore + Auth
   - Create Firebase web app + fetch SDK config
   - Create service account + generate key via GCP IAM API
   - Store service account JSON in `serviceAccounts/{username}`
   - Write `public/clients/{username}.json`
   - Run `firebase deploy --only hosting`
4. Update `leads/{email}` → `state: "onboarding"`
5. Update `onboardingRuns/{runId}` → `status: "success"`, `completedAt`
6. On any error → `status: "failed"`, `error`, log entry

Log entry format:
```
{
  step: number,
  message: string,
  level: "info" | "success" | "error",
  ts: serverTimestamp()
}
```

### `sendAdminEmail` (new — callable)

Input: `{ userEmail, templateId }`
Requires caller authenticated + in `admins`.
Loads template by ID (`welcome` or `accept-migration`) from `functions/emailTemplates.js` and sends via existing Nodemailer + Gmail setup.

### `updateLeadState` (new — callable)

Input: `{ email, state }`
Requires caller authenticated + in `admins`.
Updates `leads/{email}.state`.

---

## Email Templates

In `functions/emailTemplates.js`:

| Template ID | Auto-sent | Purpose |
|---|---|---|
| `welcome` | Stripe webhook on purchase | Existing — welcomes the customer |
| `accept-migration` | Manual from admin | Tells the user they need to accept the Firebase project ownership transfer before they can start using the app |

The `accept-migration` template includes instructions for accepting the transfer invitation email from Google Cloud.

---

## Firestore Security Rules (shared project)

```
match /admins/{email} {
  allow read: if request.auth != null && request.auth.token.email == email;
  allow write: if false; // manually managed in console
}

match /onboardingRuns/{runId} {
  allow read: if isAdmin();
  allow write: if false; // only Cloud Functions
  match /logs/{logId} {
    allow read: if isAdmin();
    allow write: if false;
  }
}

match /leads/{email} {
  allow read: if isAdmin();
  allow write: if false; // only Cloud Functions (webhook + updateLeadState)
}

match /serviceAccounts/{username} {
  allow read, write: if false; // only Cloud Functions admin SDK
}

function isAdmin() {
  return request.auth != null &&
         exists(/databases/$(database)/documents/admins/$(request.auth.token.email));
}
```

---

## Onboarding Script Prerequisites (run from Cloud Function)

- Cloud Function has a GCP service account with: Project Creator, Firebase Admin, Service Account Admin roles on billing account
- This service account credentials are attached to the Cloud Function via default Firebase Functions service account (augmented with extra IAM roles)
- Each step wraps its own try/catch, writes a log entry on success or failure

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Admin email not in `admins` collection | Sign out, show error, redirect to `/` |
| `onboardUser` step fails | Log error in Firestore, set `status: "failed"`, UI shows error + retry link |
| `sendAdminEmail` fails | Toast error message, log to Cloud Function logs |
| GCP quota exceeded during project creation | Specific error message explaining quota needs to be raised |

---

## Out of Scope

- Self-service admin signup (manual creation via Firebase Console)
- Analytics / usage stats aggregation (dropped from scope)
- Multi-admin audit log
- Webhook retries / background job queue
