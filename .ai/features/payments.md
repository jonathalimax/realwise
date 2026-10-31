# Feature: Payments and Premium

The full contract (access states, API shapes, web/admin behaviour) is in `subscriptions.md`. This file is the short API-side summary.

## Purpose

Stripe-only subscriptions (monthly and annual) with a 3-day no-card trial and a server-side paywall.

## Current contract

- Provider: **Stripe only**. Mercado Pago, the one-time purchase, custom coupons and landing pricing config were removed (the `coupons` and `pricing_config` tables remain, unused). Discounts are Stripe promotion codes.
- `apps/api/src/billing/`: `computeAccess` (pure access state), `SubscriptionGuard` (global, after `JwtAuthGuard`, 402 `SUBSCRIPTION_REQUIRED`), `@AllowWithoutSubscription()`, `BillingController` (`/billing/status|plans|checkout|portal`), `StripeWebhookController` (`POST /webhooks/stripe`).
- Webhook handlers re-fetch the subscription from Stripe and write absolute state onto `users.stripe_*` / `users.subscription_*`; replays and out-of-order events converge. One `purchases` row and one access-granted e-mail per checkout session.
- `POST /payments/partial-lead` (landing leads) stays in `PaymentsModule`.
- Users with the legacy `premium_status = 'active'` and no Stripe subscription are `lifetime`; they cannot start a checkout (409).

## Env vars

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `FRONTEND_BASE_URL`. Configure the Stripe webhook endpoint `/webhooks/stripe` for `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.

## Security requirements

- Webhook signature is always verified against the raw body.
- Entitlement is computed server-side from the DB; client/redirect state is never trusted.
- The guard fails closed (missing user row or DB error never grants access).
- Provider secrets stay server-side only.

## Notas fiscais (NFS-e, Prefeitura de São Paulo)

- Module `apps/api/src/invoicing` (imported by `BillingModule`, never the reverse). Every Stripe `invoice.paid` is registered once in `fiscal_invoices` (unique on `stripe_invoice_id`); `charge.refunded` only flags the row (`refunded_cents`) for the admin, it never cancels a nota by itself.
- Emission goes through a provider adapter (`focusnfe.provider.ts`, Focus NFe REST: POST/GET/DELETE `/v2/nfse/{ref}`, HTTP Basic token). `ref = rw-{h|p}-{row id}` makes retries idempotent. The Prefeitura authorizes asynchronously: `InvoicingScheduler` runs Mon/Wed/Fri 10:00 BRT: emits due `queued` rows (up to 100), then re-checks `processing` ones up to 6 times, 30 s apart. Admin clicks (Emitir / Atualizar) are immediate.
- Status: `review` -> `queued` -> `processing` -> `issued` | `error`; also `canceled`, `skipped`. New rows are `queued` only when settings are `enabled && autoIssue && environment=producao`; otherwise `review` (admin issues by hand). Homologação notas are marked TESTE and can be re-issued in production.
- Settings live in `app_settings.invoicing` (admin: Notas fiscais -> Configuração). The provider token is AES-256-GCM encrypted (`INVOICING_SECRET`, else `JWT_SECRET`) and write-only; `FOCUSNFE_TOKEN` env is the fallback. Tax codes (item LC 116, código de serviço SP, CCM, alíquota) are never defaulted: the admin must fill them in.
- `fiscal_invoices.user_id` has no FK and `AccountDeletionService` unlinks (sets NULL) before its generic erase, so fiscal records survive account deletion (legal retention). The privacy policy says so.
- Stripe webhook must also deliver `charge.refunded` (listed in `REQUIRED_WEBHOOK_EVENTS`).
- Admin API: `/admin/invoicing` (list, stats, settings, settings/check, settings/test-emission, backfill, queue-all, `:id/{issue,refresh,skip,cancel,customer}`).

- Defaults: CCM, ME/EPP regime, Simples on, item 0105 + SP code 02800 (SC SF/DEJUG 15/2024, IN SF/SUREM 08/2011 Anexo 1; not among the codes closed on 31/12/2025). Saving `environment=producao` with `enabled` or `autoIssue` is refused until token, CCM, codes and text are all set.
