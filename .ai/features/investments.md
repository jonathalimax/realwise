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
