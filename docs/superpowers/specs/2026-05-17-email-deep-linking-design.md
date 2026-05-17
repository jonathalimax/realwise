# Email Deep Linking & Checkout Page — Design Specification

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

1. **New `/checkout` page** — lightweight React page that reads URL params, calls `createCheckoutSession`, and redirects to Stripe. No form, no landing page.
2. **Audit all email templates** in `functions/emailTemplates.js` to ensure every CTA links to the correct destination.
3. **Fix coupon code validation** so codes sent via email work at checkout.

---

## 1. `/checkout` Deep-Link Page

### Problem

Admin-sent emails (coupon offers, last-chance emails) currently link to the landing page, forcing users to navigate the full purchase flow again. The coupon code in the email may not carry through to Stripe.

### Solution

A dedicated `/checkout` route that acts as a server-side redirect proxy:

```
https://realwise.com.br/checkout?coupon=BEMVINDO50&email=joao@example.com&name=João
```

### Route Setup

Add a new top-level route in `src/App.jsx`:
```jsx
<Route path="/checkout" element={<CheckoutRedirect />} />
```

This route lives **outside** the `/{clientId}/` basename since it's shared infrastructure. The route is on the root `/checkout` path. Adjust `BrowserRouter` basename handling or use a separate `Routes` at the top level if needed.

### Component: `src/pages/CheckoutRedirect.jsx`

```
On mount:
  1. Read URL params: coupon, email, name (all optional)
  2. Call httpsCallable(sharedFunctions, 'createCheckoutSession')
       with { priceId: DEFAULT_PRICE_ID, email, name, couponCode: coupon }
  3. On success: window.location.href = data.url  (Stripe Checkout URL)
  4. On error: show error state with "Tente novamente" button

UI states:
  - Loading: full-page spinner + "Redirecionando para o pagamento..."
  - Error: centered card with error message + retry button + link back to landing page
```

`DEFAULT_PRICE_ID` is read from a constant (the same Stripe price ID used in the landing page checkout flow). Hard-code it or read from a public env var — it's not a secret.

`sharedFunctions` is the Firebase Functions instance pointing to the `moneywise-ad9ec` project — reuse the existing `functions` export from `src/firebase.js`.

### URL Construction in Email Templates

All admin email CTAs that should go to checkout must use this format:

```
https://realwise.com.br/checkout?coupon={CODE}&email={encodeURIComponent(email)}&name={encodeURIComponent(name)}
```

The `email` and `name` params allow `CheckoutRedirect` to pre-fill the Stripe session so the user lands on a session already associated with their account.

---

## 2. Email Template Audit

### File: `functions/emailTemplates.js`

Every template CTA link must point to the correct destination. Updated mapping:

| Template | CTA Destination | Notes |
|---|---|---|
| `welcomeTemplate` | `https://realwise.com.br/{clientId}/login` | Already set? Verify. Use `loginUrl` param. |
| `accessGrantedTemplate` | `https://realwise.com.br/{clientId}/dashboard` | Direct to dashboard, not login. |
| `acceptMigrationTemplate` | The actual migration acceptance URL | Keep as-is if already correct. |
| `checkoutReminderTemplate` | `https://realwise.com.br/checkout?email={email}&name={name}` | New — abandoned cart reminder |
| `checkoutCouponTemplate` | `https://realwise.com.br/checkout?coupon={code}&email={email}&name={name}` | New — coupon email |
| `checkoutLastChanceTemplate` | `https://realwise.com.br/checkout?coupon={code}&email={email}&name={name}` | New — last chance email |
| `billReminderTemplate` | `https://realwise.com.br/{clientId}/dashboard` | Bills CTA — keep as-is |

**Audit process:**
1. Open each template function.
2. Find every `href` value.
3. Verify it matches the table above. Fix if wrong.
4. Ensure email and name are URL-encoded with `encodeURIComponent`.

### New Templates Required

The 2026-05-13 email spec defined `checkoutReminderTemplate`, `checkoutCouponTemplate`, and `checkoutLastChanceTemplate`. If they don't exist yet in `emailTemplates.js`, implement them per that spec. Their CTA URLs must use the `/checkout` deep-link format above.

---

## 3. Coupon Code Validation Fix

### Problem

Codes sent via email reach the checkout URL as a query param (`?coupon=BEMVINDO50`), but the existing `createCheckoutSession` function may not accept a `couponCode` parameter. The coupon spec (section 3 of `2026-05-17-coupon-system-design.md`) adds this parameter — this spec depends on that work being done first.

### Fix

Once `createCheckoutSession` accepts `couponCode`:

1. `CheckoutRedirect.jsx` reads `coupon` from URL params and passes it as `couponCode` to the callable function.
2. The function validates the code (enabled, not expired, under max uses) and applies the Stripe discount.
3. If validation fails, `CheckoutRedirect` shows: "Este cupom não é mais válido. Você será redirecionado para o checkout sem desconto." and retries without the coupon after 3 seconds.

---

## 4. Admin Email Actions Update

All email-sending actions in `LeadsDashboard.jsx` (coupon email, last-chance email) must construct the CTA URL using the `/checkout` deep-link format before calling the Cloud Function. The `sendAbandonedCheckoutEmail` callable function should accept a pre-built `cartUrl` param (or construct it server-side from the lead's email + name).

Recommended: construct the URL server-side in the Cloud Function so the format is consistent regardless of how the function is called (scheduled, admin trigger, or webhook).

---

## Routing Note

`/checkout` must be accessible without a `/{clientId}` prefix. In the current app architecture, `BrowserRouter` is initialized with `basename="/{clientId}"` in `App.jsx`. The `CheckoutRedirect` component must be rendered by a separate `BrowserRouter` with no basename, or by moving it to a route that loads before the clientId-aware router.

**Simplest approach:** Add a check at the top of the app entry (`src/main.jsx` or `src/App.jsx`) — if `window.location.pathname === '/checkout'`, render `<CheckoutRedirect />` directly, bypassing the clientId routing logic entirely.

---

## Out of Scope

- A/B testing checkout flows.
- Analytics on checkout conversion rate via this page.
- Multi-plan checkout (this page always uses the single default plan).
