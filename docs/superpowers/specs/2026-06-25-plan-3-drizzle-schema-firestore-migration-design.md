# Plan 3: Drizzle Schema + Firestore Migration — Design Spec
**Date:** 2026-06-25
**Phase:** Week 3 of 9-week Firebase → PostgreSQL migration (see `2026-06-23-infra-migration-design.md`)

---

## Goal

Install Drizzle ORM in `apps/api`, define the full PostgreSQL schema for all Realwise tables, and build a one-time idempotent Firestore → PostgreSQL migration script that covers both the `jonathalimax` tenant project and the central admin project.

---

## Scope

**In scope:**
- Drizzle ORM + drizzle-kit setup in `apps/api`
- Full schema definition (all tables from the infra design spec)
- Migration auto-run on container start
- Firestore export script (`infrastructure/migration/migrate-firestore.ts`)
- Both jonathalimax tenant data and central admin data

**Out of scope:**
- NestJS service/repository layer (Plan 4+)
- Auth cutover (Plan 4)
- Storage migration (Plan 5)
- Admin collections from any client other than the central admin project

---

## Repository Changes

### New files

```
apps/api/src/db/
├── schema/
│   ├── index.ts                  ← barrel export of all tables
│   ├── clients.ts                ← clients table (replaces public/clients/*.json)
│   ├── users.ts                  ← users + firebase_uid bridge + apple_id
│   ├── accounts.ts               ← replaces userBanks
│   ├── transactions.ts
│   ├── categories.ts
│   ├── budgets.ts
│   ├── goals.ts
│   ├── investments.ts
│   ├── planner.ts
│   ├── bills.ts
│   ├── bill-reminders.ts
│   ├── settings.ts
│   ├── imports.ts
│   ├── attachments.ts
│   ├── categorization-rules.ts
│   ├── leads.ts
│   ├── purchases.ts
│   ├── coupons.ts
│   └── import-issues.ts
├── migrations/                   ← drizzle-kit generated SQL files (committed)
└── drizzle.config.ts             ← drizzle-kit config pointing at src/db/schema/

infrastructure/
├── migration/
│   ├── clients.json              ← maps clientId → credential path
│   ├── credentials/              ← .gitignored, holds service account JSONs
│   │   └── .gitkeep
│   └── migrate-firestore.ts      ← standalone ts-node migration script
```

### Modified files

- `apps/api/package.json` — add `drizzle-orm`, `postgres`, `drizzle-kit`, `dotenv`, `firebase-admin`
- `apps/api/src/app.module.ts` — register `DrizzleModule` (connection only, no repositories yet)
- `apps/api/src/main.ts` — run pending migrations before `NestFactory.create`
- `.gitignore` — add `infrastructure/migration/credentials/`

---

## Drizzle Schema

### Conventions

