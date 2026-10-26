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
