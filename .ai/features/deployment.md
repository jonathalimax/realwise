# Feature: Deployment and Runtime

## Purpose

Build, configure, and deploy the web, admin, and API services safely.

## Runtime configuration

- Root `.env*` files are local templates/config; never commit real secrets.
- Web runtime client config is loaded from `public/clients/*.json`.
- API secrets include database, JWT/cookie, email, storage, and payment provider credentials.

## CI/CD

GitHub workflows exist for admin, API, business-admin, and web. Claude Code review/fix automation should not be used unless tokens and policy are explicitly added later.

## Change checklist

- Update `.env.example` when required variables change.
- Update app build/deploy workflow if service boundaries change.
- Add rollback notes for risky deployment changes.

## Page-head rule (blank-screen incident)

Never add a plain `<script src=...>` (no `async`/`defer`) for a third party in `apps/web/index.html`. A classic script in `<head>` blocks the browser from reading the rest of the page until that server answers, so a slow or blocked host leaves a blank screen (only the `html` background shows; navy `#020617` in dark mode). The Mercado Pago SDK is `async` for this reason. Use `async` (not `defer`): deferred scripts run in order with the app's module script and would still delay the app.
