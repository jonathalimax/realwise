# Payment And ImportIssues VPS Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the remaining Firebase-hosted payment and `importIssues` flows onto the VPS-hosted NestJS API so Firebase functions can be retired safely.

**Architecture:** Keep the existing web and admin UIs, but replace Firebase-hosted HTTP/function endpoints with first-party NestJS endpoints under `apps/api`. Recreate the missing side effects explicitly in API services and schedulers instead of implicit Firebase triggers, then cut traffic over behind config changes and verify on VPS before deleting Firebase resources.

**Tech Stack:** Vite React 19, NestJS 10, Drizzle/Postgres, Mercado Pago SDK or REST integration, SMTP mailer, Coolify/VPS deployment, existing cookie-auth API.

## Current Status

- Implemented NestJS payment endpoints:
  - `POST /payments/session`
  - `POST /payments/process`
  - `POST /payments/webhooks/mercadopago`
  - `POST /payments/partial-lead`
- Restored the import issue notification side effect inside `ImportsService.reportIssue()`
- Removed dead frontend client-config payment URL keys and switched the landing checkout to `resolveApiBaseUrl()`
- Added the required API env contract to `apps/api/.env.example` and `docs/plans/artifacts/2026-06-30-payment-vps-env.md`
- Verified locally on June 30, 2026 with:
  - `pnpm --dir apps/api test payments.service.spec.ts`
  - `pnpm --dir apps/api test imports.service.spec.ts`
  - `pnpm --dir apps/api build`
  - `pnpm --dir apps/web build`

## TODO For Final Cutover

1. Deploy the API with `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `EMAIL_FROM`, and `IMPORT_ISSUES_EMAIL_TO`.
2. Repoint the Mercado Pago webhook to `/payments/webhooks/mercadopago` on the VPS.
3. Run one sandbox checkout for card and one pending/Pix flow against production-like infra.
4. Submit one import issue and confirm the support email is received.
5. Observe one release window with no Firebase payment/import traffic.
6. Delete only the replaced Firebase functions:
   - `createPayment`
   - `processPayment`
   - `savePartialLead`
   - `mercadoPagoWebhook`
   - `sendImportIssueEmail`
7. Keep Google OAuth and Google Analytics in Firebase/Google; those are still in use.

---

## Scope Summary

This plan covers the remaining Firebase-backed runtime behavior still visible in this repo:

- Landing checkout bootstrap and payment processing currently configured via `apps/web/public/clients/app.dev.json`
- Partial lead capture from the landing checkout modal
- The missing `importIssues` side effect that used to happen on document creation
- Verification and cutover steps to run on the VPS before deleting Firebase functions

This plan does **not** assume Stripe is still active. It treats Mercado Pago style payment endpoints as the active path unless live Firebase inspection proves otherwise.

## Current Repo Evidence

- Landing checkout still reads remote endpoint URLs from `apps/web/public/clients/app.dev.json`
- The checkout UI still calls `createPayment`, `processPayment`, and `savePartialLead` in `apps/web/landing_page/components/landing/CheckoutModal.jsx`
- Import issue reporting already writes directly to the API in `apps/web/src/services/importIssueService.js` and `apps/api/src/imports/imports.service.ts`
- Scheduled reminders and B3 sync are already on Nest schedulers:
  - `apps/api/src/bill-reminders/bill-reminders.scheduler.ts`
  - `apps/api/src/b3-sync/b3-sync.scheduler.ts`
- Admin email sending already lives in `apps/api/src/notifications/notifications.service.ts`

## Migration Order

1. Replace payment bootstrap endpoint
2. Replace payment processing endpoint
3. Replace partial lead endpoint
4. Recreate missing `importIssues` on-create side effect
5. Cut frontend config over to VPS API URLs
6. Smoke test on VPS
7. Disable Firebase functions
8. Delete Firebase functions after observation window

### Task 1: Inventory The Exact Firebase Surface Before Coding

**Files:**
- Read: `docs/firebase-cleanup-todo.md`
- Read: `apps/web/public/clients/app.dev.json`
- Read: `apps/web/landing_page/components/landing/CheckoutModal.jsx`
- Read: `apps/api/src/imports/imports.service.ts`
- Read: `apps/api/src/notifications/notifications.service.ts`
- Create: `docs/plans/artifacts/2026-06-30-firebase-runtime-inventory.md`

**Step 1: Capture the live function list from Firebase Console**

Record every currently deployed function:

- function name
- trigger type (`https`, `webhook`, `pubsub`, `firestore onCreate`, etc.)
- production project
- last invocation time
- whether the web/admin still calls it

**Step 2: Map each function to one of three buckets**

- Already migrated to Nest
- Needs Nest replacement
- Unknown, needs live traffic/log verification

**Step 3: Save the inventory artifact**

Write the results into `docs/plans/artifacts/2026-06-30-firebase-runtime-inventory.md`.

**Step 4: Commit the artifact**

```bash
git add docs/plans/artifacts/2026-06-30-firebase-runtime-inventory.md
git commit -m "docs: inventory remaining firebase runtime surface"
```

### Task 2: Add API Contract For Payment Bootstrap

**Files:**
- Create: `apps/api/src/payments/payments.controller.ts`
- Create: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/payments.module.ts`
- Create: `apps/api/src/payments/dto/create-payment-session.dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/payments/payments.service.spec.ts`

