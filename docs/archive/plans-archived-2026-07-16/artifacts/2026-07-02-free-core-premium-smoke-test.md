# Free Core Premium Smoke Test

Date: 2026-07-06

This artifact records the verification status for the free-core premium refactor in the current worktree.

## Automated checks

### Pass

- `pnpm --dir apps/api test payments.service.spec.ts auth.service.spec.ts auth.controller.spec.ts`
- `pnpm --dir apps/web test src/lib/api/resources/payments.test.js src/components/premium/premiumCheckout.test.js src/contexts/accessState.test.js`
- `pnpm --dir apps/api build`
- `pnpm --dir apps/web build`

### What those checks cover

- New user auth initializes 45-day premium access.
- Auth session payload exposes premium status fields.
- Expired premium users resolve to locked premium feature flags in web access state.
- Stripe and Mercado Pago approvals converge on one premium unlock path.
- Checkout resource calls route to the Nest API payment endpoints.
- Checkout and app bundles still compile after the monetization refactor.

## Code-path verification

### Free core behavior

Status: Pass by code inspection and build coverage.

- Manual transactions remain on the normal app surfaces and are not behind premium route gates.
- Import flow is not gated by premium route locks.
- Landing CTAs route into login/start flow instead of immediate checkout.
- Free users still see category totals while planning-derived remaining guidance is hidden.

### Premium-active behavior

Status: Pass by route/config inspection.

- Bills, planning, and investments remain available when `premiumStatus` is `trialing` or `active`.
- Category remaining guidance remains visible when premium access is valid.
- Premium checkout supports Stripe wallet routing plus Mercado Pago Pix/card routing.

### Expired-premium behavior

Status: Pass by access-state test coverage and route/component inspection.

- Premium routes render lock states instead of silently failing.
- Free-core navigation remains available after expiry.
- Category remaining guidance hides for expired premium access.

## Manual live verification still required

Status: Not executed in this workspace run.

- Apple Pay or Google Pay real payment through Stripe hosted checkout
- Real Pix payment through Mercado Pago
- Real Mercado Pago manual card payment
- Stripe dashboard webhook delivery test against `https://api.realwise.com.br/webhooks/stripe`
- Mercado Pago webhook delivery test against `https://api.realwise.com.br/webhooks/mercadopago`

## Recommended live smoke sequence

1. Log in with a fresh user and confirm premium access starts.
2. Open planning, bills, and investments before expiry and confirm they are usable.
3. Start Stripe wallet checkout from a premium lock and confirm hosted checkout opens.
4. Start Mercado Pago Pix checkout and confirm QR/copia-e-cola data is returned.
5. Replay or send provider webhook events and confirm the same user becomes `premium_status = active`.
6. Set an existing user `premium_access_ends_at` in the past and confirm locked premium routes plus free-core continuity.
