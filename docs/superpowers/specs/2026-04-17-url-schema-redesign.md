# URL Schema Redesign

**Date:** 2026-04-17  
**Status:** Approved

## Goal

Clean up the URL schema so authenticated app routes no longer include a redundant `/app` segment, fix the broken `/purchase-success` route, and make clientId equal to the user's email username (e.g. `jonathalimax@gmail.com` → `jonathalimax`).

## URL Schema

| Route | Renders |
|---|---|
| `/` | Landing page (purchase flow) |
| `/purchase-success` | Purchase success page |
| `/{clientId}/login` | Auth page |
| `/{clientId}/dashboard` | Dashboard (default after login) |
| `/{clientId}/planner` | Planner |
| `/{clientId}/expenses` | Expenses |
| `/{clientId}/income` | Income |
| `/{clientId}/bills` | Bills |
| `/{clientId}/cards` | Cards |
| `/{clientId}/transactions` | Transactions |
| `/{clientId}/transactions/:id/edit` | Transaction edit |
| `/{clientId}/settings` | Settings |
| `/{clientId}/budget` | Budget |
| `/{clientId}/help` | Help |
| `/{clientId}/notifications` | Notifications |
| `/{clientId}/import` | Import |
| `/{clientId}/goals` | Goals (feature-flagged) |
| `/{clientId}/investments` | Investments (feature-flagged) |
| `/{clientId}/investments/new` | Investment form |
| `/{clientId}/investments/:id/edit` | Investment form |
| `/{clientId}/investments/:id/withdraw` | Investment form |

The clientId is the user's Gmail username — the part before `@gmail.com`.

## Changes

### `src/config/clientConfig.js`
- Add `'purchase-success'` and `'login'` to `RESERVED_PATHS` so they're never mistaken for a clientId.

### `src/App.jsx` — `App()` path-prefix switch
Handle special top-level paths before mounting any `BrowserRouter`:

```
/                    → <LandingPage /> (Suspense, no Router)
/purchase-success    → <PurchaseSuccessPage /> (Suspense, no Router)
/__/auth/            → <FirebaseAuthHandler />
everything else      → ClientConfigProvider > BrowserRouter basename={/${clientId}} > AppRouter
```

### `src/App.jsx` — `AppRouter`
- Remove the `purchase-success` route (now handled at the top level).
- Change `login` success redirect: `Navigate to="/app"` → `Navigate to="/dashboard"`.

### `src/App.jsx` — `AuthenticatedApp`
- Remove `path="app"` route; replace with `path="dashboard"`.
- Change index redirect: `Navigate to="/app"` → `Navigate to="/dashboard"`.
- Change catch-all redirect: `Navigate to="/app"` → `Navigate to="/dashboard"`.
- All other page routes are unchanged (they never had `/app` prefix themselves).

## Out of Scope
- Landing page is unchanged (no login button added).
- No changes to Firebase project setup or client JSON files.
- No changes to how `ClientConfigContext` fetches config.
