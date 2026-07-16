# App: Admin SPA

## Stack

React 19, Vite, Tailwind CSS v4.

## Responsibilities

- Admin/operator workflows.
- Consume API `/admin/*` endpoints.
- Manage operational entities such as leads, coupons, pricing, onboarding, testimonials, payments, and import issues.

## Agent notes

- Keep admin routes separate from customer web tenant routes.
- Do not expose admin-only data through customer app code.

## Validation

```bash
pnpm --filter @realwise/admin lint
pnpm --filter @realwise/admin build
```
