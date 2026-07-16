# Design: Mercado Pago as Primary Checkout

**Date:** 2026-05-19
**Status:** Approved

## Context

Stripe does not support credit card installments (parcelamento) in Brazil. The existing Mercado Pago integration is already partially built (`createPayment`, `processPayment`, `mercadoPagoWebhook` in `functions/index.js`) but is not the primary checkout path. This spec covers switching MP to primary, enabling Pix, Boleto, and native 2x–12x installments without custom recurring charge logic.

## Goals

- Customers can pay via Pix, Boleto, or Credit Card with 2x–12x installments (sem juros)
- Payment form is embedded in our branded CheckoutModal (no redirect to hosted checkout)
- Coupon discounts apply to the MP transaction amount
- Access is granted immediately on card approval, or on async webhook for Pix/Boleto
- Stripe kept only for `createDiscountCheckout` (admin discount links to leads)

## Product price

R$479,88 (4798 in MP centavos = `479.88` float)

Installment amounts (sem juros):
- 2x → R$239,94
- 3x → R$159,96
- 6x → R$79,98
- 12x → R$39,99

## User Flow

1. User clicks "Comprar" → CheckoutModal opens
2. **Step 1** (unchanged): name, email, WhatsApp collected
3. **Step 2** (new): MP Bricks payment form renders embedded in the modal
   - Card tab: shows installment selector (1x à vista, 2x, 3x, 6x, 12x sem juros)
   - Pix tab: shows QR code inline after confirmation
   - Boleto tab: generates boleto link
4. User completes payment in the modal — no redirect to Stripe
5. On card `approved`: access granted immediately, purchase email sent
6. On Pix/Boleto: pending state shown; `mercadoPagoWebhook` grants access on `approved`

## Architecture

### Frontend — `CheckoutModal`

- After Step 1 (contact fields), renders a Step 2 with MP Bricks (`@mercadopago/sdk-react` or vanilla JS SDK)
- MP Bricks receives `publicKey` from `createPayment` response
- On payment submission, calls `processPayment` with `{ token, installments, payment_method_id, transaction_amount, payer, email, name, couponCode }`
- Handles response: show success state or error inline

### Backend — existing functions (updated)

**`createPayment`** (updated):
- Accepts `couponCode` → validates against Firestore `coupons` collection
- Returns `{ publicKey, discountedAmount }` so frontend passes correct `transaction_amount` to MP Bricks
- Saves lead to `leads` collection (mirrors current Stripe behavior)
- Increments `landing_stats.checkout_started`

**`processPayment`** (updated):
- Already accepts `installments` — no change needed for installment logic
- Calls `grantAccessAndNotify` on `approved` (already implemented)
- Updates `pending_payments` doc with final status

**`mercadoPagoWebhook`** (existing):
- Already handles async `payment` notifications
- Calls `grantAccessAndNotify` on `approved` — covers Pix/Boleto async approval

### Coupon logic

- `createPayment` validates the coupon (enabled, not expired, within maxUses)
- Applies discount to base amount: `discountedAmount = baseAmount * (1 - discountPct/100)` or `baseAmount - fixedDiscount`
- Returns `discountedAmount` to frontend
- Frontend passes `discountedAmount` as `transaction_amount` to MP Bricks and `processPayment`
- On payment success, increments `coupon.currentUses`

### Abandoned checkout emails

- `buildCheckoutUrl` in `emailTemplates.js` currently builds a `/checkout?email=...&coupon=...` URL pointing at the Stripe `CheckoutRedirect` page
- Update to point at the landing page checkout modal with pre-filled email/coupon params that auto-open Step 2

## Data model

No new Firestore collections needed. Existing collections cover the flow:

| Collection | Role |
|---|---|
| `leads` | Upserted on `createPayment` (checkout started) |
| `pending_payments` | Created on `createPayment`, updated on `processPayment` |
| `purchases` | Created on payment approval (existing `grantAccessAndNotify`) |
| `coupons` | Validated and incremented on approval |
| `landing_stats` | `checkout_started` incremented on `createPayment` |

## What changes vs current

| File | Change |
|---|---|
| `landing_page/components/landing/CheckoutModal.jsx` | Add Step 2 with MP Bricks |
| `functions/index.js` → `createPayment` | Add coupon validation + lead upsert + landing_stats |
| `functions/index.js` → `processPayment` | Increment coupon uses on approval |
| `functions/emailTemplates.js` → `buildCheckoutUrl` | Point at MP modal flow instead of Stripe redirect |
| `src/pages/CheckoutRedirect.jsx` | Keep as fallback or deprecate |

## What stays on Stripe

- `createDiscountCheckout` — admin sends personal discount links to cold leads. Migrate separately.
- `createCheckoutSession` — can be deprecated once MP is live and validated

## Error handling

- MP Bricks handles card validation inline (no server round-trip for format errors)
- `processPayment` returns `{ status, status_detail }` — frontend shows MP's status_detail message
- Pix/Boleto timeout: MP webhook sends `cancelled` after expiry; no action needed (access not granted)
- Failed card charge: shown inline in Bricks, customer retries with different card
- Coupon invalid: `createPayment` returns 400 with error message shown in modal

## Out of scope

- Refund handling
- Installment tracking (we charge full amount upfront to MP — MP handles installment display to customer on their statement)
- Stripe removal (kept for discount links)