**Step 1: Write the failing service test**

Test the bootstrap method that receives:

- email
- optional name
- optional whatsapp
- optional coupon code
- optional UTM source

Expected output:

- public payment key
- resolved amount
- any needed payment-init metadata

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --dir apps/api test payments.service.spec.ts
```

Expected: FAIL because payments module/service does not exist yet.

**Step 3: Implement the minimal payment bootstrap service**

The service should:

- validate and normalize coupon code
- read current pricing from `pricing_config`
- read coupon state from `coupons`
- compute the final amount
- return a response compatible with `CheckoutModal.jsx`

**Step 4: Add the public controller endpoint**

Create a public route such as:

- `POST /payments/session`

It must return the same fields the landing page currently expects from Firebase.

**Step 5: Run the test to verify it passes**

Run:

```bash
pnpm --dir apps/api test payments.service.spec.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/payments apps/api/src/app.module.ts
git commit -m "feat(api): add payment session bootstrap endpoint"
```

### Task 3: Add API Contract For Payment Processing

**Files:**
- Modify: `apps/api/src/payments/payments.controller.ts`
- Modify: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/dto/process-payment.dto.ts`
- Create: `apps/api/src/payments/mercadopago.client.ts`
- Test: `apps/api/src/payments/payments.service.spec.ts`

**Step 1: Write the failing tests**

Cover:

- approved payment
- pending/in-process payment
- invalid coupon
- free checkout (`amount === 0`)

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --dir apps/api test payments.service.spec.ts
```

Expected: FAIL with missing processing behavior.

**Step 3: Implement the minimal processing path**

Add a public endpoint such as:

- `POST /payments/process`

The service should:

- validate payload shape
- apply coupon rules consistently with bootstrap
- call Mercado Pago
- persist purchase / pending-payment records in Postgres
- increment coupon usage when appropriate
- trigger purchase/admin emails through `NotificationsService`

**Step 4: Handle free checkouts explicitly**

Do not route free access through Mercado Pago. Create the purchase/access records directly and return the same approved shape the frontend expects.

**Step 5: Run the tests to verify they pass**

Run:

```bash
pnpm --dir apps/api test payments.service.spec.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/payments
git commit -m "feat(api): add payment processing endpoint"
```

### Task 4: Recreate Payment Webhook Handling On VPS

**Files:**
- Modify: `apps/api/src/payments/payments.controller.ts`
- Modify: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/dto/payment-webhook.dto.ts`
- Test: `apps/api/src/payments/payments.service.spec.ts`

