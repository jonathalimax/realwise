# Realwise Infrastructure Migration Design
**Date:** 2026-06-23  
**Strategy:** Strangler Fig — replace Firebase services one at a time, never breaking production  
**Timeline:** 9-week focused sprint (Realwise feature-frozen during migration)

---

## Vision

Realwise becomes fully self-hosted, independent from Firebase, running on infrastructure the founder controls and can move to any provider in the future.

---

## Repository Structure

Monorepo using `pnpm workspaces`. No Turborepo or Nx.

```
realwise/
├── apps/
│   ├── web/          ← React + Vite (realwise.com.br)
│   ├── admin/        ← React + Vite admin UI (admin.realwise.com.br)
│   └── api/          ← NestJS backend (api.realwise.com.br)
├── packages/
│   └── types/        ← shared TypeScript DTOs and entity types
├── infrastructure/
│   ├── docker/       ← Compose files for local dev
│   ├── scripts/      ← migration scripts, backup scripts
│   └── monitoring/   ← Uptime Kuma config
├── docs/
│   └── superpowers/specs/
└── .github/
    └── workflows/
        ├── web.yml
        ├── admin.yml
        └── api.yml
```

---

## Infrastructure

**VPS:** Hetzner CX32 — 4 vCPU, 8 GB RAM, 80 GB SSD. Sized for Realwise only; upgradeable non-disruptively.

**Orchestrator:** Coolify manages all Docker containers. No manual `docker run` in production.

**Services:**
```
Coolify
├── PostgreSQL 16
├── Redis 7
├── MinIO
├── Uptime Kuma
├── apps/web   (static build)
├── apps/admin (static build)
└── apps/api   (Docker container from GHCR)
```

**Networking:** All services communicate over Coolify's internal Docker network. Only ports 80/443 exposed publicly via Caddy (managed by Coolify). PostgreSQL, Redis, and MinIO are never internet-accessible.

**DNS:**
- `realwise.com.br` → frontend
- `api.realwise.com.br` → NestJS backend
- `admin.realwise.com.br` → admin UI

SSL via Let's Encrypt, managed automatically by Coolify.

**Email:** `@nestjs/mailer` + `nodemailer` pointed at existing Umbler SMTP credentials. Handles bill reminders, admin emails, import emails. Credentials stored in Coolify secrets.

**Secrets:** All environment variables stored in Coolify secrets UI. Never committed to git.

---

## CI/CD

**Branch strategy:**
```
main      → production
develop   → staging (staging.realwise.com.br)
feature/* → PR validation only
```

**`web.yml` and `admin.yml`:**
```
PR:   install → lint → type-check → build
main: install → lint → type-check → build → deploy static to Coolify
```

**`api.yml`:**
```
PR:   install → lint → test → build
main: install → lint → test → build → docker build → push GHCR → Coolify webhook deploy
```

**Image tags:**
```
ghcr.io/jonathalima/realwise-api:latest       ← current main
ghcr.io/jonathalima/realwise-api:sha-{commit} ← immutable per commit
```

**Rollback:** Coolify retains previous container image. Target: under 5 minutes via Coolify UI or re-trigger of previous GitHub Actions run.

**Pre-deployment backup:** GitHub Actions SSHes into VPS and runs the PostgreSQL backup script before every production deployment.

---

## NestJS Backend Architecture

Single NestJS application, REST API. Domain-organized modules.

```
apps/api/src/
├── auth/           ← Passport.js, Google + Apple OAuth, JWT issuance
├── users/          ← user profiles, settings
├── transactions/   ← CRUD, import pipeline
├── bills/          ← recurring bills, reminder scheduling
├── budgets/
├── goals/          ← feature-flagged
├── investments/    ← B3 sync, manual positions
├── planner/        ← salary/deduction state
├── storage/        ← MinIO upload/download (presigned URLs)
├── payments/
│   ├── mercadopago/ ← primary payment method
│   └── stripe/      ← existing Stripe flows migrated
├── notifications/  ← @nestjs/mailer (bill reminders, admin, import emails)
├── queues/         ← BullMQ workers (import processing, reminders)
├── scheduler/      ← @nestjs/schedule (daily B3 sync, daily reminder dispatch)
├── clients/        ← per-client feature flags (replaces public/clients/*.json)
└── admin/          ← admin-only routes (leads, purchases, coupons, clients, imports)
```

**Auth guard:** Every route protected by JWT guard by default. Public routes opt out explicitly.

**Tenant isolation:** `client_id` injected from JWT payload into every query. Cross-client data leakage impossible at the service layer.

**Async work:** BullMQ (backed by Redis) for import processing, bill reminders, abandoned checkout emails. `@nestjs/schedule` for lightweight daily cron jobs.

**Admin module:** Routes protected by `AdminGuard` checking `role: 'admin'` claim on JWT. No separate auth system.

---

## Admin UI

Separate React + Vite app at `apps/admin/`. Deployed to `admin.realwise.com.br`. Same Coolify and GitHub Actions pattern as `apps/web/`.

Covers: lead management, purchase history, coupon management, client onboarding/transfer, import issue tracking.

---

## Database

**Engine:** PostgreSQL 16, single database, row-level tenant isolation via `client_id` on every tenant table.

**ORM:** Drizzle ORM with `drizzle-kit` for migrations. Migration files committed to git, run automatically before new container starts.

