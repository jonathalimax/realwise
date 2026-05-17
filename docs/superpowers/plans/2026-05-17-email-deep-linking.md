# Email Deep Linking & Checkout Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/checkout` deep-link page that reads URL params and redirects directly to Stripe Checkout, audit all email template CTAs to point to correct destinations, and fix coupon code validation in the checkout flow.

**Architecture:** New `CheckoutRedirect.jsx` rendered outside the clientId-aware router. It reads `coupon`, `email`, `name` from URL params, calls `createCheckoutSession`, and redirects to Stripe. All email templates audited and updated. Deep-link URL construction moved to Cloud Functions for consistency.

**Tech Stack:** React 19, React Router v7, Firebase Callable Functions, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-05-17-email-deep-linking-design.md`
**Depends on:** Coupon validation in `createCheckoutSession` (from `2026-05-17-coupon-system.md` plan, Task 4).

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `src/pages/CheckoutRedirect.jsx` | Redirect page that calls createCheckoutSession and sends to Stripe |
| Modify | `src/main.jsx` (or `src/App.jsx`) | Detect `/checkout` path before clientId routing and render CheckoutRedirect |
| Modify | `functions/emailTemplates.js` | Audit and fix all CTA URLs |

---

## Task 1: Create `CheckoutRedirect` Component

**Files:**
- Create: `src/pages/CheckoutRedirect.jsx`

- [ ] **Step 1: Find the default Stripe price ID used in the landing page**

```bash
grep -rn "priceId\|price_id\|PRICE_ID" src/ | grep -v "node_modules" | head -20
```

Note the value. It will be hardcoded in the component below.

- [ ] **Step 2: Find how `functions` (shared project) is initialized**

```bash
grep -n "sharedFunctions\|functions.*moneywise\|getFunctions.*shared" src/firebase.js
```

If `sharedFunctions` isn't exported yet, check if `functions` exported from `src/firebase.js` already points to the shared project (the one with `createCheckoutSession`). Use whatever export is correct.

- [ ] **Step 3: Create the component**

```jsx
// src/pages/CheckoutRedirect.jsx
import { useEffect, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Shared project credentials — same as used by the landing page checkout flow.
// Replace with actual values from the existing checkout implementation.
const SHARED_FIREBASE_CONFIG = {
  apiKey: "...",  // get from src/firebase.js or existing landing page checkout code
  authDomain: "moneywise-ad9ec.firebaseapp.com",
  projectId: "moneywise-ad9ec",
};

// Default Stripe price ID — the annual plan
const DEFAULT_PRICE_ID = 'price_...'; // get from existing checkout flow

function getOrInitSharedApp() {
  return getApps().find(a => a.name === 'shared') 
    ?? initializeApp(SHARED_FIREBASE_CONFIG, 'shared');
}

export default function CheckoutRedirect() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  async function redirect(withCoupon = true) {
    const params = new URLSearchParams(window.location.search);
    const coupon = withCoupon ? (params.get('coupon') || undefined) : undefined;
    const email = params.get('email') || undefined;
    const name = params.get('name') || undefined;

    try {
      const app = getOrInitSharedApp();
      const fns = getFunctions(app, 'southamerica-east1'); // adjust region if needed
      const createSession = httpsCallable(fns, 'createCheckoutSession');

      const { data } = await createSession({
        priceId: DEFAULT_PRICE_ID,
        email,
        name,
        couponCode: coupon,
      });

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de checkout não retornada.');
      }
    } catch (err) {
      const msg = err?.message || 'Erro ao iniciar checkout.';

      // If the error is about an invalid coupon, retry without it
      if (withCoupon && (msg.includes('Cupom') || msg.includes('coupon'))) {
        setStatus('loading');
        // Show a brief message then retry
        setErrorMsg('Este cupom não é mais válido. Redirecionando sem desconto...');
        setStatus('error'); // show the message
        setTimeout(() => {
          setErrorMsg('');
          setStatus('loading');
          redirect(false);
        }, 3000);
        return;
      }

      setErrorMsg(msg);
      setStatus('error');
    }
  }

  useEffect(() => {
    redirect(true);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-300 text-sm">Redirecionando para o pagamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">
          {errorMsg || 'Não foi possível iniciar o checkout.'}
        </p>
        <button
          onClick={() => { setStatus('loading'); setErrorMsg(''); redirect(true); }}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          Tentar novamente
        </button>
        <a
          href="https://realwise.com.br"
          className="block mt-3 text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          Voltar ao site
        </a>
      </div>
    </div>
  );
}
```

**Before writing this file:** Read the existing checkout implementation (search in `src/` and `landing_page/`) to get the real `DEFAULT_PRICE_ID` and the correct Firebase Functions region. Replace the placeholder values.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CheckoutRedirect.jsx
git commit -m "feat: CheckoutRedirect page — reads URL params and redirects to Stripe Checkout"
```

---

## Task 2: Wire `/checkout` Route Before clientId Routing

**Files:**
- Modify: `src/main.jsx` (or `src/App.jsx` — wherever the root React render happens)

- [ ] **Step 1: Find the root render entry point**

```bash
grep -rn "createRoot\|ReactDOM.render\|BrowserRouter" src/main.jsx src/App.jsx
```

