# Free Core Premium Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor Realwise from a landing-page checkout product into a free-core app with 45-day premium access, in-app premium gating, and dual-provider checkout routing (Stripe for Apple/Google Pay, Mercado Pago for Pix and manual card entry).

**Architecture:** Add a shared premium entitlement model in `apps/api`, expose that status to the web app through auth/access state, gate premium UI modules and planning-derived guidance in `apps/web`, and replace landing-page checkout CTAs with activation-first entry points. Keep payment providers separate at checkout collection time but converge both into one shared unlock path via a common entitlement service and shared post-payment side effects.

**Tech Stack:** Vite React 19, NestJS 10, Drizzle/Postgres, Mercado Pago, Stripe, SMTP mailer, existing cookie-auth API, Coolify/VPS deployment.

---

## Scope Summary

This plan covers:

- premium entitlement start and expiry behavior
- free vs premium feature gating in the web app
- landing-page messaging and CTA changes
- category-chart and planning-derived guidance split
- in-app payment chooser routing
- Stripe webhook URL refresh and shared unlock handling

This plan does not cover:

- recurring subscriptions
- refunds
- new provider onboarding
- premium analytics/reporting beyond the minimum events needed for rollout verification

## Product Rules To Implement

- Premium Access starts on the first authenticated app session.
- Premium Access lasts 45 days.
- Manual transactions and statement import remain free forever.
- Bills, planning, investments, and planning-derived "remaining to spend" guidance are premium.
- After day 45, premium features lock, but free core features stay available.
- Apple Pay / Google Pay route to Stripe.
- Pix and manual card entry route to Mercado Pago.

## Suggested Task Order

1. Add shared premium entitlement storage and API contract
2. Expose premium status in auth/access responses
3. Gate web routes and premium components
4. Split free category insights from premium planning guidance
5. Replace landing-page checkout-first messaging
6. Add in-app payment chooser and provider routing
7. Refresh Stripe webhook URL and shared unlock flow
8. Verify end-to-end locally and in VPS staging/production

### Task 1: Add Premium Entitlement Persistence

**Files:**
- Create: `apps/api/src/db/migrations/0016_user_premium_access.sql`
- Modify: `apps/api/src/db/migrations/meta/_journal.json`
- Modify: `apps/api/src/db/schema/users.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Step 1: Write the failing schema expectation**

Document the new user fields in the schema test or auth service test expectations:

- `premiumAccessStartedAt`
- `premiumAccessEndsAt`
- `premiumPurchasedAt`
- `premiumStatus`
- `premiumPaymentProvider`
- `premiumProviderPaymentId`

**Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test auth.service.spec.ts`
Expected: FAIL because the new premium entitlement fields do not exist yet.

**Step 3: Add the migration and schema fields**

Implement the new columns on `users` so premium state lives with the authenticated user record.

**Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/api test auth.service.spec.ts`
Expected: PASS with premium fields present in schema-aware flows.

**Step 5: Commit**

```bash
git add apps/api/src/db/migrations/0016_user_premium_access.sql apps/api/src/db/migrations/meta/_journal.json apps/api/src/db/schema/users.ts apps/api/src/db/schema/index.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): add premium entitlement fields to users"
```

### Task 2: Start Premium Access On First Authenticated Use

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`
- Modify: `apps/api/src/auth/interfaces/jwt-payload.interface.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Step 1: Write the failing auth tests**

Cover:

- first successful authenticated user gets `premiumAccessStartedAt = now`
- first successful authenticated user gets `premiumAccessEndsAt = now + 45 days`
- returning users do not get their premium access reset

**Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test auth.service.spec.ts`
Expected: FAIL because first-login premium access start logic does not exist yet.

**Step 3: Add minimal implementation**

Update `findOrCreateUser()` or the first post-auth persistence path to initialize premium access only once.

**Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/api test auth.service.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/auth/interfaces/jwt-payload.interface.ts
git commit -m "feat(api): start premium access on first authenticated use"
```

### Task 3: Expose Premium State To The Web App

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.controller.spec.ts`
- Modify: `apps/web/src/contexts/accessState.js`
- Modify: `apps/web/src/contexts/accessState.test.js`
- Modify: `apps/web/src/contexts/AccessContext.jsx`

**Step 1: Write the failing response/access-state tests**

Cover:

