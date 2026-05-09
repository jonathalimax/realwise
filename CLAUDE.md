# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Realwise** is a multi-client personal finance SaaS PWA built with React 19, Vite, and Tailwind CSS v4. One codebase and one Firebase Hosting deployment (`realwise.com.br`) serves many clients — each with their own isolated Firebase project (Auth + Firestore) and per-client feature flags.

- URL pattern: `realwise.com.br/{clientId}/dashboard` (path-based routing — no subdomains)
- Client config is fetched at runtime from `public/clients/{clientId}.json`
- Firebase is initialized lazily (not at module load time)

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run lint     # Run ESLint
npm run preview  # Preview production build
npx vitest run src/  # Run unit tests (pure functions only)
```

### Firebase Functions (in `/functions`)

```bash
cd functions && npm install
firebase deploy --only functions    # Deploy cloud functions
firebase functions:config:set ...   # Set config values
```

### Local tenant testing

- Dev server runs at `http://localhost:5173` (uses Vite env vars — no real tenant)
- To test a specific tenant locally: `http://localhost:5173/{clientId}/dashboard`

### Adding a new client

1. Create their Firebase project
2. Copy `public/clients/_template.json` → `public/clients/{clientId}.json`
3. Fill in Firebase credentials and enable desired feature flags
4. Deploy: `firebase deploy --only hosting`

## Architecture

See **README.md** for an end-to-end diagram (browser → hosting → per-client Firebase → Cloud Functions → Stripe/Mercado Pago/email).

### Multi-Client Routing

- `src/config/clientConfig.js` — `extractClientId(hostname)` for subdomains (`jonathalimax.realwise.com.br` → `jonathalimax`); pathname fallback uses first segment (`/jonathalimax/dashboard`)
- `src/contexts/ClientConfigContext.jsx` — fetches `/clients/{id}.json`, calls `initializeFirebase()`, renders spinner until ready. In **DEV**, loads `app` client config so Firebase matches SharedLogin
- `src/firebase.js` — exports live bindings (`auth`, `db`, `storage`, `functions`) initialized by `ClientConfigContext`
- `src/App.jsx` — sets `BrowserRouter basename="/{clientId}"` so all internal routes resolve correctly

### Backend split

- **Tenant data** lives in **each client’s Firebase project** (Auth + Firestore + Storage).
- **Cloud Functions** (`functions/index.js`) are usually deployed to a **central** project: Stripe/Mercado Pago, import processor, B3 sync, admin, `getCustomToken`, etc. Optional **`functions/clientIndex.js`** deploy path (`scripts/deploy-client-functions.sh`) exposes only `scheduledBillReminders` to a client project without coupling unrelated secrets.

### Feature Flags

Defined in each client's JSON under `features`:

| Flag | Default | Controls |
|------|---------|----------|
| `investments` | false | Investments routes (`App.jsx`); nav may still link — verify UX |
| `goals` | false | Goals route + dashboard goal UI (`Dashboard.jsx`) |
| `b3Sync` | false | B3 sync toggle in `ImportModal.jsx`; backend `syncB3Investments` + callable |
| `whatsapp` | false | **Not wired** via `useFeature('whatsapp')` in `src/` today. Landing/checkout collects WhatsApp as **contact** (Stripe metadata); optional `WhatsAppButton` uses a fixed support number. Flag reserved for future server/UI gating |
| `salaryBreakdown` | false | `RendaTab.jsx`: gross + deductions vs simple net |

Usage: `const hasX = useFeature('x')` from `ClientConfigContext`.

### Integrations (quick reference)

| Service | Used for |
|---------|-----------|
| Firebase Auth / Firestore / Storage | Core app |
| SMTP (secrets `EMAIL_*`) | Bill reminders, purchase/admin/import emails |
| Stripe (`createCheckoutSession`, `stripeWebhook`, `createDiscountCheckout`) | Checkout, webhook, admin discount links |
| Mercado Pago (`createPayment`, `processPayment`, `mercadoPagoWebhook`) | Alt. payment path; `functions.config().mercadopago` |
| Brapi (B3) | `b3Sync.js` — investment sync |
| SMS | Not used |
| WhatsApp Cloud API | **Not** exported as a webhook in current `index.js` |

### Frontend Structure

- **Routing**: React Router v7 with dynamic `basename`. Login at `/{clientId}/login`, app at `/{clientId}/dashboard`
- **State Management**: React Context providers nested in `App.jsx`:
  - `ClientConfigContext` — runtime Firebase config + feature flags (outermost)
  - `AccessContext` — user access/permissions, shared account support via `ownerId`
  - `SettingsContext` — currency, language, categories, dark mode
  - `BillsContext`, `BudgetContext`, `CardsContext`, `GoalsContext`, `InvestmentContext`
