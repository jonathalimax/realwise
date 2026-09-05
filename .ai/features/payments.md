# Feature: Payments and Premium

## Purpose

Handle checkout, payment webhooks, coupons/pricing, and premium entitlement updates.

## Providers

- Stripe.
- Mercado Pago.

## Current contract

- Payment provider webhook handling lives in `apps/api`.
- Premium unlock path converges inside API payment modules so both providers update entitlement consistently.
- Legacy Firebase-hosted checkout endpoints may still be referenced by runtime client config until fully migrated.

## Security requirements

- Verify webhook signatures/secrets.
- Do not trust client-side payment state for entitlement.
- Keep provider secrets server-side only.

## Agent notes

Payment changes require careful API tests/manual validation and deployment notes for required env vars.