- auth/session response includes premium fields
- `deriveAccessState()` returns:
  - `hasPremiumAccess`
  - `premiumAccessEndsAt`
  - `premiumDaysRemaining`
  - `premiumFeatureLocks`

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm --dir apps/api test auth.controller.spec.ts
pnpm --dir apps/web test accessState.test.js
```

Expected: FAIL because premium state is not returned or derived yet.

**Step 3: Implement the API and frontend access-state contract**

Expose normalized premium status from the API and derive web-facing booleans in `accessState.js`.

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --dir apps/api test auth.controller.spec.ts
pnpm --dir apps/web test accessState.test.js
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.controller.spec.ts apps/web/src/contexts/accessState.js apps/web/src/contexts/accessState.test.js apps/web/src/contexts/AccessContext.jsx
git commit -m "feat(auth): expose premium access state to the web app"
```

### Task 4: Add A Shared Premium Gate UI Primitive

**Files:**
- Create: `apps/web/src/components/premium/PremiumAccessBanner.jsx`
- Create: `apps/web/src/components/premium/PremiumFeatureLock.jsx`
- Create: `apps/web/src/components/premium/PremiumFeatureBadge.jsx`
- Create: `apps/web/src/components/premium/premiumCopy.js`
- Test: `apps/web/src/components/premium/premiumCopy.test.js`

**Step 1: Write failing copy/state tests**

Cover message variants for:

- premium active with days remaining
- premium expired
- free core still available

**Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test premiumCopy.test.js`
Expected: FAIL because the premium UI primitives do not exist yet.

**Step 3: Implement the shared premium components**

Create reusable building blocks so feature pages use one consistent message model.

**Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test premiumCopy.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/premium
git commit -m "feat(web): add shared premium gating components"
```

### Task 5: Gate Premium Routes And Pages

