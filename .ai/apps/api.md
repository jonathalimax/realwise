# App: API

## Stack

NestJS 10, Drizzle ORM, PostgreSQL, Jest.

## Responsibilities

- Auth/session cookies.
- Tenant/user-scoped persistence.
- Finance, imports, payments, admin endpoints, email/jobs, and storage integrations.
- Shared API contracts with browser apps.

## Agent entry points

Inspect modules/controllers/services/DTOs/schema/tests related to the feature before editing.

## Validation

```bash
pnpm --filter @realwise/api test
pnpm --filter @realwise/api build
pnpm --filter @realwise/api lint
```
