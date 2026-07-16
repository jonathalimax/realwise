# Realwise

Realwise is a pnpm monorepo for a personal finance platform.

## Apps and packages

| Path | Purpose |
|---|---|
| `apps/web` | Customer-facing React/Vite app at `/{clientId}/...` |
| `apps/admin` | Standalone admin React/Vite SPA |
| `apps/api` | NestJS API for browser apps and integrations |
| `packages/types` | Shared DTOs/domain types |
| `infrastructure` | Migration/deployment/support scripts |

## AI/project documentation

Canonical agent-facing documentation lives in `.ai/`.

Start here:

```txt
.ai/README.md
.ai/project.md
.ai/architecture.md
.ai/feature-map.md
```

Feature docs live in `.ai/features/`; app/package docs live in `.ai/apps/`.

## Current architecture summary

- Browser auth uses httpOnly cookies: `access_token` and `refresh_token`.
- Browser apps call the API with `fetch(..., { credentials: 'include' })`.
- `apps/web` loads client config from `public/clients/*.json` and preserves path-based tenant URLs.
- `apps/admin` uses `/admin/*` REST endpoints and is separate from the customer router.
- Shared DTOs live in `packages/types`.
- Firebase browser bootstrap is no longer the active architecture.

## Development

```bash
pnpm install
pnpm web:dev
pnpm admin:dev
pnpm api:dev
```

## Build and test

```bash
pnpm web:build
pnpm admin:build
pnpm api:build
pnpm build
pnpm lint
pnpm test
```