**Files:**
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/pages/Bills.jsx`
- Modify: `apps/web/src/pages/Planning.jsx`
- Modify: `apps/web/src/pages/Investments.jsx`
- Create: `apps/web/src/components/premium/PremiumRouteGate.jsx`
- Test: `apps/web/src/contexts/accessState.test.js`

**Step 1: Write failing route-gating tests**

Cover:

- free users can enter the app normally
- expired premium users cannot actively use premium routes
- premium pages render lock state instead of silently disappearing

**Step 2: Run tests to verify failure**

Run: `pnpm --dir apps/web test accessState.test.js`
Expected: FAIL because route-level premium gating does not exist.

**Step 3: Implement minimal gating**

Use a shared premium gate so locked pages render teaser + paywall instead of blank redirects.

**Step 4: Run tests to verify pass**

Run: `pnpm --dir apps/web test accessState.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/App.jsx apps/web/src/pages/Bills.jsx apps/web/src/pages/Planning.jsx apps/web/src/pages/Investments.jsx apps/web/src/components/premium/PremiumRouteGate.jsx apps/web/src/contexts/accessState.test.js
git commit -m "feat(web): gate premium routes after premium access expires"
```

### Task 6: Split Free Category Insights From Premium Guidance

**Files:**
- Modify: `apps/web/src/components/ExpensesByCategoryCard.jsx`
- Modify: `apps/web/src/components/BudgetCategorySection.jsx`
- Modify: `apps/web/src/pages/Dashboard.jsx`
- Modify: `apps/web/src/pages/Expenses.jsx`
- Test: `apps/web/src/components/premium/premiumCopy.test.js`

**Step 1: Write failing component behavior tests**

Cover:

- free users still see category spend totals
- free users do not see:
  - `livres`
  - `disponíveis`
  - remaining budget
  - over-budget guidance from planning
- premium users still see the current guidance

**Step 2: Run tests to verify failure**

Run: `pnpm --dir apps/web test premiumCopy.test.js`
Expected: FAIL because category guidance is not gated yet.

**Step 3: Implement the split**

Keep "what happened" visible; lock "what is left to spend" behind premium.

**Step 4: Run tests to verify pass**

Run: `pnpm --dir apps/web test premiumCopy.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/ExpensesByCategoryCard.jsx apps/web/src/components/BudgetCategorySection.jsx apps/web/src/pages/Dashboard.jsx apps/web/src/pages/Expenses.jsx apps/web/src/components/premium/premiumCopy.test.js
git commit -m "feat(web): gate planning-derived category guidance behind premium"
```

### Task 7: Replace Landing Checkout-First Flow With Start-Free Messaging

**Files:**
- Modify: `apps/web/landing_page/pages/home.jsx`
- Modify: `apps/web/src/components/landing/HeroSection.jsx`
- Modify: `apps/web/src/components/landing/PricingSection.jsx`
- Modify: `apps/web/src/components/landing/FAQSection.jsx`
- Modify: `apps/web/src/components/landing/FooterSection.jsx`
- Modify: `apps/web/src/components/LanguageToggle.jsx`
- Modify: `apps/web/src/pages/CheckoutRedirect.jsx`

**Step 1: Write the failing expectations**

Document the required behavior:

- primary CTA opens signup/login/start flow instead of checkout
- pricing copy explains free core vs premium
- FAQ no longer says "one-time purchase gives all current features forever"
- `/checkout` redirects into product onboarding or login instead of landing checkout modal

**Step 2: Run build/test to verify baseline**

Run:

```bash
pnpm --dir apps/web test
pnpm --dir apps/web build
```

Expected: current behavior still points to checkout-first messaging.

**Step 3: Implement the landing-page refactor**

Keep the page persuasive, but activation-first.

**Step 4: Run tests/build**

Run:

```bash
pnpm --dir apps/web test
pnpm --dir apps/web build
```

Expected: PASS and landing page compiles with start-free flow.

**Step 5: Commit**

```bash
git add apps/web/landing_page/pages/home.jsx apps/web/src/components/landing/HeroSection.jsx apps/web/src/components/landing/PricingSection.jsx apps/web/src/components/landing/FAQSection.jsx apps/web/src/components/landing/FooterSection.jsx apps/web/src/components/LanguageToggle.jsx apps/web/src/pages/CheckoutRedirect.jsx
git commit -m "feat(landing): switch to start-free messaging and activation-first CTA"
```

### Task 8: Add In-App Payment Method Chooser

**Files:**
- Create: `apps/web/src/components/premium/PremiumCheckoutModal.jsx`
- Create: `apps/web/src/components/premium/PaymentMethodChooser.jsx`
- Modify: `apps/web/landing_page/components/landing/CheckoutModal.jsx`
- Modify: `apps/web/src/lib/api/resources/admin.js`
- Modify: `apps/web/src/contexts/accessState.js`

**Step 1: Write the failing UX expectations**

Cover:

- premium paywall offers:
  - Apple Pay
  - Google Pay
  - Pix
  - Pay with card
- Apple/Google path maps to Stripe
- Pix/card path maps to Mercado Pago

**Step 2: Run web tests/build to establish failure**

Run:

```bash
pnpm --dir apps/web test
pnpm --dir apps/web build
```

Expected: no in-app payment chooser exists yet.

**Step 3: Implement the chooser and provider routing**

Keep Stripe limited to wallet-first flow and Mercado Pago responsible for Pix and manual card.

**Step 4: Run tests/build**

Run:

```bash
pnpm --dir apps/web test
pnpm --dir apps/web build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/premium/PremiumCheckoutModal.jsx apps/web/src/components/premium/PaymentMethodChooser.jsx apps/web/landing_page/components/landing/CheckoutModal.jsx apps/web/src/lib/api/resources/admin.js apps/web/src/contexts/accessState.js
git commit -m "feat(web): add premium payment method chooser"
```

### Task 9: Add Shared Premium Unlock Service In The API

**Files:**
- Create: `apps/api/src/payments/payments.module.ts`
- Create: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/payments.controller.ts`
- Create: `apps/api/src/payments/stripe.webhook.controller.ts`
- Create: `apps/api/src/payments/mercadopago.webhook.controller.ts`
- Create: `apps/api/src/payments/premium-entitlements.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/payments/payments.service.spec.ts`

**Step 1: Write failing payment service tests**

Cover:

- Stripe webhook approval unlocks premium on user
- Mercado Pago approved Pix unlocks premium on user
- Mercado Pago card approval unlocks premium on user
- provider-specific ids are saved
- unlock path is idempotent

**Step 2: Run test to verify failure**

Run: `pnpm --dir apps/api test payments.service.spec.ts`
Expected: FAIL because shared premium-unlock payment services do not exist yet.

**Step 3: Implement the common unlock path**

Make both providers call one entitlement unlock service.

**Step 4: Run test to verify pass**

Run: `pnpm --dir apps/api test payments.service.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/payments apps/api/src/app.module.ts
git commit -m "feat(api): unify premium unlock across stripe and mercadopago"
```

### Task 10: Refresh Stripe Webhook URL And Runtime Contract

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `README.md`
- Create: `docs/plans/artifacts/2026-07-02-premium-checkout-runtime-contract.md`
- Create: `docs/plans/artifacts/2026-07-02-stripe-webhook-update-runbook.md`

**Step 1: Document the failing operational gap**

Capture:

- current Stripe webhook endpoint
- new webhook endpoint
- required Stripe secret
- Coolify secrets involved

**Step 2: Add runtime docs**

