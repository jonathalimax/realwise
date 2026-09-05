# Architecture

## System overview

```txt
apps/web React/Vite customer app
apps/admin React/Vite admin SPA
        │ fetch(..., { credentials: 'include' })
        ▼
apps/api NestJS API
        ├── PostgreSQL via Drizzle
        ├── httpOnly cookie auth
        ├── payment providers
        ├── email/notification jobs
        └── object storage/import processing
```

## Application boundaries

- **apps/api** owns authentication, authorization, persistence, payments, imports, email jobs, and server-side integrations.
- **apps/web** owns customer UX and should consume API endpoints with credentials included.
- **apps/admin** owns operational/admin UX and uses `/admin/*` API endpoints.
- **packages/types** owns shared DTOs/types used across apps.

## Authentication contract

- Browser auth uses httpOnly cookies: `access_token` and `refresh_token`.
- Browser clients call the API with `credentials: 'include'`.
- The browser no longer initializes Firebase directly in the active architecture.
- API session payloads carry `clientId` and `sub`; queries must scope by both where needed.

## Tenant/client routing

- Customer URL shape is path-based: `/{clientId}/...`, including `/{clientId}/dashboard`.
- The web app loads runtime client config from `public/clients/app.json` or `public/clients/app.dev.json`.
- Legacy subdomain extraction may exist, but path-based tenant UX remains supported.

## Data and persistence

- PostgreSQL is the active application database.
- Drizzle owns schema/migrations in the API workspace.
- Firebase/Firestore references are legacy unless a current feature explicitly depends on them.

## API contract

- Admin endpoints live under `/admin/*`.
- Shared DTOs belong in `packages/types` when used by more than one app.
- Keep browser clients thin; business rules should live in `apps/api` or pure shared modules when appropriate.

## Integrations

- Payments: Stripe and Mercado Pago converge to entitlement updates in API payment modules.
- Email: SMTP-backed delivery for reminders, purchase/admin/import emails.
- Bank imports: CSV/PDF/XLSX importers and issue workflows.
- B3 sync: market data/investment sync where feature-flagged.