- **Localization**: Custom i18n in `src/locales/` using dot-notation paths (`t('auth.welcomeBack')`)
- **Path Aliases**: `@` → `src/`, `@landing` → `landing_page/` (configured in vite.config.js)

### Planner

Three tabs: **Renda** / **Alocação** / **Carteira**

- `RendaTab.jsx` — salary input (simple net or gross+deductions based on `salaryBreakdown` flag)
- `rendaCalc.js` — pure functions: `resolveDeduction`, `computeDeductionTotal`, `computeNetSalary`
- `usePlannerState.js` — `liquidezFinal` = `computeNetSalary(salarioBruto, salarioDeductions)`

### Onboarding

- `src/config/onboardingSteps.js` — 3-step definitions with `isComplete(profile)` predicates
- `src/components/OnboardingWizard.jsx` — dismissible progress banner rendered in Layout
- `src/hooks/useOnboardingProfile.js` — reads `userBanks`, transactions, and planner from Firestore

### Key Data Patterns

- All user data is scoped by `userId` field in Firestore collections
- Shared accounts use `ownerId` from `AccessContext` instead of `auth.currentUser.uid`
- Transactions support credit card payment date logic via `getPaymentMonthKey()` from `CardsContext`
- Bank statement imports auto-detect bank format (Nubank, Itaú, Bradesco) in `src/services/importers/`

### Firebase Functions (`/functions`)

- `scheduledBillReminders` — Daily 9 AM (Brazil time) bill reminder **emails** (`clientScheduledBillReminders.js` loads SMTP secrets from a shared Secret Manager project). Respects `settings/{userId}.billReminders === false`. Logs to `reminder_logs` with `sentVia: 'email'`.
- `syncB3Investments` / `syncB3InvestmentsCallable` — B3 price/dividend sync (`b3Sync.js`)
- `processImport` / `onTransactionReviewed` — Storage-triggered import pipeline
- `createCheckoutSession` / `stripeWebhook` — Stripe
- `createPayment` / `processPayment` / `mercadoPagoWebhook` / `checkPaymentStatus` — Mercado Pago
- `getCustomToken`, `onboardUser`, `sendAdminEmail`, `updateLeadState`, `transferClient`, `createDiscountCheckout`, `submitImportIssue`, `sendImportIssueEmail` — Admin / onboarding / support

### Firestore Collections

- `transactions` — Income/expenses with `userId`, `date`, `amount`, `type`, `category`, `bankId`
- `bills` — Recurring bills with `status` (pending/paid), `dueDate`
- `userBanks` — Banks/cards metadata (`CardsContext`)
- `budgets` — Budget documents
- `goals` — Goal documents (when feature enabled)
- `investments` — Investment positions (B3 and manual)
- `settings` — Per-user preferences (currency, language, categories, `billReminders` opt-out, etc.)
- `reminder_logs` — Sent bill reminders audit
- `planner` — Planner state (salary, deductions, allocation)
- `userCategorizationRules` — Import categorization rules
- `bill_reminders` — Bill reminder scheduling helpers (see `BillsContext`)
- Admin / sales (central project): `leads`, `purchases`, `pending_payments`, `coupons`, `importIssues`, etc.

## Styling

- Tailwind CSS v4 with dark mode via `dark:` prefix
- Dark mode toggles `dark` class on `document.documentElement`
- UI components in `src/components/ui/` (button, input, badge, tabs, shimmer)

## Testing

Vitest in `node` environment — only pure functions (no Firebase, no React). Test files sit next to the modules they test.

- `src/config/clientConfig.test.js` — `extractClientId`, `fetchClientConfig`
- `src/config/onboardingSteps.test.js` — step predicates and helpers
- `src/pages/planner/rendaCalc.test.js` — salary deduction math

## Environment Variables

Frontend (`.env`) — only used in dev. Production uses runtime config from `public/clients/{id}.json`.
- `VITE_FIREBASE_*` — Firebase configuration (dev only)

Functions — secrets & config:
- `EMAIL_USER` / `EMAIL_PASSWORD` / `EMAIL_HOST` / `EMAIL_PORT` — SMTP (Umbler defaults). Bill reminder links use the **recipient** email local-part as `clientId` in URLs where applicable.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe (`defineSecret` in discount/checkout modules; legacy `functions.config().stripe` may exist in older deploys)
- `mercadopago.access_token`, `mercadopago.public_key` — Mercado Pago (`functions.config().mercadopago`)
