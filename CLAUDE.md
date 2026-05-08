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

### Multi-Client Routing

- `src/config/clientConfig.js` — `extractClientId(pathname)` reads the first path segment (e.g. `jonathalimax` from `realwise.com.br/jonathalimax/dashboard`)
- `src/contexts/ClientConfigContext.jsx` — fetches `/clients/{id}.json`, calls `initializeFirebase()`, renders spinner until ready
- `src/firebase.js` — exports live bindings (`auth`, `db`, `storage`, `functions`) initialized by `ClientConfigContext`
- `src/App.jsx` — sets `BrowserRouter basename="/{clientId}"` so all internal routes resolve correctly

### Feature Flags

Defined in each client's JSON under `features`:

| Flag | Default | Controls |
|------|---------|----------|
| `investments` | false | Investments page + Sidebar nav item |
| `goals` | false | Goals page + Sidebar nav item |
| `b3Sync` | false | B3 sync toggle in ImportModal |
| `whatsapp` | false | WhatsApp bill reminder (server-side only) |
| `salaryBreakdown` | false | RendaTab: gross + deductions mode vs simple net input |

Usage: `const hasX = useFeature('x')` from `ClientConfigContext`.

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

- `whatsappWebhook` — WhatsApp Cloud API for bill reminder responses
- `scheduledBillReminders` — Daily 9 AM (Brazil time) bill reminder **emails**. Queries pending bills with `dueDate <= today`, groups by user, fetches the user's email from Firebase Auth, and sends a single digest email via Gmail (Nodemailer). Respects `settings/{userId}.billReminders === false` as opt-out. Logs to `reminder_logs` with `sentVia: 'email'`.
- `sendWhatsAppReminder` / `testWhatsApp` — Manual testing endpoints

### Firestore Collections

- `transactions` — Income/expenses with `userId`, `date`, `amount`, `type`, `category`, `bankId`
- `bills` — Recurring bills with `status` (pending/paid), `dueDate`
- `settings` — Per-user preferences (currency, language, categories, whatsappNumber, `billReminders` opt-out flag)
- `reminder_logs` — Audit trail of sent bill reminders (`userId`, `billId`, `billName`, `sentAt`, `sentVia`)
- `planner` — Per-user planner state including `salarioBruto`, `salarioDeductions`, wallet/allocation config

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

Functions (Firebase Secret Manager via `defineSecret`, set with `firebase functions:secrets:set <NAME>`):
- `EMAIL_USER` / `EMAIL_PASSWORD` — Umbler SMTP credentials. Sender display name is always `"Realwise" <EMAIL_USER>`. Bill reminder deep-links (e.g. `https://realwise.com.br/jonathalimax/bills`) are built from the **recipient's** email username (before `@`), not the sender's.
- `EMAIL_HOST` / `EMAIL_PORT` — Umbler SMTP host/port (defaults: `smtp.umbler.com` / `587`)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe integration
- `whatsapp.access_token` / `whatsapp.phone_number_id` / `whatsapp.verify_token` — WhatsApp Cloud API (still on legacy `functions.config()`)