**Step 1: Write the failing webhook test**

Cover a confirmed asynchronous payment transition:

- pending -> approved

Expected side effects:

- purchase finalized
- pending payment resolved
- coupon usage updated once
- downstream notification triggered once

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --dir apps/api test payments.service.spec.ts
```

**Step 3: Implement a public webhook endpoint**

Add something like:

- `POST /payments/webhooks/mercadopago`

The handler should:

- verify the provider signature if available
- reconcile the payment state idempotently
- avoid double-applying coupon use counts and emails

**Step 4: Run the test to verify it passes**

Run:

```bash
pnpm --dir apps/api test payments.service.spec.ts
```

**Step 5: Commit**

```bash
git add apps/api/src/payments
git commit -m "feat(api): add payment webhook reconciliation"
```

### Task 5: Move Partial Lead Capture To The API

**Files:**
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Create: `apps/api/src/admin/dto/create-partial-lead.dto.ts`
- Test: `apps/api/src/admin/admin.service.spec.ts`
- Modify: `apps/web/landing_page/components/landing/CheckoutModal.jsx`

**Step 1: Write the failing API test**

Cover:

- creating a new partial lead
- updating an existing partial lead by email
- preserving attribution fields

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --dir apps/api test admin.service.spec.ts
```

**Step 3: Implement a public partial lead endpoint**

Add a public route such as:

- `POST /public/leads/partial`

The service should:

- upsert by email
- capture name / whatsapp / utm source
- mark lifecycle state distinctly from completed purchases

**Step 4: Update the landing checkout modal**

Replace the remote `partialLeadUrl` dependency with the API endpoint.

**Step 5: Run focused tests**

Run:

```bash
pnpm --dir apps/api test admin.service.spec.ts
pnpm --dir apps/web build
```

**Step 6: Commit**

```bash
git add apps/api/src/admin apps/web/landing_page/components/landing/CheckoutModal.jsx
git commit -m "feat: move partial lead capture to api"
```

### Task 6: Recreate The Missing ImportIssues Trigger Side Effect

**Files:**
- Modify: `apps/api/src/imports/imports.service.ts`
- Modify: `apps/api/src/imports/imports.module.ts`
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Test: `apps/api/src/imports/imports.service.spec.ts`

**Step 1: Decide the intended side effect**

Use the Firebase inventory from Task 1 to confirm whether the old `importIssues` trigger:

- sent an email to support
- notified admin users
- both

**Step 2: Write the failing test**

Test that `reportIssue()` performs both:

- DB insert
- notification side effect

**Step 3: Run the test to verify it fails**

Run:

```bash
pnpm --dir apps/api test imports.service.spec.ts
```

**Step 4: Implement the side effect inline**

Do not recreate a document trigger. Make `reportIssue()` explicitly call `NotificationsService` after successful insert.

**Step 5: Run the test to verify it passes**

Run:

```bash
pnpm --dir apps/api test imports.service.spec.ts
```

**Step 6: Commit**

```bash
git add apps/api/src/imports apps/api/src/notifications
git commit -m "feat: restore import issue notification on api write"
```

### Task 7: Cut Frontend Config Over To VPS Endpoints

**Files:**
- Modify: `apps/web/public/clients/app.dev.json`
- Modify: `apps/web/public/clients/app.json`
- Modify: `apps/web/landing_page/components/landing/CheckoutModal.jsx`
- Test: `apps/web/src/config/clientConfig.test.js`

**Step 1: Write the failing frontend test if behavior changes**

If you introduce new config keys or remove old ones, update the config tests first.

**Step 2: Replace Firebase-hosted URLs**

Point config to VPS API routes, for example:

- `https://api.realwise.com.br/payments/session`
- `https://api.realwise.com.br/payments/process`
- `https://api.realwise.com.br/public/leads/partial`

If the modal no longer needs config-based URLs, delete those keys entirely and derive from API base URL centrally.

