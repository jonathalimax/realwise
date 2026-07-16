# Coupon System — Design Specification

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

Extend the existing `CouponsPanel.jsx` (which generates Stripe discount links) with a complete coupon management system:

1. **Full Firestore coupon document** with `enabled`, `currentUses`, `validFrom/Until`, `discountType`, and `discountValue` fields.
2. **Admin UI** at `/admin/coupons` — filterable, sortable table with create/edit/toggle/delete actions.
3. **Stripe integration** in `createCheckoutSession` — accept optional `couponCode`, validate against Firestore, apply discount.

---

## Context — Existing State

`CouponsPanel.jsx` currently calls `createStandaloneCoupon` Cloud Function which creates a Stripe coupon and returns a pre-filled checkout URL. It also reads from a `coupons` collection in Firestore. The 2026-05-13 email spec added a `source: "abandoned_checkout"` field to this collection for auto-generated coupons.

This spec **extends** the existing data model — it does not replace it.

---

## 1. Data Model

### Firestore `coupons/{couponId}` (Shared project: `moneywise-ad9ec`)

```
code              string    — unique, uppercase, e.g. "BEMVINDO50"
discountType      "percentage" | "fixed_amount"
discountValue     number    — e.g. 50 for 50% | 5000 for R$50,00 in centavos
maxUses           number | null   — null = unlimited
currentUses       number    — default 0, incremented on successful payment
enabled           boolean   — toggle on/off without deleting
validFrom         timestamp | null
validUntil        timestamp | null
createdAt         timestamp
createdBy         string    — admin email or "system" for auto-generated
source            "admin" | "abandoned_checkout" | "discount_link"
                            — "admin": created via admin UI (this spec)
                            — "abandoned_checkout": auto-created by email sequence
                            — "discount_link": created by existing createStandaloneCoupon flow
stripeCouponId    string | null  — Stripe coupon ID, if a Stripe coupon was created
stripePromoCodeId string | null  — Stripe promotion code ID, if used
```

### Derived fields (not stored, computed in UI)

- `status`: `"expired"` if `validUntil < now`; `"disabled"` if `enabled === false`; `"active"` otherwise.
- `usageDisplay`: `"${currentUses} / ${maxUses ?? '∞'}"`.

---

## 2. Admin UI — `/admin/coupons`

### Route

Add `/admin/coupons` to `AdminApp.jsx`. The existing `CouponsPanel.jsx` at its current route (likely `/admin/discount` or similar) is **kept as-is** for creating Stripe discount links. The new `/admin/coupons` page is a management view.

### Page: `src/pages/admin/CouponsPage.jsx` (new)

**Layout:**
```
[+ Criar Cupom] button (top right)

Filters row:
  Status: [Todos | Ativo | Desabilitado | Expirado]
  Tipo: [Todos | Percentual | Valor fixo]

Table columns:
  Código | Desconto | Usos | Status | Válido de | Válido até | Criado em | Ações
```

**Table rows:**
- **Código:** monospace badge with the coupon code.
- **Desconto:** `"50%"` or `"R$ 50,00"`.
- **Usos:** `"3 / 10"` or `"3 / ∞"`.
- **Status:** colored badge — `"Ativo"` (green), `"Desabilitado"` (gray), `"Expirado"` (red).
- **Válido de / até:** formatted dates or `"—"` if null.
- **Criado em:** date.
- **Ações:** three-dot dropdown or inline buttons: **Editar**, **Toggle** (enable/disable), **Excluir**.

**Sorting:** clickable column headers on Código (alphabetical), Usos (count), Criado em (default desc).
**Filtering:** client-side filter on the `status` derived field and `discountType`.

### Modal: `CreateEditCouponModal` (new, inline in CouponsPage.jsx or separate file)

Fields:
- Código (text, uppercased on change, required)
- Tipo de desconto (select: Percentual / Valor fixo)
- Valor (number input — percentage 1-100, or R$ amount)
- Máximo de usos (number, empty = unlimited)
- Válido de (date picker, optional)
- Válido até (date picker, optional)
- Habilitado (toggle, default true)

On save (create): writes directly to Firestore `coupons` collection via client SDK. Does NOT call `createStandaloneCoupon` — this modal manages the Firestore record only. Stripe coupon creation happens lazily at checkout time (see section 3).

On save (edit): `updateDoc` with changed fields.

On delete: soft delete (`enabled: false`) with a confirmation dialog. Hard delete is not exposed in the UI to preserve audit trail.

### Toggle action

Inline toggle in the table row: `updateDoc(couponRef, { enabled: !current.enabled })`. Immediate optimistic update in the list.

---

## 3. Stripe Integration in `createCheckoutSession`

### Changes to `functions/createCheckoutSession.js`

Accept an optional `couponCode` parameter in the callable function input:

```js
const { priceId, email, name, couponCode } = data;
```

**Validation (when `couponCode` is present):**
1. Query `coupons` collection: `where('code', '==', couponCode.toUpperCase())`.
2. Check: document exists, `enabled === true`, `currentUses < maxUses` (or `maxUses === null`), `validFrom <= now <= validUntil` (or null bounds).
3. If invalid → throw `HttpsError('invalid-argument', 'Cupom inválido ou expirado')`.

**Applying the discount:**

Use Stripe's `discounts` parameter on the checkout session:

```js
// Create or reuse a Stripe coupon
let stripeCouponId = couponDoc.stripeCouponId;
if (!stripeCouponId) {
  const stripeCoupon = await stripe.coupons.create({
    id: `rw_${couponDoc.id}`,
    ...(couponDoc.discountType === 'percentage'
      ? { percent_off: couponDoc.discountValue }
      : { amount_off: couponDoc.discountValue, currency: 'brl' }),
    duration: 'once',
  });
  stripeCouponId = stripeCoupon.id;
  // Cache the Stripe coupon ID back to Firestore
  await updateDoc(couponRef, { stripeCouponId });
}

// Apply to checkout session
const session = await stripe.checkout.sessions.create({
  // ... existing params
  discounts: [{ coupon: stripeCouponId }],
});
```

**On successful payment** (`stripeWebhook`, `checkout.session.completed` event): increment `currentUses` on the Firestore coupon document:
```js
await updateDoc(couponRef, { currentUses: increment(1) });
```

---

## 4. Dark Mode

All new UI components (`CouponsPage.jsx`, `CreateEditCouponModal`) must follow the Realwise dark mode pattern. Use existing modals (`DiscountModal.jsx`, `EmailModal.jsx`) as reference for correct `dark:` class patterns.

---

## Decisions

1. **The existing `CouponsPanel.jsx` (discount link generator) is kept unchanged.** The new `/admin/coupons` page is a separate management view.
2. **Stripe coupon objects are created lazily** (first time a code is used at checkout), not on admin creation. This avoids creating Stripe objects for codes that may never be used.
3. **Coupon codes are case-insensitive** — always normalized to uppercase in Firestore and in the validation query.
4. **No hard delete** in the admin UI — toggle `enabled: false` instead. Preserves usage history.
5. **`currentUses` is incremented on Stripe payment success**, not on checkout session creation (because sessions may be abandoned).

---

## Out of Scope

- Customer-facing coupon entry field on the landing/checkout page (handled in the deep-link spec).
- Coupon analytics / usage charts.
- Bulk coupon creation.
- Coupon redemption history per user.
