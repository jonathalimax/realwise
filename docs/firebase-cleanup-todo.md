# Firebase Cleanup TODO

Repo cleanup removed the frontend Firebase bootstrap artifacts that were no longer used by the app runtime. The items below still need a manual decision or console-side cleanup.

## Keep for now

- Google OAuth credentials used by the NestJS API
- Google Analytics property / measurement IDs
- Firebase project access itself until the post-cutover observation window is complete and rollback is no longer needed

## Verify before deleting in Firebase Console

- Confirm the VPS deployment is live with `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `EMAIL_FROM`, and `IMPORT_ISSUES_EMAIL_TO`
- Confirm production checkout now hits:
  - `POST /payments/session`
  - `POST /payments/process`
  - `POST /payments/partial-lead`
- Confirm Mercado Pago webhooks now land on `POST /payments/webhooks/mercadopago`
- Confirm whether any scheduled email or recovery jobs are still enabled in the shared Firebase project
- Confirm whether historical Firestore data is still needed for rollback, audit, or one-off migration reruns

## Likely safe to remove after verification

- Firebase functions replaced by the NestJS API:
  - `createPayment`
  - `processPayment`
  - `savePartialLead`
  - `mercadoPagoWebhook`
  - `sendImportIssueEmail`
- Old per-tenant Firebase projects that only existed for pre-migration tenant data
- Unused Firebase Hosting sites
- Old Auth providers, Firestore databases, Storage buckets, and scheduled jobs attached only to those retired tenant projects

## Follow-up code work if you want Firebase at zero

- Remove the `clientId` URL dependency from frontend routing if you no longer want tenant-shaped URLs
- Audit callable Firebase functions still not migrated:
  - `submitImportIssue`
  - `sendAdminEmail`
  - coupon admin helpers
  - onboarding/migration helpers