**Step 3: Run web verification**

Run:

```bash
pnpm --dir apps/web test src/config/clientConfig.test.js
pnpm --dir apps/web build
```

**Step 4: Commit**

```bash
git add apps/web/public/clients apps/web/landing_page/components/landing/CheckoutModal.jsx apps/web/src/config/clientConfig.test.js
git commit -m "chore(web): point payment flows to vps api"
```

### Task 8: Add VPS Runtime Config And Deployment Wiring

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Modify: Coolify service env or deployment docs
- Create: `docs/plans/artifacts/2026-06-30-payment-vps-env.md`

**Step 1: Define required env vars**

Likely include:

- Mercado Pago access token
- Mercado Pago public key
- webhook secret / signature config if supported
- checkout base URL
- support/import issue email targets

**Step 2: Document exact VPS env contract**

Write the values and where they live into `docs/plans/artifacts/2026-06-30-payment-vps-env.md`.

**Step 3: Update repo docs**

Add the new payment env contract to docs the team actually reads.

**Step 4: Commit**

```bash
git add apps/api/.env.example README.md docs/plans/artifacts/2026-06-30-payment-vps-env.md
git commit -m "docs: add vps payment runtime env contract"
```

### Task 9: VPS Smoke Test Before Cutover

**Files:**
- Read: `apps/api/src/main.ts`
- Read: `apps/web/landing_page/components/landing/CheckoutModal.jsx`
- Create: `docs/plans/artifacts/2026-06-30-payment-vps-smoke-test.md`

**Step 1: Create the smoke test script**

Document exact manual/API checks:

- create payment session
- process sandbox card payment
- process Pix / pending path if applicable
- verify purchase row
- verify coupon usage increment
- verify emails
- verify partial lead persistence
- submit import issue
- verify import issue email/notification

**Step 2: Run the smoke test on VPS**

Record real response payloads and row-level verification.

**Step 3: Save the results**

Write them to `docs/plans/artifacts/2026-06-30-payment-vps-smoke-test.md`.

**Step 4: Commit**

```bash
git add docs/plans/artifacts/2026-06-30-payment-vps-smoke-test.md
git commit -m "docs: record vps payment smoke test"
```

### Task 10: Cutover And Firebase Retirement

**Files:**
- Read: `docs/firebase-cleanup-todo.md`
- Update: `docs/firebase-cleanup-todo.md`
- Create: `docs/plans/artifacts/2026-06-30-firebase-retirement-checklist.md`

**Step 1: Disable traffic to Firebase functions**

Change config so production no longer points at Firebase-hosted payment endpoints.

**Step 2: Observe for one release window**

Watch:

- VPS API logs
- payment provider webhooks
- admin leads/purchases rows
- import issue notifications

**Step 3: Delete Firebase functions only after clean observation**

Delete only the functions confirmed replaced:

- payment bootstrap
- payment process
- partial lead capture
- any import-issue notification trigger

**Step 4: Preserve rollback notes**

Record exactly how to roll back endpoint configuration if the VPS cutover fails.

**Step 5: Commit**

```bash
git add docs/firebase-cleanup-todo.md docs/plans/artifacts/2026-06-30-firebase-retirement-checklist.md
git commit -m "docs: finalize firebase payment retirement checklist"
```

## Verification Checklist

Before claiming the migration complete, run at minimum:

```bash
pnpm --dir apps/api test
pnpm --dir apps/api build
pnpm --dir apps/web test
pnpm --dir apps/web build
```

If full lint is still noisy, run focused lint on touched files and state any residual repo-wide lint debt explicitly.

## Risks To Watch

- Double-charging or double-finalizing payments during webhook retries
- Coupon usage increments happening twice
- Divergence between bootstrap price calculation and process-time validation
- Free-checkout path bypassing lead/purchase bookkeeping
- Import issue reports being stored without any notification side effect
- Production config still pointing to Firebase after VPS deployment

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
