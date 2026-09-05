# Feature: Admin Operations

## Purpose

Operational tools for managing leads, coupons, pricing, onboarding, testimonials, payment issues, and import issues.

## Boundaries

- `apps/admin` owns admin UX.
- `apps/api` owns `/admin/*` endpoints, permissions, persistence, and side effects.
- Shared admin DTOs belong in `packages/types` when reused.

## Agent notes

- Do not mix admin workflows into customer web routing.
- Preserve admin endpoint authorization checks.
- Keep admin-only data out of customer app bundles unless explicitly public.
