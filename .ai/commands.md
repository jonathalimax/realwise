# Commands

## Root

```bash
pnpm install
pnpm web:dev
pnpm admin:dev
pnpm api:dev
pnpm build
pnpm lint
pnpm test
```

Root scripts:

| Command | Purpose |
|---|---|
| `pnpm web:dev` | Start customer web app |
| `pnpm admin:dev` | Start admin SPA |
| `pnpm api:dev` | Start NestJS API |
| `pnpm web:build` | Build customer web app |
| `pnpm admin:build` | Build admin SPA |
| `pnpm api:build` | Build API |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm test` | Test all workspaces |

## App-specific

```bash
pnpm --filter @realwise/web dev
pnpm --filter @realwise/web build
pnpm --filter @realwise/web lint
pnpm --filter @realwise/web test

pnpm --filter @realwise/admin dev
pnpm --filter @realwise/admin build
pnpm --filter @realwise/admin lint

pnpm --filter @realwise/api dev
pnpm --filter @realwise/api build
pnpm --filter @realwise/api test
pnpm --filter @realwise/api migrate:generate
pnpm --filter @realwise/api migrate:run
```

## Notes

Use focused workspace commands when changing one app. Run broader root commands when shared types or cross-app contracts change.
