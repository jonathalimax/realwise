## Summary
- 

## Validation
- [ ] `pnpm --filter @realwise/api lint` when API code changes
- [ ] `pnpm --filter @realwise/api test` when API code changes
- [ ] `pnpm --filter @realwise/api build` when API code changes
- [ ] `pnpm --filter @realwise/web test` when web code changes
- [ ] `pnpm --filter @realwise/web build` when web code changes
- [ ] `pnpm --filter @realwise/admin lint` when admin code changes
- [ ] `pnpm --filter @realwise/admin build` when admin code changes

## Target branch
- [ ] This PR targets `develop` for day-to-day work, or `main` only for production release from `develop`.

## Squash merge message
Use a simple, complete squash message when merging into `develop` or `main`:

```txt
<type>(<scope>): <short outcome>

Summary:
- Added/changed/fixed ...
- Added/changed/fixed ...

Validation:
- <commands/checks run>
```
