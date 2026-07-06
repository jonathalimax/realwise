# Realwise

Realwise is a monorepo with two React apps and a NestJS API:

- `apps/web` is the customer-facing app at `/{clientId}/...`
- `apps/admin` is the standalone admin SPA
- `apps/api` is the cookie-authenticated backend that serves both apps

The active browser flow uses `fetch(..., { credentials: 'include' })` against the API. The browser no longer initializes Firebase directly.

## Current architecture

- Browser auth uses httpOnly cookies: `access_token` and `refresh_token`
- `apps/web` loads client config from `public/clients/*.json` and keeps the tenant URL shape
- `apps/admin` uses `/admin/*` REST endpoints and no longer lives inside the web router
- Shared DTOs live in `packages/types`

## Repo layout

- `apps/web` - customer app, routing, forms, dashboards, imports, planner
- `apps/admin` - admin lead, coupon, pricing, onboarding, testimonial, and import-issue tools
- `apps/api` - auth, CRUD, storage, imports, notifications, and admin endpoints
- `functions` - removed

## Development

```bash
pnpm install
pnpm web:dev
pnpm admin:dev
pnpm api:dev
```

## Build

```bash
pnpm web:build
pnpm admin:build
pnpm api:build
pnpm build
```

## Tests

```bash
pnpm test
```

## Payments

- Stripe webhook endpoint: `https://api.realwise.com.br/webhooks/stripe`
- Mercado Pago webhook endpoint: `https://api.realwise.com.br/webhooks/mercadopago`
- Required API secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`
- The premium unlock path now converges inside `apps/api/src/payments/*` so both providers end in the same entitlement update.

## Notes

- The web app still supports the path-based tenant UX.
- The admin SPA is now isolated from the web router.
- Firebase-era browser/runtime files have been removed from the active app paths.
