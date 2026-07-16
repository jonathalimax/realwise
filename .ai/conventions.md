# Engineering Conventions

## Before editing

- Read `.ai/README.md` and relevant feature/app docs.
- Check git status and avoid overwriting unrelated work.
- Prefer workspace commands through pnpm.
- Do not use Firebase-era assumptions unless current code proves they still apply.

## Implementation boundaries

- Implement only the requested behavior.
- Keep business rules in `apps/api` unless they are pure UI state or pure calculations.
- Put cross-app DTOs/types in `packages/types`.
- Do not duplicate entitlement, tenant, auth, or payment logic in browser apps.

## Security

- Never commit secrets or real `.env` values.
- Use httpOnly cookies for browser auth.
- Validate API request payloads at controller/DTO boundaries.
- Scope tenant/user data by `clientId` and authenticated subject where required.
- Verify webhook signatures for payment providers.

## Testing expectations

- API: run focused Jest tests for changed modules when available.
- Web: run Vitest for pure logic and lint/build for UI/API changes.
- Admin: run lint/build for UI/API changes.
- If commands cannot run locally, document why in `.pipeline/test-results.md`.

## Documentation updates

Update `.ai/` when a change affects:

- auth/session behavior;
- tenant routing/client config;
- payments or entitlement flow;
- import processing;
- app boundaries;
- deployment/runtime variables;
- shared DTOs/API contracts.