Document exact env vars and dashboard update steps:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`

**Step 3: Verify docs completeness**

Run: `rg -n "STRIPE_|MERCADOPAGO_" apps/api/.env.example README.md docs/plans/artifacts`
Expected: all required vars and webhook-update steps appear exactly once in the new docs.

**Step 4: Commit**

```bash
git add apps/api/.env.example README.md docs/plans/artifacts/2026-07-02-premium-checkout-runtime-contract.md docs/plans/artifacts/2026-07-02-stripe-webhook-update-runbook.md
git commit -m "docs: add premium checkout runtime contract and stripe webhook runbook"
```

### Task 11: Add Admin Pricing/Product Controls For Premium Offer

**Files:**
- Modify: `apps/api/src/db/schema/pricing-config.ts`
- Modify: `apps/api/src/admin/dto/update-pricing-config.dto.ts`
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/web/src/pages/admin/PricingConfigPage.jsx`
- Test: `apps/api/src/admin/admin.controller.spec.ts`

**Step 1: Write failing admin tests**

Cover the admin-configurable premium offer fields:

- premium price
- comparison copy inputs if stored server-side
- wallet-provider availability flags if needed

**Step 2: Run test to verify failure**

Run: `pnpm --dir apps/api test admin.controller.spec.ts`
Expected: FAIL because pricing config only models the old landing price/installments surface.

**Step 3: Implement the minimal config expansion**

Keep config scoped to what checkout and landing actually need.

**Step 4: Run tests/build**

Run:

```bash
pnpm --dir apps/api test admin.controller.spec.ts
pnpm --dir apps/web build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/src/db/schema/pricing-config.ts apps/api/src/admin/dto/update-pricing-config.dto.ts apps/api/src/admin/admin.controller.ts apps/web/src/pages/admin/PricingConfigPage.jsx apps/api/src/admin/admin.controller.spec.ts
git commit -m "feat(admin): support premium offer configuration"
```

### Task 12: End-To-End Verification

**Files:**
- Read: `docs/plans/2026-07-02-free-core-premium-access-design.md`
- Read: `docs/plans/2026-07-02-free-core-premium-access.md`
- Create: `docs/plans/artifacts/2026-07-02-free-core-premium-smoke-test.md`

**Step 1: Verify free-core behavior**

Run through:

- new user login starts premium access
- manual transaction creation works
- import works
- landing CTA routes into product, not checkout

**Step 2: Verify premium-active behavior**

Run through:

- bills usable
- planning usable
- investments usable
- category cards show remaining budget guidance

**Step 3: Verify expired-premium behavior**

Seed or simulate an expired premium user and verify:

- manual transactions still work
- import still works
- premium routes show lock states
- category remaining guidance hides correctly

**Step 4: Verify payment routing**

Test:

- Apple/Google path routes to Stripe
- Pix route uses Mercado Pago
- card route uses Mercado Pago
- both webhook paths unlock the same entitlement

**Step 5: Save the smoke-test artifact**

Write results to `docs/plans/artifacts/2026-07-02-free-core-premium-smoke-test.md`.

**Step 6: Commit**

```bash
git add docs/plans/artifacts/2026-07-02-free-core-premium-smoke-test.md
git commit -m "docs: record free core premium access smoke test"
```

## Verification Commands

Run these before calling implementation complete:

```bash
pnpm --dir apps/api test
pnpm --dir apps/web test
pnpm --dir apps/api build
pnpm --dir apps/web build
```

Focused checks likely useful while iterating:

```bash
pnpm --dir apps/api test auth.service.spec.ts
pnpm --dir apps/api test auth.controller.spec.ts
pnpm --dir apps/api test payments.service.spec.ts
pnpm --dir apps/api test admin.controller.spec.ts
pnpm --dir apps/web test accessState.test.js
pnpm --dir apps/web build
```

## Risks To Watch

- Accidentally messaging premium expiry as full-app expiry
- Leaking planning-derived "remaining budget" information to free users
- Resetting premium start date on subsequent logins
- Diverging Stripe and Mercado Pago post-payment unlock behavior
- Forgetting raw-body or webhook-secret requirements on the new Stripe endpoint
- Leaving old landing checkout entry points partially active

## Execution Notes

- Prefer additive gating first, then tighten lock states once the shared entitlement model is proven.
- Keep free-core messaging visible anywhere premium is locked.
- Treat the in-app premium purchase flow as the canonical purchase surface, even if the landing page retains informational premium content.
- Reuse the same unlock side effects for both providers so billing, notifications, and entitlement state cannot drift.
