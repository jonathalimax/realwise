# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Realwise** is a multi-client personal finance SaaS app built with React 19, Vite, Tailwind CSS v4, and a NestJS API. The browser apps talk to the API with cookie auth; Firebase browser bootstrap is no longer the active architecture.

- URL pattern: `realwise.com.br/{clientId}/dashboard` (path-based routing — no subdomains)
- Client config is fetched at runtime from `public/clients/{clientId}.json`
- `apps/web` is the customer app, `apps/admin` is the standalone admin SPA, and `apps/api` serves both

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run lint     # Run ESLint
npm run preview  # Preview production build
npx vitest run src/  # Run unit tests (pure functions only)
```

### Local tenant testing

- Dev server runs at `http://localhost:5173` (uses Vite env vars — no real tenant)
- To test a specific tenant locally: `http://localhost:5173/{clientId}/dashboard`

### Adding a new client

1. Create their Firebase project
2. Copy `public/clients/_template.json` → `public/clients/{clientId}.json`
3. Fill in client config and enable desired feature flags
4. Deploy the apps/API with the repo's current deployment workflow

## Architecture

See **README.md** for the current architecture overview.

### Multi-Client Routing

- `src/config/clientConfig.js` — `extractClientId(hostname)` for subdomains (`jonathalimax.realwise.com.br` → `jonathalimax`); pathname fallback uses first segment (`/jonathalimax/dashboard`)
- `src/contexts/ClientConfigContext.jsx` — fetches `/clients/{id}.json` and loads client config
- `src/firebase.js` — removed
- `src/App.jsx` — sets `BrowserRouter basename="/{clientId}"` so all internal routes resolve correctly

### Backend split

- Tenant data lives behind the API and shared database/storage services.
- Firebase runtime functions and browser SDK bootstrapping have been retired from the active app path.

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
| API cookies / database / object storage | Core app |
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

Backend runtime env vars live in the API service. Check `apps/api/.env` and the Nest modules for the current contract.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
