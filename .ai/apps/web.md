# App: Customer Web

## Stack

React 19, Vite, Tailwind CSS v4, React Router, Vitest for pure logic tests.

## Responsibilities

- Customer dashboard and finance workflows.
- Path-based tenant routing with `/{clientId}/...`.
- Runtime client config and feature flags.
- Cookie-authenticated API calls with credentials included.

## Agent entry points

Inspect relevant routes/pages, contexts, API clients, and pure helper tests before editing.

## Validation

```bash
pnpm --filter @realwise/web lint
pnpm --filter @realwise/web test
pnpm --filter @realwise/web build
```