**Schema:**
```
clients           ← replaces public/clients/*.json (feature flags, config)
users             ← firebase_uid kept temporarily for migration matching
accounts          ← replaces userBanks
transactions
categories
budgets
goals
investments
planner
bills
bill_reminders
imports
attachments       ← MinIO object keys
settings
leads
purchases
coupons
import_issues
```

**Firebase migration bridge:** `firebase_uid` stored on `users` table during transition. On first login via new auth, email matched to existing row and new account linked — no forced re-registration.

---

## Authentication

**Stack:** Passport.js on NestJS with `@nestjs/passport`. Google OAuth and Apple Sign-In strategies. JWTs issued by the API.

**Flow:**
```
User → /auth/google or /auth/apple
    → Passport OAuth strategy
    → match email to existing user (or create)
    → issue JWT (access 15min) + refresh token (7d)
    → tokens stored in httpOnly cookies
    → all requests authenticated via JWT guard
```

**JWT payload:**
```json
{
  "sub": "user-uuid",
  "client_id": "jonathalimax",
  "role": "user | admin",
  "iat": 0,
  "exp": 0
}
```

**Security:** httpOnly cookies eliminate XSS token theft. Refresh token rotation on every use.

**Apple Sign-In:** Name and email captured on first login only (Apple limitation). Subsequent logins matched via `apple_id` column on `users`.

**Transition:** Frontend may hold both a Firebase token (for unfinished features) and a JWT simultaneously during the migration period. Firebase Auth removed once all features are cut over.

---

## Storage (MinIO)

**Bucket structure:**
```
realwise-attachments/
└── {client_id}/{user_id}/{import_id}/statement.pdf
```

MinIO never exposed directly to browsers. All access proxied through NestJS `storage` module.

**Upload flow:**
1. Frontend requests presigned URL from `api.realwise.com.br/storage/upload`
2. NestJS validates JWT + enforces MIME type and file size limits
3. Returns presigned MinIO URL
4. Frontend uploads directly to MinIO using presigned URL
5. Object key stored in `attachments` table

**Download flow:**
1. Frontend requests `api.realwise.com.br/storage/download/{key}`
2. NestJS validates JWT + ownership
3. Returns short-lived presigned MinIO URL (5 min TTL)
4. Browser downloads directly from MinIO

**Firebase Storage migration:** One-time idempotent script at `infrastructure/scripts/migrate-storage.ts` — downloads all Firebase Storage objects, re-uploads to MinIO, updates `attachments` table object keys.

---

## Payments

**Primary:** Mercado Pago. Stripe remains (existing flows migrated, no new Stripe work).

```
payments/
├── mercadopago/
│   ├── mercadopago.service.ts   ← createPayment, checkPaymentStatus
│   └── mercadopago.webhook.ts   ← /webhooks/mercadopago
└── stripe/
    ├── stripe.service.ts        ← createCheckoutSession, createDiscountCheckout
    └── stripe.webhook.ts        ← /webhooks/stripe (raw body, bypasses JSON parser)
```

**Webhook security:**
- Stripe: `stripe.webhooks.constructEvent()` with raw request body
- Mercado Pago: `x-signature` header validation

**Landing page:** Checkout calls updated from Firebase Functions URLs to `api.realwise.com.br/payments/*`.

**Secrets:** `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Coolify secrets.

---

## Backups

**PostgreSQL:** Daily `pg_dump → gzip → Hetzner Storage Box`. Script at `infrastructure/scripts/backup-postgres.sh`, scheduled via host cron (survives container restarts).

**MinIO:** Daily `rclone sync → Hetzner Storage Box`.

**Retention:** 7 daily, 4 weekly, 6 monthly for both.

**Pre-deployment:** Backup runs via SSH in GitHub Actions before every production deploy.

**Restore target:** Under 5 minutes via Coolify previous-image rollback + latest backup.

---

## Monitoring

**Uptime Kuma checks:**
```
realwise.com.br              ← HTTP
api.realwise.com.br/health   ← HTTP
admin.realwise.com.br        ← HTTP
PostgreSQL                   ← TCP :5432
MinIO                        ← HTTP health endpoint
Redis                        ← TCP :6379
```

**Alerts:** Email via Umbler SMTP. Optional Telegram.

---

## Migration Timeline (9-week sprint)

| Week | Phase |
|------|-------|
| 1 | Infrastructure — Hetzner + Coolify + PostgreSQL + Redis + MinIO + Uptime Kuma |
| 2 | CI/CD — GitHub Actions + GHCR + Coolify webhooks + staging environment |
| 3 | Firestore → PostgreSQL data migration + Drizzle schema |
| 4 | Authentication — Passport.js + JWT, Firebase Auth bridge |
| 5 | Storage — MinIO + migration script |
| 6 | Functions → NestJS (transactions, bills, budgets, investments, planner) |
| 7 | Payments — Mercado Pago + Stripe + landing page cutover |
| 8 | Validation — Firebase in read-only mode, parallel run |
| 9 | Firebase decommission |

---

## Success Criteria

- [ ] PostgreSQL replaces Firestore
- [ ] Passport.js replaces Firebase Auth
- [ ] MinIO replaces Firebase Storage
- [ ] NestJS replaces all Cloud Functions
- [ ] NestJS Scheduler replaces Cloud Scheduler
- [ ] GitHub Actions deploys automatically on push to main
- [ ] GHCR stores all Docker images
- [ ] Backups run daily and have been tested with a restore
- [ ] Uptime Kuma monitors all services
- [ ] Firebase can be safely and completely removed