Note where the root is rendered and how `BrowserRouter` with basename is set up.

- [ ] **Step 2: Add early checkout detection**

In the root render file (likely `src/main.jsx`), add a check before the main app render:

```jsx
import CheckoutRedirect from './pages/CheckoutRedirect';

// Detect /checkout path before routing — it's shared infrastructure, no clientId
if (window.location.pathname === '/checkout') {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <CheckoutRedirect />
    </StrictMode>
  );
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App /> {/* existing app with clientId-based BrowserRouter */}
    </StrictMode>
  );
}
```

This is the simplest approach — it avoids any changes to the existing Router setup.

- [ ] **Step 3: Test locally**

```bash
npm run dev
```

Navigate to `http://localhost:5173/checkout?email=test@example.com&name=Test`. Verify:
- The loading spinner renders.
- A call to `createCheckoutSession` is made (check Network tab).
- On success, the page redirects to the Stripe Checkout URL.
- On error, the error card renders with a retry button.

Navigate to `http://localhost:5173/app/dashboard` — verify the normal app still loads.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat: render CheckoutRedirect for /checkout path before clientId routing"
```

---

## Task 3: Audit and Fix Email Template CTAs

**Files:**
- Modify: `functions/emailTemplates.js`

- [ ] **Step 1: List all template functions and their CTAs**

```bash
grep -n "href\|http\|CTA\|button.*link\|<a " functions/emailTemplates.js | head -40
```

List every `href` value found.

- [ ] **Step 2: Fix `welcomeTemplate` CTA**

Find `welcomeTemplate`. Its CTA should link to `/{clientId}/login`, not the landing page. The function likely already accepts a `loginUrl` parameter. Verify:

```js
// CORRECT:
function welcomeTemplate(name, loginUrl) {
  // CTA href = loginUrl  (e.g. https://realwise.com.br/jonathalimax/login)
}
```

If the `href` currently points to the landing page root or `https://realwise.com.br`, change it to use `loginUrl`.

- [ ] **Step 3: Fix `accessGrantedTemplate` CTA**

This template is sent after onboarding. Its CTA should link directly to `/{clientId}/dashboard`:

```js
// CORRECT:
function accessGrantedTemplate(name, dashboardUrl) {
  // CTA href = dashboardUrl  (e.g. https://realwise.com.br/jonathalimax/dashboard)
}
```

If the function currently accepts a `loginUrl` or landing page URL, rename the param to `dashboardUrl` and update the href. Update the call sites in `functions/index.js` or wherever `accessGrantedTemplate` is called to pass the correct dashboard URL.

- [ ] **Step 4: Verify `acceptMigrationTemplate` CTA**

Find `acceptMigrationTemplate`. The href should point to the actual migration acceptance URL (a Firebase Dynamic Link or similar). If it currently points to the landing page, fix it:

```bash
grep -n "acceptMigration\|transferência\|migration" functions/index.js functions/emailTemplates.js
```

If the migration URL is constructed server-side, verify it's correct. If it points to the landing page, find where the real acceptance URL is stored and use that.

- [ ] **Step 5: Fix or add checkout email templates**

Check if `checkoutReminderTemplate`, `checkoutCouponTemplate`, and `checkoutLastChanceTemplate` exist:

```bash
grep -n "checkoutReminder\|checkoutCoupon\|checkoutLastChance\|Reminder\|Coupon\|LastChance" functions/emailTemplates.js
```

If they exist but their CTA URLs point to the landing page, update them:

```js
// BEFORE (wrong):
href="https://realwise.com.br"

// AFTER (correct) for reminder (no coupon):
href={`https://realwise.com.br/checkout?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`}

// AFTER (correct) for coupon and last-chance:
href={`https://realwise.com.br/checkout?coupon=${encodeURIComponent(couponCode)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`}
```

If the templates don't exist, implement them per the `2026-05-13-email-system-redesign.md` spec using the base template style, with the CTA URLs above.

- [ ] **Step 6: Commit**

```bash
git add functions/emailTemplates.js functions/index.js
git commit -m "fix: audit email template CTAs — deep-link to /checkout and correct app URLs"
```

---

## Task 4: Build `/checkout` URL in Cloud Functions

**Files:**
- Modify: `functions/index.js` or `functions/abandonedCheckout.js`

- [ ] **Step 1: Add a URL builder helper**

In `functions/emailTemplates.js` or a new `functions/urls.js`:

```js
export function buildCheckoutUrl({ email, name, couponCode } = {}) {
  const base = 'https://realwise.com.br/checkout';
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (name) params.set('name', name);
  if (couponCode) params.set('coupon', couponCode);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
```

- [ ] **Step 2: Use `buildCheckoutUrl` in all email-sending functions**

Find every place a checkout or cart URL is constructed for email templates. Replace manual URL construction with `buildCheckoutUrl`:

```bash
grep -rn "realwise.com.br\|cartUrl\|checkoutUrl" functions/
```

For each match where the URL is for a checkout CTA, replace with:
```js
const cartUrl = buildCheckoutUrl({ email: lead.email, name: lead.name, couponCode });
```

- [ ] **Step 3: Commit**

```bash
git add functions/
git commit -m "feat: centralize checkout URL construction in buildCheckoutUrl helper"
```
