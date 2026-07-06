# Premium Checkout Runtime Contract

This document captures the runtime contract for the premium unlock flow after the free-core refactor.

## API endpoints

- `POST https://api.realwise.com.br/webhooks/stripe`
- `POST https://api.realwise.com.br/webhooks/mercadopago`
- `GET https://api.realwise.com.br/payments/health`

## Provider responsibilities

- Stripe is used for Apple Pay and Google Pay checkout collection.
- Mercado Pago is used for Pix and manual card entry.
- Both providers must end in the same premium entitlement update in `apps/api/src/payments/premium-entitlements.service.ts`.

## Required API secrets

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`

## Shared entitlement result

After a confirmed premium payment, the API must:

- find or create the user by `clientId + email`
- set `users.premium_status = 'active'`
- set `users.premium_access_ends_at = null`
- set `users.premium_purchased_at`
- persist `users.premium_payment_provider`
- persist `users.premium_provider_payment_id`
- write an `approved` row to `purchases`
- send the existing access email once

## Notes for the current rollout

- `apps/web/src/pages/CheckoutRedirect.jsx` now routes users into the premium unlock flow.
- Checkout creation and Mercado Pago processing now go through `apps/api/src/payments/*`.
- The old provider URLs in `public/clients/*.json` are no longer the active checkout path.
