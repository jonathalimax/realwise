# Firebase Runtime Inventory

Date: 2026-06-30
Worktree: `payment-importissues-vps-migration`
Source of truth:

- Live production function list from `firebase functions:list --project moneywise-ad9ec --json`
- Repo inspection under `apps/api` and `apps/web`

Notes:

- Production inventory was available through Firebase CLI.
- `realwise-dev` returned `{"status":"error","error":"Failed to list functions for realwise-dev"}`.
- Last invocation timestamps were not available from the CLI command used here, so those remain unresolved and should be checked in the Firebase Console before deletion.

## Production Functions

| Function | Trigger | Status | Repo replacement state | Action |
|---|---|---:|---|---|
| `abandonedCheckoutReminders` | schedule | ACTIVE | Partial. API has admin-triggered abandoned checkout email sending, but no Nest scheduler for the automated recovery sequence. | Keep until migrated |
| `activateCoupon` | callable | ACTIVE | No direct Nest replacement found. | Unknown |
| `checkPaymentStatus` | https | ACTIVE | No Nest replacement found. | Keep until payment migration covers pending-status polling |
| `createPayment` | https | ACTIVE | No Nest replacement found. Frontend still expects this shape. | Keep until migrated |
| `deactivateAllCoupons` | callable | ACTIVE | No direct Nest replacement found. | Unknown |
| `deleteCoupon` | callable | ACTIVE | Nest admin API can delete coupons. | Candidate for retirement after admin UI confirmation |
| `getCustomToken` | callable | ACTIVE | No Nest replacement. Old Firebase auth flow, likely legacy but still deployed. | Unknown, verify no callers |
| `listCoupons` | callable | ACTIVE | Nest admin API provides coupon listing. | Candidate for retirement after admin UI confirmation |
| `mercadoPagoWebhook` | https | ACTIVE | No Nest replacement found. | Keep until migrated |
| `onNewLead` | firestore.create | ACTIVE | No direct Nest event replacement found. | Unknown, inspect side effect before deletion |
| `onTransactionReviewed` | firestore.update | ACTIVE | No direct Nest trigger replacement found. | Unknown |
| `onboardUser` | callable | ACTIVE | No Nest replacement found. | Unknown |
| `processImport` | storage.finalize | ACTIVE | Nest now processes imports via direct upload + parse flow, not Storage finalize. | Candidate for retirement after storage/import flow verification |
| `processPayment` | https | ACTIVE | No Nest replacement found. Frontend still expects this shape. | Keep until migrated |
| `savePartialLead` | https | ACTIVE | No Nest replacement yet. | Keep until migrated |
| `scheduledBillReminders` | schedule | ACTIVE | Replaced by Nest scheduler in `apps/api/src/bill-reminders/bill-reminders.scheduler.ts`. | Candidate for retirement |
| `sendAbandonedCheckoutEmail` | callable | ACTIVE | Replaced by Nest admin email endpoint for manual sends only. | Partial |
| `sendAdminEmail` | callable | ACTIVE | Replaced by Nest admin API + `NotificationsService`. | Candidate for retirement |
| `sendImportIssueEmail` | firestore.create | ACTIVE | Not yet recreated. Nest stores `importIssues`, but no automatic side effect exists. | Keep until migrated |
| `setCoupon` | callable | ACTIVE | Nest admin API can create/update coupons. | Candidate for retirement after admin UI confirmation |
| `submitImportIssue` | callable | ACTIVE | Replaced by Nest `/imports/report-issue`. | Candidate for retirement |
| `syncB3Investments` | schedule | ACTIVE | Replaced by Nest scheduler in `apps/api/src/b3-sync/b3-sync.scheduler.ts`. | Candidate for retirement |
| `syncB3InvestmentsCallable` | callable | ACTIVE | Replaced by Nest route in `apps/api/src/investments/investments.controller.ts`. | Candidate for retirement |
| `transferClient` | callable | ACTIVE | No Nest replacement found. | Unknown |
| `updateLeadState` | callable | ACTIVE | Replaced by Nest admin API lead update route. | Candidate for retirement after admin UI confirmation |
| `updatePricingConfig` | callable | ACTIVE | Replaced by Nest admin API pricing config route. | Candidate for retirement |

## Functions Still On The Critical Path For This Migration

These are the blockers for moving payment and `importIssues` fully to the VPS:

1. `createPayment`
2. `processPayment`
3. `mercadoPagoWebhook`
4. `checkPaymentStatus`
5. `savePartialLead`
6. `sendImportIssueEmail`

## Repo Evidence For Replacement Decisions

### Already migrated to Nest

- Bill reminder scheduler:
  - `apps/api/src/bill-reminders/bill-reminders.scheduler.ts`
- B3 sync scheduler:
  - `apps/api/src/b3-sync/b3-sync.scheduler.ts`
- Coupon/admin operations:
  - `apps/api/src/admin/admin.controller.ts`
  - `apps/api/src/admin/admin.service.ts`
- Import issue submission write path:
  - `apps/api/src/imports/imports.controller.ts`
  - `apps/api/src/imports/imports.service.ts`
- Manual admin email sending:
  - `apps/api/src/notifications/notifications.service.ts`

### Not yet migrated in repo

- Payment bootstrap and processing endpoints
- Mercado Pago webhook reconciliation
- Pending-payment status polling
- Partial lead capture
- Automatic `importIssues` notification side effect

## Immediate Recommendations

1. Migrate payment endpoints and webhook handling first.
2. Recreate the `sendImportIssueEmail` side effect explicitly inside the Nest import-report flow.
3. Only retire Firebase schedules/callables that already have a verified Nest caller replacement.
4. Leave unknown legacy functions alone until frontend/admin call sites and console usage are explicitly checked.
