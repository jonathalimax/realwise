# Plan 7: React Apps API Migration + Firebase Decommission

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/web` and `apps/admin` off direct Firebase SDK usage onto the new NestJS API and cookie-based auth stack, then remove the remaining Firebase-era app/runtime files from the repo.

**Architecture:** `apps/web` keeps the path-based tenant UX (`/{clientId}/...`) but stops initializing tenant Firebase projects in the browser. Instead, it uses `fetch` with `credentials: 'include'` against `apps/api` for auth, CRUD resources, uploads, imports, planner data, and admin/shared operations. `apps/admin` becomes the real standalone admin SPA, reusing a small shared HTTP client and hitting `/admin/*` REST endpoints plus any parity endpoints added in `apps/api`. Once both React apps are on the API, delete Firebase SDK bootstrapping, Cloud Functions-only browser flows, and repo files that only existed for Firebase Hosting/Firestore/Functions.

**Tech Stack:** React 19, Vite 7, React Router 7, NestJS 10, Drizzle ORM, cookie-based JWT auth, Vitest, shared DTOs in `@realwise/types`

## Global Constraints

- No `firebase/*` imports remain anywhere under `apps/web/src/` or `apps/admin/src/` when this plan is complete.
- Browser auth must use API cookies only: `access_token` + `refresh_token`, both sent via `fetch(..., { credentials: 'include' })`.
- Preserve the current tenant URL shape for the user app: `/{clientId}/dashboard`, `/{clientId}/transactions`, etc.
- `apps/admin` owns `/admin/*`; remove the admin route tree from `apps/web`.
- Replace Firestore realtime listeners with explicit fetch + refresh/invalidation. Do not introduce a client-side websocket layer in this plan.
- Reuse `packages/types/` for shared frontend/backend DTOs where shape drift is likely.
- Cleanup is part of the plan, not a follow-up: once parity is verified, remove Firebase config/runtime files and dependencies from the React apps.

---

## File Map

### Create
- `apps/web/src/lib/api/client.js` — shared fetch wrapper for cookie-authenticated API calls
- `apps/web/src/lib/api/auth.js` — login/logout/refresh/me helpers for the user app
- `apps/web/src/lib/api/resources/` — resource clients (`transactions.js`, `accounts.js`, `budgets.js`, `goals.js`, `investments.js`, `planner.js`, `settings.js`, `storage.js`, `imports.js`, `admin.js` if still needed by web)
- `apps/web/src/contexts/AuthContext.jsx` — replaces Firebase auth state listeners in the user app
- `apps/web/src/hooks/useApiQuery.js` — minimal request/reload hook for pages still expecting live updates
- `apps/admin/src/lib/api/client.js` — admin fetch wrapper
- `apps/admin/src/lib/api/auth.js` — admin session bootstrap (`/auth/me`, `/auth/logout`)
- `apps/admin/src/AdminApp.jsx` — actual admin shell moved out of `apps/web`
- `apps/admin/src/pages/` — migrated admin pages from `apps/web/src/pages/admin/`
- `apps/admin/src/components/` — any admin-only extracted UI wrappers
- `apps/admin/src/styles.css` — if needed to mirror current admin styling
- `packages/types/src/api.ts` — shared DTOs for auth/session/admin payloads and resource response envelopes
- `apps/api/src/admin/dto/update-pricing.dto.ts`
- `apps/api/src/admin/dto/create-testimonial.dto.ts`
- `apps/api/src/admin/dto/start-onboarding.dto.ts`
- `apps/api/src/admin/dto/transfer-client.dto.ts`

### Modify
- `packages/types/src/index.ts`
- `apps/web/package.json`
- `apps/admin/package.json`
- `apps/web/src/App.jsx`
- `apps/web/src/main.jsx`
- `apps/web/src/contexts/ClientConfigContext.jsx`
- `apps/web/src/components/Auth.jsx`
- `apps/web/src/pages/SharedLogin.jsx`
- `apps/web/src/pages/LoadingPage.jsx`
- `apps/web/src/lib/auth/logout.js`
- `apps/web/src/contexts/AccessContext.jsx`
- `apps/web/src/contexts/SettingsContext.jsx`
- `apps/web/src/contexts/CardsContext.jsx`
- `apps/web/src/contexts/BillsContext.jsx`
- `apps/web/src/contexts/BudgetContext.jsx`
- `apps/web/src/contexts/GoalsContext.jsx`
- `apps/web/src/contexts/InvestmentContext.jsx`
- `apps/web/src/pages/planner/usePlannerState.js`
- `apps/web/src/pages/planner/usePlannerGoals.js`
- `apps/web/src/pages/planner/usePlannerLayers.js`
- `apps/web/src/components/ImportModal.jsx`
- `apps/web/src/services/importIssueService.js`
- `apps/web/src/services/categorizationService.js`
- `apps/web/src/services/aiCategorizationService.js`
- `apps/web/src/services/linkedRecordDeletion.js`
- `apps/web/src/services/analyticsService.js`
- `apps/web/src/services/importers/index.js`
- `apps/web/src/pages/Dashboard.jsx`
- `apps/web/src/pages/Transactions.jsx`
- `apps/web/src/pages/Expenses.jsx`
- `apps/web/src/pages/Income.jsx`
- `apps/web/src/pages/Budget.jsx`
- `apps/web/src/pages/Goals.jsx`
- `apps/web/src/pages/TransactionEdit.jsx`
- `apps/web/src/pages/InvestmentForm.jsx`
- `apps/admin/src/main.jsx`
- `apps/admin/src/App.jsx`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.module.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.controller.ts` — if frontend migration needs small response/redirect adjustments
- `apps/api/src/health/health.controller.ts` — optional frontend bootstrap smoke endpoint if needed
- `README.md`
- `docs/superpowers/plans/2026-06-23-plan-1-monorepo-infrastructure.md` — close the “removed in Plan 7” note if desired

### Delete
- `apps/web/src/firebase.js`
- `apps/web/src/lib/sharedFirebase.js`
- `functions/`
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firestore-client.json`
- `functions/package-lock.json`
- Firebase-only helper scripts that no longer apply after API migration (verify one-by-one before deletion)

---

## Task 1: Shared HTTP client + typed API contracts

**Files:**
- Create: `packages/types/src/api.ts`
- Modify: `packages/types/src/index.ts`
- Create: `apps/web/src/lib/api/client.js`
- Create: `apps/web/src/lib/api/auth.js`
- Create: `apps/admin/src/lib/api/client.js`
- Create: `apps/admin/src/lib/api/auth.js`
- Test: `apps/web/src/lib/api/client.test.js` or `apps/web/src/lib/api/auth.test.js`

**Interfaces:**
- Produces: one normalized browser API layer for both React apps
- Produces: shared types for `SessionUser`, `ApiError`, admin resource payloads, and upload/import response shapes

- [ ] **Step 1: Add shared API types**

Extend `packages/types/src/` with DTOs for:
- `SessionUser`
- `AuthStatusResponse`
- `PaginatedResponse<T>` if needed
- admin entities used by the UI (`Lead`, `Purchase`, `Coupon`, `ImportIssue`, `PricingConfig`, `OnboardingRun`, `Testimonial`)

- [ ] **Step 2: Write the failing API client test**

Create a Vitest test that asserts:
- `apiClient.get('/auth/me')` sends `credentials: 'include'`
- non-2xx responses are normalized into a predictable error object
- `204 No Content` returns `null` instead of throwing JSON parse errors

Run:
```bash
pnpm --filter @realwise/web test client.test.js
```

Expected: FAIL because the new client does not exist yet.

- [ ] **Step 3: Implement the fetch wrapper**

Create a small wrapper with:
- `get`, `post`, `patch`, `delete`
- automatic `credentials: 'include'`
- JSON request/response handling
- optional `FormData` passthrough for upload/import flows

- [ ] **Step 4: Mirror the wrapper for `apps/admin`**

Do not duplicate logic blindly. Either:
- import from a tiny shared browser-safe helper, or
- keep two tiny wrappers with the same contract if bundling is simpler

- [ ] **Step 5: Re-run tests**

Run:
```bash
pnpm --filter @realwise/web test client.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/types/src apps/web/src/lib/api apps/admin/src/lib/api
git commit -m "feat(frontend): add shared API client foundation"
```

---

## Task 2: Replace Firebase browser auth/bootstrap in `apps/web`

**Files:**
- Create: `apps/web/src/contexts/AuthContext.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/main.jsx`
- Modify: `apps/web/src/contexts/ClientConfigContext.jsx`
- Modify: `apps/web/src/components/Auth.jsx`
- Modify: `apps/web/src/pages/SharedLogin.jsx`
- Modify: `apps/web/src/pages/LoadingPage.jsx`
- Modify: `apps/web/src/lib/auth/logout.js`
- Delete (later in Task 7): `apps/web/src/firebase.js`, `apps/web/src/lib/sharedFirebase.js`

**Interfaces:**
- Consumes: `/auth/google`, `/auth/apple`, `/auth/me`, `/auth/refresh`, `/auth/logout`
- Produces: React auth/session state with no Firebase SDK dependency

- [ ] **Step 1: Write failing auth-context tests**

Cover:
- bootstrap calls `/auth/me`
- unauthenticated state redirects to `/login`
- logout clears UI state after successful `POST /auth/logout`

Run:
```bash
pnpm --filter @realwise/web test AuthContext
```

Expected: FAIL

- [ ] **Step 2: Implement `AuthContext`**

`AuthContext` should own:
- current user/session payload
- loading state
- `refreshSession()`
- `logout()`

Avoid polling `auth` live bindings or `onAuthStateChanged`.

- [ ] **Step 3: Simplify `ClientConfigContext`**

Keep tenant/client config loading, but remove:
- `initializeFirebase(...)`
- `getApps()` / `getAuth()` / `signOut()` cleanup logic

Client config should become feature/config bootstrap only.

- [ ] **Step 4: Update login flows**

Replace Firebase-specific browser flows with API redirects:
- `Auth.jsx` should send users to `/auth/google?clientId=<clientId>` or `/auth/apple?...`
- `SharedLogin.jsx` and `LoadingPage.jsx` should stop using custom tokens and Firebase credential bridging

- [ ] **Step 5: Update the top-level router**

Replace the `auth` polling logic in `App.jsx` with `AuthContext` consumption. Remove the embedded admin lazy route from the web router.

- [ ] **Step 6: Re-run focused tests + build**

Run:
```bash
pnpm --filter @realwise/web test AuthContext SharedLogin LoadingPage
pnpm --filter @realwise/web build
```

Expected: tests pass; build succeeds without importing `firebase/auth`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.jsx apps/web/src/contexts/AuthContext.jsx apps/web/src/contexts/ClientConfigContext.jsx apps/web/src/components/Auth.jsx apps/web/src/pages/SharedLogin.jsx apps/web/src/pages/LoadingPage.jsx apps/web/src/lib/auth/logout.js
git commit -m "feat(web): replace Firebase auth bootstrap with API session auth"
```

---

## Task 3: Migrate `apps/web` stateful resource layers from Firestore to API clients

**Files:**
- Modify: `apps/web/src/contexts/AccessContext.jsx`
- Modify: `apps/web/src/contexts/SettingsContext.jsx`
- Modify: `apps/web/src/contexts/CardsContext.jsx`
- Modify: `apps/web/src/contexts/BillsContext.jsx`
- Modify: `apps/web/src/contexts/BudgetContext.jsx`
- Modify: `apps/web/src/contexts/GoalsContext.jsx`
- Modify: `apps/web/src/contexts/InvestmentContext.jsx`
- Modify: `apps/web/src/pages/planner/usePlannerState.js`
- Modify: `apps/web/src/pages/planner/usePlannerGoals.js`
- Modify: `apps/web/src/pages/planner/usePlannerLayers.js`
- Create: `apps/web/src/lib/api/resources/*.js`

**Interfaces:**
- Consumes: `/accounts`, `/bills`, `/budgets`, `/goals`, `/investments`, `/planner`, `/user-settings`
- Produces: provider state sourced from REST responses instead of Firestore listeners

- [ ] **Step 1: Write one provider test first**

Pick `SettingsContext` as the first slice because it is small and touches several pages. Write a failing test for:
- initial fetch
- optimistic/local update followed by revalidation

- [ ] **Step 2: Implement one resource end-to-end**

Use `SettingsContext` to define the migration pattern:
- load once on mount
- expose mutators via API calls
- update local state explicitly after successful writes

- [ ] **Step 3: Port the remaining contexts one resource at a time**

Recommended order:
1. `SettingsContext`
2. `BillsContext`
3. `CardsContext`
4. `BudgetContext`
5. `GoalsContext`
6. `InvestmentContext`
7. planner hooks
8. `AccessContext`

For `AccessContext`, replace Firestore `access/allowed_emails` reads with an API/session-derived structure. If the current backend lacks a user-access endpoint, add it before changing the provider.

- [ ] **Step 4: Remove `ownerId` assumptions that depended on Firebase UID shape**

Review every provider/page that currently uses Firestore `userId`/document IDs. Align them with API resource IDs and authenticated user/session ownership semantics.

- [ ] **Step 5: Run targeted tests after each provider group**

Run:
```bash
pnpm --filter @realwise/web test SettingsContext BillsContext BudgetContext GoalsContext InvestmentContext walletVersion
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/contexts apps/web/src/pages/planner apps/web/src/lib/api/resources
git commit -m "feat(web): migrate core providers from Firestore to API resources"
```

---

## Task 4: Migrate user-app pages/services that still call Firebase directly

**Files:**
- Modify: `apps/web/src/components/ImportModal.jsx`
- Modify: `apps/web/src/components/TransactionForm.jsx`
- Modify: `apps/web/src/components/TransactionModal.jsx`
- Modify: `apps/web/src/components/EditSingleTransactionModal.jsx`
- Modify: `apps/web/src/components/EditTransactionsModal.jsx`
- Modify: `apps/web/src/components/TransactionList.jsx`
- Modify: `apps/web/src/pages/Dashboard.jsx`
- Modify: `apps/web/src/pages/Transactions.jsx`
- Modify: `apps/web/src/pages/Expenses.jsx`
- Modify: `apps/web/src/pages/Income.jsx`
- Modify: `apps/web/src/pages/Budget.jsx`
- Modify: `apps/web/src/pages/Goals.jsx`
- Modify: `apps/web/src/pages/TransactionEdit.jsx`
- Modify: `apps/web/src/pages/InvestmentForm.jsx`
- Modify: `apps/web/src/services/importIssueService.js`
- Modify: `apps/web/src/services/categorizationService.js`
- Modify: `apps/web/src/services/aiCategorizationService.js`
- Modify: `apps/web/src/services/linkedRecordDeletion.js`
- Modify: `apps/web/src/services/analyticsService.js`
- Modify: `apps/web/src/services/importers/index.js`

**Interfaces:**
- Consumes: `/transactions`, `/storage`, `/imports`, `/investments/b3-sync`, `/admin/import-issues` or a public/import issue endpoint if kept user-facing
- Produces: no remaining user-app Firebase data calls

- [ ] **Step 1: Start with transactions/imports because they span the most pages**

Write failing tests for:
- creating/updating a transaction
- import upload confirmation flow
- linked record deletion behavior

- [ ] **Step 2: Port transaction CRUD components**

Replace direct Firestore `addDoc/updateDoc/getDoc` calls with resource clients. Keep data-shape conversions at the resource boundary, not inside each component.

- [ ] **Step 3: Port import/storage flows**

`ImportModal.jsx` should use:
- API upload URL generation
- direct object upload if still required
- API import confirmation endpoints
- API-triggered B3 sync endpoint

Remove all `firebase/storage` and callable-function usage.

- [ ] **Step 4: Port shared/user services**

Replace:
- `importIssueService.js`
- `categorizationService.js`
- `aiCategorizationService.js`
- `analyticsService.js`

with API-backed endpoints. If endpoints are missing, add them in `apps/api` before migrating the caller.

- [ ] **Step 5: Run app-level tests + smoke builds**

Run:
```bash
pnpm --filter @realwise/web test
pnpm --filter @realwise/web build
```

Expected: PASS; no remaining `firebase/firestore`, `firebase/functions`, or `firebase/storage` imports in tested code paths.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components apps/web/src/pages apps/web/src/services
git commit -m "feat(web): migrate transactions imports and shared services to API"
```

---

## Task 5: Promote `apps/admin` to the real admin SPA and migrate admin pages

**Files:**
- Create/Modify: `apps/admin/src/AdminApp.jsx`
- Modify: `apps/admin/src/App.jsx`
- Modify: `apps/admin/src/main.jsx`
- Create: `apps/admin/src/pages/*`
- Create: `apps/admin/src/components/*`
- Source for migration: `apps/web/src/pages/admin/AdminApp.jsx`, `LeadsDashboard.jsx`, `OnboardingRun.jsx`, `TransferScript.jsx`, `ImportIssues.jsx`, `ImportIssueDetail.jsx`, `GuidePage.jsx`, `CouponsPage.jsx`, `PricingConfigPage.jsx`, `TestimonialManagementPage.jsx`, `EmailModal.jsx`, `ActionsDropdown.jsx`
- Modify: `apps/web/src/App.jsx` to remove admin route wiring

**Interfaces:**
- Produces: dedicated admin app at `apps/admin`
- Consumes: `/auth/me`, `/auth/logout`, `/admin/*`

- [ ] **Step 1: Write a failing admin bootstrap test**

Cover:
- unauthenticated admin users see the login screen
- authenticated non-admin users are rejected
- authenticated admins land on `/admin/leads`

- [ ] **Step 2: Copy the current admin UI into `apps/admin`**

Move the actual working admin surface out of `apps/web/src/pages/admin/*`. Keep file moves small and mechanical first; functional changes come after bootstrapping.

- [ ] **Step 3: Replace admin Firebase bootstrap**

Delete `initAdminFirebase()` behavior. Use the new admin API client and session bootstrap instead.

- [ ] **Step 4: Repoint each admin page to REST**

Replace Firestore/callable usage in:
- `LeadsDashboard`
- `CouponsPage`
- `PricingConfigPage`
- `OnboardingRun`
- `ImportIssues`
- `ImportIssueDetail`
- `TestimonialManagementPage`
- `TransferScript`
- email action helpers

- [ ] **Step 5: Remove admin routes from `apps/web`**

After `apps/admin` builds and runs, remove the lazy `/admin` route and any admin-only imports from the user app.

- [ ] **Step 6: Run admin tests/lint/build**

Run:
```bash
pnpm --filter @realwise/admin lint
pnpm --filter @realwise/admin build
```

Expected: PASS; no admin runtime code left under `apps/web`.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src apps/web/src/App.jsx
git commit -m "feat(admin): extract admin SPA and migrate pages to API"
```

---

## Task 6: Close backend parity gaps required by the React migration

**Files:**
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Create: `apps/api/src/admin/dto/update-pricing.dto.ts`
- Create: `apps/api/src/admin/dto/create-testimonial.dto.ts`
- Create: `apps/api/src/admin/dto/start-onboarding.dto.ts`
- Create: `apps/api/src/admin/dto/transfer-client.dto.ts`
- Modify as needed: `apps/api/src/storage/*`, `apps/api/src/imports/*`, `apps/api/src/notifications/*`, `apps/api/src/auth/*`

**Interfaces:**
- Produces parity endpoints currently missing from `apps/api`

- [ ] **Step 1: Inventory admin/UI calls that have no API equivalent**

At minimum, the current React admin expects behavior for:
- pricing config read/update
- testimonial CRUD
- onboarding run read/start/logs
- transfer-client execution/status
- admin email actions
- any coupon actions not already covered by CRUD

- [ ] **Step 2: Write failing API tests for the first missing endpoint**

Start with pricing config because the current UI already depends on it and the data model is simple.

- [ ] **Step 3: Add endpoints incrementally**

Recommended order:
1. pricing config
2. testimonials
3. onboarding runs + logs
4. admin email actions
5. transfer client
6. any remaining coupon parity operations

- [ ] **Step 4: Add non-admin frontend helper endpoints if user-app migration needs them**

Examples:
- import issue submission endpoint
- analytics event endpoint
- categorization rule endpoints
- AI quota endpoints

- [ ] **Step 5: Run API tests + build**

Run:
```bash
pnpm --filter @realwise/api test
pnpm --filter @realwise/api build
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin apps/api/src/storage apps/api/src/imports apps/api/src/notifications apps/api/src/auth
git commit -m "feat(api): add frontend parity endpoints for web and admin migration"
```

---

## Task 7: Remove Firebase runtime files, dependencies, and stale docs

**Files:**
- Delete: `apps/web/src/firebase.js`
- Delete: `apps/web/src/lib/sharedFirebase.js`
- Delete: `functions/`
- Delete: `firebase.json`
- Delete: `firestore.rules`
- Delete: `firestore.indexes.json`
- Delete: `storage.rules`
- Delete: `firestore-client.json`
- Modify: `apps/web/package.json`
- Modify: `README.md`
- Modify: deploy/runbook docs that still describe Firebase Hosting/Functions as the active stack

**Interfaces:**
- Produces: repo state aligned with Plans 1-7, no active Firebase runtime path left in the product apps

- [ ] **Step 1: Verify no browser Firebase imports remain**

Run:
```bash
rg -n "firebase/" apps/web/src apps/admin/src
```

Expected: no matches

- [ ] **Step 2: Remove Firebase npm deps from the React apps**

At minimum remove `firebase` from `apps/web/package.json`. Remove any now-unused packages that only existed for Firebase-era flows.

- [ ] **Step 3: Delete runtime files only after builds pass**

Delete the Firebase bootstrap/runtime files and the `functions/` tree after Tasks 2-6 are green.

- [ ] **Step 4: Rewrite docs**

Update `README.md` so it no longer claims:
- tenant Firebase projects are initialized by the browser
- Firestore/Storage/Functions are the active app backend
- `/functions` deploy commands are part of the main runtime

Replace that with the monorepo + API + React apps architecture actually implemented by Plans 1-7.

- [ ] **Step 5: Final verification**

Run:
```bash
pnpm --filter @realwise/web build
pnpm --filter @realwise/admin build
pnpm --filter @realwise/api build
pnpm --filter @realwise/web test
pnpm --filter @realwise/api test
rg -n "firebase/|Firestore|Cloud Functions" README.md apps/web/src apps/admin/src
git diff --check -- docs/superpowers/plans/2026-06-27-plan-7-react-apps-api-migration.md
```

Expected:
- all builds pass
- relevant tests pass
- no stale Firebase runtime imports remain in app code
- doc diff is whitespace-clean

- [ ] **Step 6: Commit**

```bash
git add README.md apps/web/package.json apps/admin/package.json apps/web/src apps/admin/src apps/api/src
git add -A functions firebase.json firestore.rules firestore.indexes.json storage.rules firestore-client.json
git commit -m "chore: remove Firebase runtime after React API migration"
```