- Primary keys: `uuid DEFAULT gen_random_uuid()`
- All tables: `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- All tenant tables: `client_id varchar NOT NULL` (row-level isolation boundary)
- Amounts: `numeric(12,2)` — never floats
- Enums defined with `pgEnum` and reused across tables

### Tables

#### `clients`
Replaces `public/clients/*.json`. Stores Firebase config + feature flags.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `slug` | varchar UNIQUE NOT NULL | e.g. `jonathalimax` |
| `firebase_config` | jsonb | temporary — removed when Firebase is decommissioned |
| `features` | jsonb | feature flags object |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | FK → clients.slug |
| `email` | varchar NOT NULL | |
| `name` | varchar | |
| `firebase_uid` | varchar UNIQUE | nullable — bridge for auth migration |
| `apple_id` | varchar UNIQUE | nullable — Apple Sign-In |
| `role` | `user_role` enum (`user`, `admin`) | DEFAULT `user` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

UNIQUE constraint on `(client_id, email)`.

#### `accounts` (replaces `userBanks`)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | FK → users.id |
| `firebase_doc_id` | varchar UNIQUE nullable | idempotency key — null for rows created after migration |
| `name` | varchar NOT NULL | |
| `type` | `account_type` enum | `checking \| savings \| credit \| investment \| wallet` |
| `color` | varchar | hex color |
| `icon` | varchar | icon identifier |
| `balance` | numeric(12,2) | DEFAULT 0 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `categories`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | FK → users.id |
| `name` | varchar NOT NULL | |
| `color` | varchar | |
| `icon` | varchar | |
| `type` | `transaction_type` enum | `income \| expense` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | FK → users.id |
| `firebase_doc_id` | varchar | idempotency key |
| `amount` | numeric(12,2) NOT NULL | |
| `type` | `transaction_type` enum | `income \| expense` |
| `description` | varchar | |
| `date` | date NOT NULL | |
| `category_id` | uuid | FK → categories.id, nullable |
| `account_id` | uuid | FK → accounts.id, nullable |
| `import_id` | uuid | FK → imports.id, nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `bills`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | FK → users.id |
| `firebase_doc_id` | varchar | idempotency key |
| `name` | varchar NOT NULL | |
| `amount` | numeric(12,2) NOT NULL | |
| `due_date` | date NOT NULL | |
| `status` | `bill_status` enum | `pending \| paid \| overdue` |
| `recurrence` | `recurrence_type` enum | `monthly \| weekly \| yearly`, nullable |
| `category_id` | uuid | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `bill_reminders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `bill_id` | uuid NOT NULL | FK → bills.id |
| `firebase_doc_id` | varchar | |
| `remind_at` | timestamptz NOT NULL | |
| `sent` | boolean DEFAULT false | |
| `sent_via` | varchar | `email \| push` |
| `created_at` | timestamptz | |

#### `budgets`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `firebase_doc_id` | varchar | |
| `name` | varchar NOT NULL | |
| `amount` | numeric(12,2) NOT NULL | |
| `period` | `budget_period` enum | `monthly \| weekly \| yearly` |
| `category_id` | uuid | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `goals`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `firebase_doc_id` | varchar | |
| `name` | varchar NOT NULL | |
| `target_amount` | numeric(12,2) NOT NULL | |
| `current_amount` | numeric(12,2) DEFAULT 0 | |
| `deadline` | date | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `investments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `firebase_doc_id` | varchar | |
| `ticker` | varchar | B3 ticker, nullable for manual |
| `name` | varchar NOT NULL | |
| `type` | varchar NOT NULL | `stock \| fii \| etf \| fixed \| crypto \| other` |
| `quantity` | numeric(18,8) | |
| `avg_price` | numeric(12,2) | |
| `current_price` | numeric(12,2) | |
| `last_synced_at` | timestamptz | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `planner`
Single row per `(client_id, user_id)` — upsert pattern.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `salary_gross` | numeric(12,2) | |
| `deductions` | jsonb | array of `{ name, amount, type }` |
| `allocations` | jsonb | allocation percentages |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

UNIQUE on `(client_id, user_id)`.

#### `settings`
Single row per `(client_id, user_id)` — upsert pattern.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `currency` | varchar DEFAULT `BRL` | |
| `language` | varchar DEFAULT `pt-BR` | |
| `dark_mode` | boolean DEFAULT false | |
| `bill_reminders` | boolean DEFAULT true | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

UNIQUE on `(client_id, user_id)`.

#### `categorization_rules`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `firebase_doc_id` | varchar | |
| `keyword` | varchar NOT NULL | |
| `category_id` | uuid | FK → categories.id |
| `created_at` | timestamptz | |

#### `imports`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `firebase_doc_id` | varchar | |
| `bank` | varchar | detected bank name |
| `status` | `import_status` enum | `pending \| processing \| review \| complete \| failed` |
| `row_count` | integer | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `attachments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `client_id` | varchar NOT NULL | |
| `user_id` | uuid NOT NULL | |
| `import_id` | uuid | FK → imports.id, nullable |
| `object_key` | varchar NOT NULL | MinIO key |
| `mime_type` | varchar | |
| `size_bytes` | integer | |
| `created_at` | timestamptz | |

#### Admin tables (no `client_id`)

**`leads`**, **`purchases`**, **`coupons`**, **`import_issues`** — migrated from the central admin Firebase project. Schema mirrors existing Firestore document shape, stored as typed columns where stable, jsonb for flexible fields. All have `firebase_doc_id varchar` for idempotency.

---

## Migration Auto-Run on Container Start

`apps/api/src/main.ts` runs `migrate(db, { migrationsFolder: './migrations' })` (drizzle-kit's programmatic API) before `NestFactory.create`. This means every deploy automatically applies pending SQL migration files — no manual step.

`drizzle.config.ts` points `out` to `apps/api/src/db/migrations/` and `schema` to `apps/api/src/db/schema/index.ts`. Migration files are committed to git.

---

## Firestore Migration Script

**Location:** `infrastructure/migration/migrate-firestore.ts`
**Runtime:** `ts-node` (added as dev dep to monorepo root or `apps/api`)
**Invocation:**
```bash
pnpm --filter @realwise/api migrate:firestore
pnpm --filter @realwise/api migrate:firestore -- --client jonathalimax   # single client
```

### Client config (`infrastructure/migration/clients.json`)
```json
{
  "jonathalimax": "./credentials/jonathalimax.json",
  "admin": "./credentials/admin.json"
}
```

`infrastructure/migration/credentials/` is `.gitignored`. A `.gitkeep` marks the directory.

### Script flow

```
1. Parse --client flag (optional, defaults to all)
2. Read clients.json
3. For each matching entry:
   a. initializeApp({ credential: cert(serviceAccount) }, clientId)
   b. getFirestore(app)
   c. For each collection in scope:
      - getDocs() all documents
      - transform to PostgreSQL row shape
      - db.insert(...).onConflictDoUpdate(...)
   d. Log per-collection counts
4. Print summary table (collection | attempted | inserted | updated | skipped | errors)
5. Exit 0 if no errors, exit 1 if any errors
```

### Idempotency keys

| Table | Conflict target |
|-------|----------------|
| `users` | `(client_id, email)` |
| `accounts`, `transactions`, `bills`, `budgets`, `goals`, `investments`, `imports`, `categorization_rules`, `bill_reminders` | `(client_id, firebase_doc_id)` |
| `planner`, `settings` | `(client_id, user_id)` |
| `leads`, `purchases`, `coupons`, `import_issues` | `firebase_doc_id` |

### Error handling

Per-document try/catch. A malformed document logs a warning with its doc ID and is skipped — never aborts the run. Final summary shows error count per collection.

### Collections migrated

**Tenant project (jonathalimax):**
`users`, `userBanks` → `accounts`, `transactions`, `bills`, `bill_reminders`, `budgets`, `goals`, `investments`, `planner`, `settings`, `userCategorizationRules` → `categorization_rules`, `imports`, `reminder_logs` (inserted into `bill_reminders` with `sent: true`)

**Admin project:**
`leads`, `purchases`, `coupons`, `importIssues` → `import_issues`

---

## Success Criteria

- [ ] `drizzle-kit generate` produces valid SQL migration files for all tables
- [ ] `drizzle-kit migrate` runs cleanly against a fresh PostgreSQL instance
- [ ] NestJS container starts and auto-applies migrations before accepting requests
- [ ] Migration script runs to completion against jonathalimax Firestore with 0 errors
- [ ] Re-running the script produces 0 inserts and 0 errors (idempotency)
- [ ] `firebase_doc_id` present on all migrated rows for traceability
