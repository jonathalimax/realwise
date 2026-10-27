# Feature: Stripe-only subscriptions with a 3-day trial and a hard paywall

Status: built and verified end to end on branch `feat/stripe-subscriptions` (PR open, not yet deployed). This file is the **contract** between the API, web and admin workstreams and, once shipped, the feature documentation.

## Product rules (decided)

- **Stripe is the only payment provider.** Mercado Pago, the one-time purchase flow, the custom coupon system and the landing "pricing config" are removed. Discounts are Stripe **promotion codes** (`allow_promotion_codes: true`).
- **Plans:** monthly and annual (annual discounted). Prices live in Stripe; the app reads them. Env: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`.
- **Trial:** every new user gets a **3-day, no-card trial** managed by the app (`users.premium_status = 'trialing'`, `users.premium_access_ends_at = signup + 3 days`). `PREMIUM_TRIAL_DAYS = 3`.
- **After the trial everything is blocked** (API and web) until the user subscribes, except: auth (`/auth/*`), billing (`/billing/*`), health, public webhooks. The web shows a full-screen **paywall** instead of the app.
- **Existing users (migration `0024`):** users with `premium_status = 'active'` (they paid the old one-time price) keep access **forever** ("lifetime"). Everyone else gets a **fresh 3-day trial starting at deploy time**.
- Owner (`jonathalimax@gmail.com`) and `role = 'admin'` are never blocked.
- Enforcement is **server-side** (the web only reflects it). The chat costs money per message, so the API must refuse blocked users.

## Access state (single source of truth, API)

Pure function `computeAccess(user, now)` in `apps/api/src/billing/access.ts`:

| state | allowed | when |
|---|---|---|
| `owner` | yes | `role = 'admin'` or email = owner |
| `lifetime` | yes | `premium_status = 'active'` AND no `stripe_subscription_id` (legacy one-time purchase, any provider) |
| `subscribed` | yes | `subscription_status` in `active`, `trialing`; also `past_due` while `now < subscription_current_period_end + 3 days` (grace); also `canceled` with `cancel_at_period_end` while `now < subscription_current_period_end` |
| `trial` | yes | `premium_status = 'trialing'` AND `premium_access_ends_at > now` |
| `blocked` | **no** | anything else |

Returned shape (also embedded in `GET /auth/me` as `access`):

```ts
interface AccessInfo {
  state: 'owner' | 'lifetime' | 'subscribed' | 'trial' | 'blocked';
  allowed: boolean;
  trialEndsAt: string | null;          // ISO, when state = trial or blocked-after-trial
  trialDaysRemaining: number;          // ceil, 0 when not in trial
  plan: 'monthly' | 'annual' | null;
  subscriptionStatus: string | null;   // raw Stripe status
  currentPeriodEnd: string | null;     // ISO
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;           // has a Stripe customer (portal available)
}
```

A global `SubscriptionGuard` (registered **after** `JwtAuthGuard` as `APP_GUARD`) loads the user row, computes access and throws `HttpException({ code: 'SUBSCRIPTION_REQUIRED', message }, 402)` when `!allowed`. Skipped for `@Public()` routes and routes decorated `@AllowWithoutSubscription()` (all of `AuthController`, all of `BillingController`, `HealthController`).

## Database (migration `0024_stripe_subscriptions.sql`, additive + one data step)

`users` gains: `stripe_customer_id varchar` (unique index, nullable), `stripe_subscription_id varchar`, `subscription_status varchar`, `subscription_plan varchar` (`monthly|annual`), `subscription_current_period_end timestamptz`, `subscription_cancel_at_period_end boolean default false not null`.

Data step (same migration): for users where `premium_status` is not `'active'`: set `premium_status = 'trialing'`, `premium_access_started_at = now()`, `premium_access_ends_at = now() + interval '3 days'`.

`purchases` is kept as a payment log (one row per successful checkout session, idempotent by session id). `pricing_config` and `coupons` tables are left in place (no destructive migration) but unused.

## API (apps/api)

New `billing` module (`apps/api/src/billing/`):

- `GET  /billing/status` → `AccessInfo`.
- `GET  /billing/plans` → `[{ plan: 'monthly'|'annual', priceId, amount (cents), currency, interval, savingsPercent|null }]` read from Stripe (`prices.retrieve`), cached in memory ~10 min.
- `POST /billing/checkout` body `{ plan: 'monthly'|'annual' }` → `{ url }`. Creates/reuses the Stripe Customer (store `stripe_customer_id`), Checkout Session `mode: 'subscription'`, `client_reference_id = user.id`, `subscription_data.metadata = { userId, clientId }`, `allow_promotion_codes: true`, `locale: 'pt-BR'`, `success_url = ${FRONTEND_BASE_URL}/${clientId}/billing/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url = ${FRONTEND_BASE_URL}/${clientId}/billing/cancelled`. 409 if the user already has a live subscription (use the portal).
- `POST /billing/portal` → `{ url }` Stripe Billing Portal session (return URL = app).
- `POST /webhooks/stripe` (`@Public`, signature verified with `STRIPE_WEBHOOK_SECRET` and the raw body): handle `checkout.session.completed` (subscription mode: attach customer + subscription to the user from `client_reference_id`, sync, record a `purchases` row, send the existing access-granted e-mail once), `customer.subscription.created|updated|deleted` and `invoice.payment_failed|invoice.paid` (state-based sync from the Stripe subscription object, found by `metadata.userId` or `stripe_customer_id`). Handlers must be **idempotent** and order-tolerant (always sync from the fetched subscription, never increment).
- `auth.service`: `PREMIUM_TRIAL_DAYS = 3`; `/auth/me` adds `access`.
- **Removed:** `mercadopago.*`, `/payments/*` one-time routes (`stripe/checkout`, `mercadopago/*`, `session`, `process`, `webhooks/mercadopago`), coupon + pricing-config logic in `payments.service`, `premium-entitlements.service` one-time unlock, admin coupon/pricing endpoints and DTOs. **Kept:** `POST /payments/partial-lead` (landing leads) if still used by the landing page.

Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `FRONTEND_BASE_URL` (exists). Remove `MP_*`/`MERCADOPAGO_*` from `.env.example`.

## Web (apps/web)

- `AuthContext` already loads `/auth/me`: use its `access` object. `deriveAccessState` exposes `access` and `hasPremiumAccess = access.allowed` (owner/admin logic comes from the server now). Remove the per-feature `premiumFeatureLocks` (everything is unlocked while allowed).
- New `SubscriptionGate` around the authenticated routes: when `access.allowed === false` render `PaywallPage` (full screen, no sidebar): plan chooser (monthly / annual with savings badge, real prices from `GET /billing/plans`), "Assinar" → `POST /billing/checkout` → `window.location = url`; for users with `canManageBilling` also "Gerenciar assinatura" (portal); "Sair". Copy in pt-BR (en fallback). Calm tone: the user's data is safe and returns as soon as they subscribe.
- Routes `/billing/success` and `/billing/cancelled` (allowed while blocked): success polls `/auth/me` every 2s (max ~60s; the webhook may lag) until `access.allowed`, then goes to the dashboard.
- `apiClient` 402 handling: a response with `code: 'SUBSCRIPTION_REQUIRED'` triggers an auth refresh (`rw:subscription-required` event) so the gate flips to the paywall without a reload.
- Trial banner (top of the app) while `state = 'trial'`: "Teste grátis: faltam N dia(s) · Assinar" linking to the paywall/checkout; adapt `PremiumAccessBanner`.
- Settings: "Assinatura" section (plan, renews/ends on, "Gerenciar assinatura").
- Landing pricing/CTAs: monthly and annual price copy, "Teste grátis por 3 dias", CTA goes to sign-in (no anonymous checkout any more).
- **Removed:** Mercado Pago checkout UI/helpers (`PaymentMethodChooser`, `premiumCheckout.js`, MP bits of the premium checkout modal), `PremiumFeatureGate` / `PremiumRouteGate` and their uses, the `premium locks` in `ExpensesByCategoryCard` / `BudgetCategorySection`.

## Admin (apps/admin)

Remove the pricing-config and coupon management screens and their API client calls; keep purchases/leads views. Show nothing that references Mercado Pago.

## Security

Webhook signature always verified; never trust a redirect or client state for entitlement (success page only polls the server); secrets stay server-side; the guard fails closed (blocked) when the user row cannot be loaded.

## Verification (no new unit-test files per repo owner's rule)

Existing tests broken by the change are fixed (tests of deleted code are deleted). The orchestrator verifies with scratch-database scripts: state machine table above, guard 402 vs allowed, migration data step, webhook signature + idempotent sync with a stubbed Stripe client, and the paywall flow in the browser.

## Decisions taken at build time

- **Pricing (owner's choice):** monthly **R$ 8,99**, annual about **30% off** (≈ R$ 75,48/year, ≈ R$ 6,29/month). Created in Stripe, never hard-coded; the paywall shows the real Stripe amounts.
- **AI inside the plan (fair use):** every subscriber gets Elio. After the per-user monthly AI budget (`LLM_MONTHLY_BUDGET_USD`) Elio continues on the cheaper `LLM_MODEL_FALLBACK` until `LLM_HARD_CAP_MULTIPLIER` × the budget, then stops until next month. At R$ 8,99 the budget must stay small (see "Unit economics").
- `POST /billing/checkout` answers **409** for `lifetime` users (their legacy access must not be replaced by a subscription that can end) and for users with a live Stripe subscription; the owner can still check out.
- The Stripe webhook **never edits `premium_status`**: access comes only from the `subscription_*` columns; trial fields are left alone.
- An event for an old, ended subscription cannot overwrite a live one; handlers re-fetch the subscription (state-based, idempotent, order-tolerant); a purchase row is written once per session under an advisory lock; e-mail failures are logged, not thrown (so Stripe does not replay).
- Webhook responses: bad/missing signature or secret → 400; processing error → 500 (Stripe retries); unknown events/users → 200.
- The paywall is rendered **above** every data provider, so a blocked user fires no data requests; it reads the language/dark mode from localStorage because `/settings` is blocked too.
- Admin: coupon/pricing screens and the abandoned-checkout offer actions (stages 2 and 3) were removed; the API returns 400 for those stages.

## Stripe setup (production)

1. Product with two recurring BRL prices (monthly, annual). Put their ids in `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`.
2. Customer portal enabled (Settings → Billing → Customer portal), promotion codes allowed.
3. Webhook endpoint `https://api.realwise.com.br/webhooks/stripe` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, **created with API version `2025-08-27.basil`** (the version the installed `stripe@18.5` SDK pins; another version can move `current_period_end` and null the renewal date / past-due grace).
4. Env on the API: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `FRONTEND_BASE_URL`. Remove `MP_*` / `MERCADOPAGO_*`.

## Unit economics (estimates, to be replaced by the data in `llm_call_log`)

Stripe card fees + taxes take roughly 10–12% of a Brazilian subscription. At R$ 8,99 the net is about R$ 7,7 (≈ US$ 1,4); at the annual price about R$ 5,5 per month. A typical active user costs about US$ 1,5–2,5 per month with Sonnet for everything, so the price only works with a **small AI budget (≈ US$ 0,5–0,7 per user per month), the cheaper model for plain questions and insights, and Sonnet only for document extraction**. The 3-day trial is also metered by the same per-user budget.

## Verified

API: 79 scenario checks by the API workstream (state table, migration data step, guard, signature verification, idempotent replays, billing endpoints) with a stubbed Stripe; integration run of the real API + real web with an in-memory Stripe stand-in: blocked user gets 402 on data/chat and still reaches billing, trial and lifetime pass, subscribe → success page → webhook → unlocked (+ onboarding), trial banner, and a trial that expires mid-session flips to the paywall without a reload. Not verified against real Stripe (no keys here).

## Landing page (concise, animated)

The landing (`apps/web/landing_page/`) is one short page: hero with the animated **Elio chat demo** (`ChatDemo.jsx`: a statement is dropped in, Elio reads and summarises it with a counting total and animated category bars, then answers a savings question; it loops while visible, pauses off-screen and shows the finished conversation when the visitor prefers reduced motion), three-step "how it works", pricing, four FAQs, a closing call to action and the footer. Everything else (founder story, testimonials, guarantee, pain points, feature grids) was removed.

- Prices come live from Stripe through the public, cached `GET /billing/public-plans` (same data as `/billing/plans`); if it fails the cards say "Valores ao entrar no app". Pricing has no scroll-reveal on purpose (it must always be visible).
- All call-to-action buttons use `CtaButton`, not the shared `Button`: the shared one concatenates its own dark-mode colours, which beat any colour passed in.
- CTAs keep the existing sign-in hand-off (`sessionStorage.__rw_show_login` then `/login`) and `landingAnalytics` events.
