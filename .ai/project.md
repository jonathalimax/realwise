# Project Context

## Product

Realwise is a personal finance platform for customers to manage money, imports, budgets, planning, investments, cards, bills, and premium access. It includes a customer web app, an admin SPA, and a NestJS API.

## Primary users

- **Customers:** track income, expenses, cards, bills, goals/investments, imports, and planner data.
- **Admins/operators:** manage leads, coupons, pricing, onboarding, testimonials, payment/import issues, and operational workflows.
- **System/integrations:** payment providers, email delivery, bank import processors, storage, and scheduled jobs.

## Repository model

This is a pnpm workspace monorepo.

| Path | Purpose |
|---|---|
| `apps/web/` | Customer-facing React/Vite app |
| `apps/admin/` | Standalone admin React/Vite SPA |
| `apps/api/` | NestJS API serving both browser apps |
| `packages/types/` | Shared DTO/domain types |
| `infrastructure/` | Migration/deployment/support scripts |
| `docs/archive/` | Historical plans/specs after AI docs restructure |

## Current architecture statement

The active browser architecture uses the API with cookie authentication. Firebase browser bootstrap is retired from active app paths. Legacy Firebase-era docs are historical unless promoted into `.ai/`.

## Documentation source of truth

- `.ai/` is the agent-facing architecture source.
- `README.md` is the human onboarding source.
- `docs/archive/` and `.ai/archive/` are historical references only.
