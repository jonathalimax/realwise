# Safe Deploy Scripts — Design Spec
**Date:** 2026-05-20

## Problem

Manual `firebase deploy` commands with ad-hoc flags caused recurring issues:
- Wrong site or env deployed to (prod/dev mix-up)
- `firebase.json` config changes (rewrites, headers) not deployed alongside file uploads, leaving the service worker masking a broken live state
- `realwise-redirect` accidentally included in deploys it had no business being in
- No confirmation step before touching production

## Solution

A single guard script (`scripts/deploy.sh`) called by named npm scripts. Each script:
1. Prints a colored summary of what will be deployed and to which env
2. Requires explicit `y` confirmation (anything else aborts)
3. Runs build if needed, then deploys in order

## Project Layout (for context)

| Firebase Project   | Hosting Sites                          | Functions |
|--------------------|----------------------------------------|-----------|
| `moneywise-ad9ec`  | `mymoneywise` → `realwise.com.br`      | Yes (prod)|
|                    | `realwise-redirect` → short URL domain | No        |
| `realwise-dev`     | `realwise-dev` → dev domain            | Yes (dev) |

## npm Scripts

```
npm run deploy:prod            → build + hosting:mymoneywise + functions + firestore:rules
npm run deploy:dev             → build + hosting:realwise-dev + functions (dev project)
npm run deploy:hosting:prod    → build + hosting:mymoneywise + firestore:rules
npm run deploy:hosting:dev     → build + hosting:realwise-dev
npm run deploy:functions:prod  → functions to moneywise-ad9ec (no build)
npm run deploy:functions:dev   → functions to realwise-dev (no build)
npm run deploy:redirect        → hosting:realwise-redirect only (standalone, for /go/* link updates)
```

## Guard Script (`scripts/deploy.sh`)

### Arguments
```
deploy.sh <env> <target>
  env:    prod | dev
  target: all | hosting | functions | redirect
```

### Confirmation UX

Prod (red):
```
╔══════════════════════════════════════╗
║  🔴  DEPLOYING TO PRODUCTION         ║
╠══════════════════════════════════════╣
║  Build:     npm run build            ║
║  Hosting:   mymoneywise (realwise)   ║
║  Functions: moneywise-ad9ec          ║
║  Rules:     firestore.rules          ║
╚══════════════════════════════════════╝
Type "y" to continue, anything else aborts:
```

Dev (green, same format with 🟢 DEPLOYING TO DEV).

### Execution Order
1. (if hosting or all) `npm run build`
2. (if hosting or all) `firebase deploy --only hosting:<site>[,firestore:rules]`
3. (if functions or all) `firebase deploy --only functions --project <project>`

### Error Guards
- **Build failure** → abort before any Firebase deploy
- **Dirty working tree on prod** → print warning (non-blocking; intentional deploys without committing are valid)
- **`realwise-redirect` exclusion** → never included in `prod`, `dev`, `hosting:prod`, or `hosting:dev` targets. Only reachable via `deploy:redirect`.

## Notes

- `realwise-redirect` serves a short URL domain. Its `/go/*` pages redirect to `realwise.com.br` with UTM params. The root `index.html` is a legacy subdomain redirect — no longer functional since switching to path-based routing. Clean up the root script in a future pass.
- `moneywise-ad9ec` site (same project, different site from `mymoneywise`) is not included in any deploy script — it appears unused as a hosting target. Verify before removing from `firebase.json`.
