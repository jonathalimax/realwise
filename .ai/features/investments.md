# Feature: Investments and B3 Sync

## Purpose

Track investments and optionally sync Brazilian market/B3 data.

## Feature flags

- `investments` controls investment routes/UX.
- `b3Sync` controls B3 sync availability.

## Boundaries

- API owns external data sync and persistence.
- Web owns feature-gated investment UX.
- Runtime client config controls whether the customer sees related features.

## Agent notes

- Check feature flags before exposing UI.
- Avoid calling external services directly from browser code unless already established.
- Document new provider credentials/runtime variables in deployment docs.

## Status

Disabled: `investments` and `b3Sync` are `false` in `apps/web/public/clients/app.json`, `app.dev.json` and the dev config; investment routes redirect to `/dashboard` and the nav item is hidden. Set the flags to re-enable.
