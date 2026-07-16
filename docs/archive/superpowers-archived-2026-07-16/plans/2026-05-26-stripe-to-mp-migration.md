# Stripe → Mercado Pago Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Stripe integrations and replace them with Mercado Pago, including rewriting the admin discount link generator to use MP Preferences.

**Architecture:** Delete all Stripe-specific function files, strip the two Stripe exports from `functions/index.js`, and replace the existing `createDiscountLink` inline function (currently returning a pre-filled landing page URL) with one that creates an MP Preference and returns `init_point`. The `mercadoPagoWebhook` already handles payment approval and calls `grantAccessAndNotify` (which sends the welcome email), so no webhook changes are needed.

**Tech Stack:** Firebase Cloud Functions v1 (Node 18), Mercado Pago Node SDK (`mercadopago` npm package — `Preference` class), Firestore.

---

### Task 1: Delete Stripe-only files

**Files:**
- Delete: `functions/stripeWebhook.js`
- Delete: `functions/createCheckoutSession.js`
- Delete: `functions/createDiscountCheckout.js`
- Delete: `functions/syncCouponToStripe.js`
- Delete: `functions/createStandaloneCoupon.js`

- [ ] **Step 1: Delete the five Stripe-only files**

```bash
rm functions/stripeWebhook.js \
   functions/createCheckoutSession.js \
   functions/createDiscountCheckout.js \
   functions/syncCouponToStripe.js \
   functions/createStandaloneCoupon.js
```

Expected: no output, exit code 0.

- [ ] **Step 2: Confirm deletions**

```bash
ls functions/stripe* functions/createCheckout* functions/createDiscount* functions/syncCoupon* functions/createStandalone* 2>&1
```

Expected: `ls: cannot access ...` errors for all five paths — none of them should exist.

- [ ] **Step 3: Commit**

```bash
rtk git add -A && rtk git commit -m "chore: delete Stripe-only function files"
```

---

### Task 2: Clean up `functions/index.js` — remove Stripe exports and rewrite `createDiscountLink`

**Files:**
- Modify: `functions/index.js`

The current `index.js` has three things to fix:
1. A `// STRIPE PAYMENT FUNCTIONS` section (lines ~845–853) that imports and exports `createCheckoutSession` and `stripeWebhook` — **remove it entirely**.
2. An `exports.createDiscountCheckout` and `exports.createStandaloneCoupon` block (lines ~876–880) — **remove both**.
3. The existing `exports.createDiscountLink` inline function (lines ~882–923) that creates a Firestore coupon and returns a pre-filled landing page URL — **replace** with a version that creates an MP Preference.
4. The `syncCouponToStripe` require+export (lines ~925–926) — **remove it**.

- [ ] **Step 1: Remove the STRIPE PAYMENT FUNCTIONS section**

In `functions/index.js`, find and delete this block (around lines 845–853):

```js
// ============================================================
// STRIPE PAYMENT FUNCTIONS
// ============================================================

const { createCheckoutSession } = require('./createCheckoutSession');
exports.createCheckoutSession = createCheckoutSession;

const { stripeWebhook } = require('./stripeWebhook');
exports.stripeWebhook = stripeWebhook;
```

Delete those 8 lines entirely.

- [ ] **Step 2: Remove createDiscountCheckout, createStandaloneCoupon exports**

Find and delete these two blocks (around lines 876–880):

```js
const { createDiscountCheckout } = require('./createDiscountCheckout');
exports.createDiscountCheckout = createDiscountCheckout;

const { createStandaloneCoupon } = require('./createStandaloneCoupon');
exports.createStandaloneCoupon = createStandaloneCoupon;
```

- [ ] **Step 3: Replace the inline createDiscountLink with MP Preference version**

Find the entire existing `exports.createDiscountLink = functions.https.onCall(async (data, context) => { ... });` block (lines ~882–923) and replace it with:

```js
exports.createDiscountLink = functions
  .runWith({ secrets: [mpAccessTokenSecret] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    const callerEmail = context.auth.token.email;
    const adminDoc = await db.collection('admins').doc(callerEmail).get();
    if (!adminDoc.exists) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

    const { email, discountPct } = data;
    if (!email || typeof discountPct !== 'number' || discountPct < 1 || discountPct > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'email and discountPct (1-100) required');
    }

    const emailLower = email.toLowerCase().trim();
    const amount = parseFloat((BASE_AMOUNT * (1 - discountPct / 100)).toFixed(2));

    // Upsert lead so it exists in Firestore for the admin dashboard
    await db.collection('leads').doc(emailLower).set(
      { email: emailLower, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    const mpClient = getMercadoPagoClient();
    const preference = new Preference(mpClient);

    const prefResult = await preference.create({
      body: {
        items: [{
          title: 'Realwise — Acesso Vitalício',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount,
        }],
        payer: { email: emailLower },
        external_reference: JSON.stringify({
          email: emailLower,
          name: '',
          couponCode: null,
          discountPct,
        }),
        back_urls: {
          success: 'https://realwise.com.br/purchase-success',
          failure: 'https://realwise.com.br/',
          pending: 'https://realwise.com.br/purchase-success',
        },
        auto_return: 'approved',
        statement_descriptor: 'REALWISE',
      },
    });

    return { url: prefResult.init_point };
  });
```

- [ ] **Step 4: Remove syncCouponToStripe export**

Find and delete:

```js
const { syncCouponToStripe } = require('./syncCouponToStripe');
exports.syncCouponToStripe = syncCouponToStripe;
```

- [ ] **Step 5: Verify no remaining Stripe references in index.js**

```bash
grep -n "stripe\|Stripe\|STRIPE" functions/index.js
```

Expected: zero output.

- [ ] **Step 6: Verify no broken requires (files exist)**

```bash
node -e "require('./functions/index.js')" 2>&1 | head -20
```

Expected: Either no output or Firebase Admin SDK warnings — no `MODULE_NOT_FOUND` errors.

- [ ] **Step 7: Commit**

```bash
rtk git add functions/index.js && rtk git commit -m "feat: replace Stripe with Mercado Pago — remove Stripe exports, rewrite createDiscountLink to MP Preference"
```

---

### Task 3: Deploy and smoke-test

**Files:** none changed — deploy only.

- [ ] **Step 1: Deploy affected functions**

```bash
firebase deploy --only functions:createDiscountLink
```

Expected output ends with `✔  Deploy complete!`

- [ ] **Step 2: Deploy full functions to remove Stripe endpoints from Firebase**

```bash
firebase deploy --only functions
```

This removes `createCheckoutSession`, `stripeWebhook`, `createDiscountCheckout`, `createStandaloneCoupon`, `syncCouponToStripe` from Firebase's function registry.

Expected output ends with `✔  Deploy complete!`

- [ ] **Step 3: Smoke-test createDiscountLink from the admin UI**

1. Open the admin panel → find any lead → click "Discount Link"
2. Set a discount percentage (e.g. 20%)
3. Click "Gerar Link"
4. Confirm the returned URL begins with `https://www.mercadopago.com.br/` (MP hosted checkout `init_point`)
5. Confirm the displayed price matches `R$ 383,90` for 20% off R$ 479,88

- [ ] **Step 4: Confirm Stripe functions are gone from Firebase console**

```bash
firebase functions:list 2>&1 | grep -i stripe
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
rtk git commit --allow-empty -m "chore: Stripe removal complete — all payment flows now on Mercado Pago"
```
