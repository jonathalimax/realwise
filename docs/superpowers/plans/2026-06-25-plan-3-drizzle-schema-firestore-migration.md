# Plan 3: Drizzle Schema + Firestore Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Drizzle ORM in `apps/api`, define the full PostgreSQL schema for all Realwise tables, wire up automatic migration-on-start in the NestJS container, and build a one-time idempotent Firestore → PostgreSQL migration script covering both the jonathalimax tenant project and the central admin project.

**Architecture:** Schema files live in `apps/api/src/db/schema/` as individual TypeScript files per table, compiled and bundled into the Docker image. `main.ts` runs `drizzle migrate` before `NestFactory.create` so every deploy applies pending migrations automatically. The migration script at `infrastructure/scripts/migrate-firestore.ts` imports pure transform functions from `apps/api/src/db/migration/transforms.ts` (unit-tested with Vitest), then handles all Firebase and PostgreSQL I/O as a standalone `ts-node` CLI.

**Tech Stack:** `drizzle-orm` 0.44+, `drizzle-kit` 0.30+, `postgres` (postgres.js), `firebase-admin` 12+, `ts-node`, `dotenv`, Vitest (existing)

## Global Constraints

- Node ≥ 20, pnpm ≥ 9
- All tables: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- All tenant tables: `client_id varchar NOT NULL` (row-level isolation boundary)
- Amounts: `numeric(12,2)` — never `float` or `real`
- All enums defined with `pgEnum` in `apps/api/src/db/schema/enums.ts`
- `firebase_doc_id varchar UNIQUE` on every migrated table — nullable, null for rows created post-migration
- Migration script reads env vars from `infrastructure/migration/.env` (gitignored) or process environment
- Run `pnpm --filter @realwise/api <script>` for all api package commands
- Drizzle config at `apps/api/drizzle.config.ts` (package root, not inside `src/`)
- SQL migration files output to `apps/api/src/db/migrations/` — committed to git, compiled into `dist/db/migrations/` by NestJS build
- Migration auto-run in `main.ts` uses `path.join(__dirname, 'db/migrations')` — resolves to `dist/db/migrations/` at runtime

---

## File Map

### Created
- `apps/api/drizzle.config.ts` — drizzle-kit config
- `apps/api/nest-cli.json` — assets config to compile SQL migration files into dist/
- `apps/api/src/db/schema/enums.ts` — all `pgEnum` definitions
- `apps/api/src/db/schema/clients.ts`
- `apps/api/src/db/schema/users.ts`
- `apps/api/src/db/schema/accounts.ts`
- `apps/api/src/db/schema/categories.ts`
- `apps/api/src/db/schema/transactions.ts`
- `apps/api/src/db/schema/bills.ts`
- `apps/api/src/db/schema/bill-reminders.ts`
- `apps/api/src/db/schema/budgets.ts`
- `apps/api/src/db/schema/goals.ts`
- `apps/api/src/db/schema/investments.ts`
- `apps/api/src/db/schema/planner.ts`
- `apps/api/src/db/schema/settings.ts`
- `apps/api/src/db/schema/imports.ts`
- `apps/api/src/db/schema/attachments.ts`
- `apps/api/src/db/schema/categorization-rules.ts`
- `apps/api/src/db/schema/leads.ts`
- `apps/api/src/db/schema/purchases.ts`
- `apps/api/src/db/schema/coupons.ts`
- `apps/api/src/db/schema/import-issues.ts`
- `apps/api/src/db/schema/index.ts` — barrel export
- `apps/api/src/db/migrations/` — drizzle-kit generated SQL (committed)
- `apps/api/src/db/drizzle.module.ts` — NestJS DrizzleModule (connection provider)
- `apps/api/src/db/migration/transforms.ts` — pure Firestore → row transform functions
- `apps/api/src/db/migration/transforms.test.ts` — Vitest unit tests
- `infrastructure/scripts/tsconfig.json` — ts-node config for migration script
- `infrastructure/scripts/migrate-firestore.ts` — migration runner CLI
- `infrastructure/migration/clients.json` — maps clientId → credential file path
- `infrastructure/migration/credentials/.gitkeep` — marks gitignored credentials dir
- `infrastructure/migration/.env.example` — documents required env vars

### Modified
- `apps/api/package.json` — add deps + `migrate:generate`, `migrate:run`, `migrate:firestore` scripts
- `apps/api/src/app.module.ts` — import DrizzleModule
- `apps/api/src/main.ts` — run migrations before NestFactory.create
- `.gitignore` — add `infrastructure/migration/credentials/` and `infrastructure/migration/.env`

---

## Task 1: Install Drizzle dependencies + drizzle.config.ts

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/nest-cli.json`

**Interfaces:**
- Produces: `drizzle-kit generate` and `drizzle-kit migrate` commands available via npm scripts

- [ ] **Step 1: Add dependencies to apps/api/package.json**

Add to `dependencies`:
```json
"drizzle-orm": "^0.44.0",
"postgres": "^3.4.5",
"dotenv": "^16.4.7"
```

Add to `devDependencies`:
```json
"drizzle-kit": "^0.30.0",
"firebase-admin": "^12.7.0"
```

Add to `scripts`:
```json
"migrate:generate": "drizzle-kit generate",
"migrate:run": "drizzle-kit migrate",
"migrate:firestore": "ts-node --project ../../infrastructure/scripts/tsconfig.json ../../infrastructure/scripts/migrate-firestore.ts"
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm --filter @realwise/api install
```

Expected: packages installed, no peer dependency errors.

- [ ] **Step 3: Create apps/api/drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create apps/api/nest-cli.json**

NestJS must copy the SQL migration files into `dist/` during build — without this, the auto-run in `main.ts` will fail at runtime because `dist/db/migrations/` won't exist.

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "assets": [
      {
        "include": "db/migrations/**/*.sql",
        "outDir": "./dist"
      }
    ],
    "watchAssets": true
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/drizzle.config.ts apps/api/nest-cli.json
git commit -m "feat(api): install drizzle-orm, drizzle-kit, postgres deps"
```

---

## Task 2: Schema enums

**Files:**
- Create: `apps/api/src/db/schema/enums.ts`

**Interfaces:**
- Produces: all `pgEnum` exports used by table files — `userRoleEnum`, `accountTypeEnum`, `transactionTypeEnum`, `billStatusEnum`, `recurrenceTypeEnum`, `budgetPeriodEnum`, `importStatusEnum`, `investmentTypeEnum`

- [ ] **Step 1: Create apps/api/src/db/schema/enums.ts**

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit',
  'investment',
  'wallet',
]);

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense']);

export const billStatusEnum = pgEnum('bill_status', ['pending', 'paid', 'overdue']);

export const recurrenceTypeEnum = pgEnum('recurrence_type', ['monthly', 'weekly', 'yearly']);

export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'weekly', 'yearly']);

export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'processing',
  'review',
  'complete',
  'failed',
]);

export const investmentTypeEnum = pgEnum('investment_type', [
  'stock',
  'fii',
  'etf',
  'fixed',
  'crypto',
  'other',
]);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/schema/enums.ts
git commit -m "feat(api): add drizzle schema enums"
```

---

## Task 3: Schema — clients + users tables

**Files:**
- Create: `apps/api/src/db/schema/clients.ts`
- Create: `apps/api/src/db/schema/users.ts`

**Interfaces:**
- Consumes: `userRoleEnum` from `./enums`
- Produces: `clients` table (PK `id`, natural key `slug`), `users` table (PK `id`, unique `(client_id, email)`, `firebase_uid`, `apple_id`)

- [ ] **Step 1: Create apps/api/src/db/schema/clients.ts**

```typescript
import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug').unique().notNull(),
  firebaseConfig: jsonb('firebase_config'),
  features: jsonb('features'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create apps/api/src/db/schema/users.ts**

```typescript
import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    email: varchar('email').notNull(),
    name: varchar('name'),
    firebaseUid: varchar('firebase_uid').unique(),
    appleId: varchar('apple_id').unique(),
    role: userRoleEnum('role').default('user').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_client_email_idx').on(table.clientId, table.email),
  ],
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/schema/clients.ts apps/api/src/db/schema/users.ts
git commit -m "feat(api): add clients and users drizzle schema"
```

---

## Task 4: Schema — accounts, categories, transactions

**Files:**
- Create: `apps/api/src/db/schema/accounts.ts`
- Create: `apps/api/src/db/schema/categories.ts`
- Create: `apps/api/src/db/schema/transactions.ts`

**Interfaces:**
- Consumes: `accountTypeEnum`, `transactionTypeEnum` from `./enums`; `users` from `./users`
- Produces: `accounts`, `categories`, `transactions` tables with `firebase_doc_id UNIQUE`

- [ ] **Step 1: Create apps/api/src/db/schema/accounts.ts**

```typescript
import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { accountTypeEnum } from './enums';
import { users } from './users';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  type: accountTypeEnum('type'),
  color: varchar('color'),
  icon: varchar('icon'),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create apps/api/src/db/schema/categories.ts**

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { transactionTypeEnum } from './enums';
import { users } from './users';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  color: varchar('color'),
  icon: varchar('icon'),
  type: transactionTypeEnum('type'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Create apps/api/src/db/schema/transactions.ts**

```typescript
import { pgTable, uuid, varchar, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { transactionTypeEnum } from './enums';
import { users } from './users';
import { categories } from './categories';
import { accounts } from './accounts';

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  description: varchar('description'),
  date: date('date').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  accountId: uuid('account_id').references(() => accounts.id),
  importId: uuid('import_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/schema/accounts.ts apps/api/src/db/schema/categories.ts apps/api/src/db/schema/transactions.ts
git commit -m "feat(api): add accounts, categories, transactions drizzle schema"
```

---

## Task 5: Schema — bills, bill-reminders, budgets, goals

**Files:**
- Create: `apps/api/src/db/schema/bills.ts`
- Create: `apps/api/src/db/schema/bill-reminders.ts`
- Create: `apps/api/src/db/schema/budgets.ts`
- Create: `apps/api/src/db/schema/goals.ts`

**Interfaces:**
- Consumes: `billStatusEnum`, `recurrenceTypeEnum`, `budgetPeriodEnum` from `./enums`; `users`, `categories`
- Produces: `bills`, `billReminders`, `budgets`, `goals` tables

- [ ] **Step 1: Create apps/api/src/db/schema/bills.ts**

```typescript
import { pgTable, uuid, varchar, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { billStatusEnum, recurrenceTypeEnum } from './enums';
import { users } from './users';
import { categories } from './categories';

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: billStatusEnum('status').default('pending'),
  recurrence: recurrenceTypeEnum('recurrence'),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create apps/api/src/db/schema/bill-reminders.ts**

`bill_reminders` holds both scheduled (unsent) reminders and audit records (rows from Firestore `reminder_logs`, inserted with `sent: true`). `updated_at` is present because reminders can be rescheduled.

```typescript
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { bills } from './bills';

export const billReminders = pgTable('bill_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  billId: uuid('bill_id').notNull().references(() => bills.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  sent: boolean('sent').default(false).notNull(),
  sentVia: varchar('sent_via'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Create apps/api/src/db/schema/budgets.ts**

```typescript
import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { budgetPeriodEnum } from './enums';
import { users } from './users';
import { categories } from './categories';

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  period: budgetPeriodEnum('period'),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 4: Create apps/api/src/db/schema/goals.ts**

```typescript
import { pgTable, uuid, varchar, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 12, scale: 2 }).default('0'),
  deadline: date('deadline'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/bills.ts apps/api/src/db/schema/bill-reminders.ts apps/api/src/db/schema/budgets.ts apps/api/src/db/schema/goals.ts
git commit -m "feat(api): add bills, bill-reminders, budgets, goals drizzle schema"
```

---

## Task 6: Schema — investments, planner, settings, imports, attachments, categorization-rules

**Files:**
- Create: `apps/api/src/db/schema/investments.ts`
- Create: `apps/api/src/db/schema/planner.ts`
- Create: `apps/api/src/db/schema/settings.ts`
- Create: `apps/api/src/db/schema/imports.ts`
- Create: `apps/api/src/db/schema/attachments.ts`
- Create: `apps/api/src/db/schema/categorization-rules.ts`

**Interfaces:**
- Consumes: `investmentTypeEnum`, `importStatusEnum` from `./enums`; `users`, `categories`, `imports`
- Produces: remaining tenant tables, all with `firebase_doc_id UNIQUE`; `planner` and `settings` with `UNIQUE (client_id, user_id)`

- [ ] **Step 1: Create apps/api/src/db/schema/investments.ts**

```typescript
import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { investmentTypeEnum } from './enums';
import { users } from './users';

export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  ticker: varchar('ticker'),
  name: varchar('name').notNull(),
  type: investmentTypeEnum('type').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }),
  avgPrice: numeric('avg_price', { precision: 12, scale: 2 }),
  currentPrice: numeric('current_price', { precision: 12, scale: 2 }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create apps/api/src/db/schema/planner.ts**

```typescript
import { pgTable, uuid, varchar, numeric, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const planner = pgTable(
  'planner',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    salaryGross: numeric('salary_gross', { precision: 12, scale: 2 }),
    deductions: jsonb('deductions'),
    allocations: jsonb('allocations'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('planner_client_user_idx').on(table.clientId, table.userId),
  ],
);
```

- [ ] **Step 3: Create apps/api/src/db/schema/settings.ts**

```typescript
import { pgTable, uuid, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const settings = pgTable(
  'settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    currency: varchar('currency').default('BRL').notNull(),
    language: varchar('language').default('pt-BR').notNull(),
    darkMode: boolean('dark_mode').default(false).notNull(),
    billReminders: boolean('bill_reminders').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('settings_client_user_idx').on(table.clientId, table.userId),
  ],
);
```

- [ ] **Step 4: Create apps/api/src/db/schema/imports.ts**

```typescript
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { importStatusEnum } from './enums';
import { users } from './users';

export const imports = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  bank: varchar('bank'),
  status: importStatusEnum('status').default('pending'),
  rowCount: integer('row_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 5: Create apps/api/src/db/schema/attachments.ts**

```typescript
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { imports } from './imports';

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  importId: uuid('import_id').references(() => imports.id),
  objectKey: varchar('object_key').notNull(),
  mimeType: varchar('mime_type'),
  sizeBytes: integer('size_bytes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 6: Create apps/api/src/db/schema/categorization-rules.ts**

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { categories } from './categories';

export const categorizationRules = pgTable('categorization_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  keyword: varchar('keyword').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/schema/investments.ts apps/api/src/db/schema/planner.ts apps/api/src/db/schema/settings.ts apps/api/src/db/schema/imports.ts apps/api/src/db/schema/attachments.ts apps/api/src/db/schema/categorization-rules.ts
git commit -m "feat(api): add investments, planner, settings, imports, attachments, categorization-rules drizzle schema"
```

---

## Task 7: Schema — admin tables (leads, purchases, coupons, import-issues)

**Files:**
- Create: `apps/api/src/db/schema/leads.ts`
- Create: `apps/api/src/db/schema/purchases.ts`
- Create: `apps/api/src/db/schema/coupons.ts`
- Create: `apps/api/src/db/schema/import-issues.ts`

**Interfaces:**
- Produces: admin tables with no `client_id` tenant scoping (cross-client, admin-role access only)

- [ ] **Step 1: Create apps/api/src/db/schema/leads.ts**

```typescript
import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  email: varchar('email').notNull(),
  name: varchar('name'),
  plan: varchar('plan'),
  status: varchar('status').default('new'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Create apps/api/src/db/schema/purchases.ts**

```typescript
import { pgTable, uuid, varchar, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  clientId: varchar('client_id').notNull(),
  email: varchar('email').notNull(),
  plan: varchar('plan'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  status: varchar('status').default('pending'),
  paymentProvider: varchar('payment_provider'),
  providerPaymentId: varchar('provider_payment_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Create apps/api/src/db/schema/coupons.ts**

```typescript
import { pgTable, uuid, varchar, numeric, integer, timestamp } from 'drizzle-orm/pg-core';

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  code: varchar('code').unique().notNull(),
  discountType: varchar('discount_type'),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 4: Create apps/api/src/db/schema/import-issues.ts**

```typescript
import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const importIssues = pgTable('import_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id'),
  importId: uuid('import_id'),
  description: text('description'),
  status: varchar('status').default('open'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/leads.ts apps/api/src/db/schema/purchases.ts apps/api/src/db/schema/coupons.ts apps/api/src/db/schema/import-issues.ts
git commit -m "feat(api): add admin tables drizzle schema (leads, purchases, coupons, import-issues)"
```

---

## Task 8: Schema barrel + generate migrations

**Files:**
- Create: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/src/db/migrations/` (generated by drizzle-kit)

**Interfaces:**
- Produces: `apps/api/src/db/schema/index.ts` exporting all tables and enums; committed SQL migration files in `apps/api/src/db/migrations/`

- [ ] **Step 1: Create apps/api/src/db/schema/index.ts**

```typescript
export * from './enums';
export * from './clients';
export * from './users';
export * from './accounts';
export * from './categories';
export * from './transactions';
export * from './bills';
export * from './bill-reminders';
export * from './budgets';
export * from './goals';
export * from './investments';
export * from './planner';
export * from './settings';
export * from './imports';
export * from './attachments';
export * from './categorization-rules';
export * from './leads';
export * from './purchases';
export * from './coupons';
export * from './import-issues';
```

- [ ] **Step 2: Set DATABASE_URL and generate migrations**

You need a running PostgreSQL instance. The simplest approach is the staging DB on the Hetzner VPS, or run one locally:

```bash
# Option A — use staging DB (already running on VPS via Coolify)
export DATABASE_URL="postgres://user:pass@your-staging-host:5432/realwise"

# Option B — run locally with Docker
docker run -d --name pg-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=realwise -p 5432:5432 postgres:16
export DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise"
```

Then generate:

```bash
pnpm --filter @realwise/api migrate:generate
```

Expected output:
```
Your SQL migration file ➜ src/db/migrations/0000_<hash>_init.sql
```

If you see TypeScript errors instead, check that all imports between schema files resolve correctly (circular deps between `transactions → imports` can be resolved by keeping `importId` as a plain `uuid()` with no `.references()` in `transactions.ts` for now — add the FK in a later migration once both tables exist).

- [ ] **Step 3: Verify the generated SQL looks correct**

```bash
cat apps/api/src/db/migrations/0000_*.sql | head -60
```

Expected: SQL `CREATE TABLE` statements for all 20 tables, `CREATE TYPE` for all enums, no syntax errors.

- [ ] **Step 4: Commit schema barrel and generated migrations**

```bash
git add apps/api/src/db/schema/index.ts apps/api/src/db/migrations/
git commit -m "feat(api): add schema barrel export and initial drizzle migrations"
```

---

## Task 9: DrizzleModule + migration auto-run in main.ts

**Files:**
- Create: `apps/api/src/db/drizzle.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Consumes: `drizzle-orm/postgres-js`, `drizzle-orm/postgres-js/migrator`, `postgres`, `path`
- Produces: `DRIZZLE` provider injectable in NestJS modules; auto-migration before server start

- [ ] **Step 1: Create apps/api/src/db/drizzle.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

const DrizzleProvider = {
  provide: DRIZZLE,
  useFactory: () => {
    const client = postgres(process.env.DATABASE_URL!);
    return drizzle(client, { schema });
  },
};

@Module({
  providers: [DrizzleProvider],
  exports: [DrizzleProvider],
})
export class DrizzleModule {}
```

- [ ] **Step 2: Modify apps/api/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';

@Module({ imports: [HealthModule, DrizzleModule] })
export class AppModule {}
```

- [ ] **Step 3: Modify apps/api/src/main.ts**

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);
  await migrate(db, { migrationsFolder: path.join(__dirname, 'db/migrations') });
  await migrationClient.end();

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}
bootstrap();
```

- [ ] **Step 4: Verify the API builds**

```bash
pnpm --filter @realwise/api build
```

Expected: `dist/` created, no TypeScript errors, `dist/db/migrations/*.sql` present (copied by nest-cli assets).

- [ ] **Step 5: Verify the API starts and runs migrations**

With `DATABASE_URL` set to a running PostgreSQL:

```bash
DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" pnpm --filter @realwise/api start
```

Expected log output includes:
```
API running on port 3001
```

No error about missing migration files. Connect to PostgreSQL and verify tables exist:

```bash
docker exec -it pg-dev psql -U postgres -d realwise -c "\dt"
```

Expected: all 20 tables listed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/drizzle.module.ts apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): add DrizzleModule and migration auto-run on container start"
```

---

## Task 10: Migration script infrastructure

**Files:**
- Create: `infrastructure/scripts/tsconfig.json`
- Create: `infrastructure/migration/clients.json`
- Create: `infrastructure/migration/credentials/.gitkeep`
- Create: `infrastructure/migration/.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: migration credentials directory, client config, env var documentation; ts-node can compile the migration script using api tsconfig settings

- [ ] **Step 1: Create infrastructure/scripts/tsconfig.json**

This tells ts-node how to compile the migration script, reusing the same compiler options as the api package:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "resolveJsonModule": true
  },
  "include": [
    "./**/*.ts",
    "../../apps/api/src/db/**/*.ts"
  ]
}
```

- [ ] **Step 2: Create infrastructure/migration/clients.json**

```json
{
  "jonathalimax": "./credentials/jonathalimax.json",
  "admin": "./credentials/admin.json"
}
```

- [ ] **Step 3: Create infrastructure/migration/credentials/.gitkeep**

Empty file — just marks the directory.

- [ ] **Step 4: Create infrastructure/migration/.env.example**

```bash
# PostgreSQL connection — point at staging first, never prod without a backup
DATABASE_URL=postgres://user:password@host:5432/realwise

# Set to "true" for production/staging connections that require SSL
DATABASE_SSL=false
```

- [ ] **Step 5: Update .gitignore**

Add to `.gitignore`:

```
infrastructure/migration/credentials/
infrastructure/migration/.env
```

- [ ] **Step 6: Commit**

```bash
git add infrastructure/scripts/tsconfig.json infrastructure/migration/clients.json infrastructure/migration/credentials/.gitkeep infrastructure/migration/.env.example .gitignore
git commit -m "feat: add migration script infrastructure (tsconfig, client config, env docs)"
```

---

## Task 11: Transform functions + Vitest tests

**Files:**
- Create: `apps/api/src/db/migration/transforms.ts`
- Create: `apps/api/src/db/migration/transforms.test.ts`

**Interfaces:**
- Produces: one exported `transform*` function per Firestore collection. Each takes `(docId: string, data: Record<string, any>, clientId: string)` and returns the corresponding PostgreSQL row insert shape. These are called by the migration runner in Task 12.

- [ ] **Step 1: Write the failing tests first**

Create `apps/api/src/db/migration/transforms.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  transformUser,
  transformAccount,
  transformCategory,
  transformTransaction,
  transformBill,
  transformBillReminder,
  transformReminderLog,
  transformBudget,
  transformGoal,
  transformInvestment,
  transformPlanner,
  transformSettings,
  transformCategorizationRule,
  transformImport,
  transformLead,
  transformPurchase,
  transformCoupon,
  transformImportIssue,
} from './transforms';

const CLIENT = 'jonathalimax';
const USER_UUID = '00000000-0000-0000-0000-000000000001';

describe('transformUser', () => {
  it('maps Firestore user to users row', () => {
    const result = transformUser('firebase-uid-abc', {
      email: 'test@example.com',
      name: 'Test User',
    }, CLIENT);
    expect(result).toEqual({
      clientId: CLIENT,
      email: 'test@example.com',
      name: 'Test User',
      firebaseUid: 'firebase-uid-abc',
      role: 'user',
    });
  });

  it('handles missing name', () => {
    const result = transformUser('uid', { email: 'x@x.com' }, CLIENT);
    expect(result.name).toBeNull();
  });
});

describe('transformAccount', () => {
  it('maps Firestore userBanks doc to accounts row', () => {
    const result = transformAccount('doc-id-1', {
      name: 'Nubank',
      type: 'credit',
      color: '#820AD1',
      icon: 'credit-card',
      balance: 1500.5,
    }, CLIENT, USER_UUID);
    expect(result).toEqual({
      clientId: CLIENT,
      userId: USER_UUID,
      firebaseDocId: 'doc-id-1',
      name: 'Nubank',
      type: 'credit',
      color: '#820AD1',
      icon: 'credit-card',
      balance: '1500.5',
    });
  });
});

describe('transformBillReminder', () => {
  it('maps bill_reminders doc with sent: false', () => {
    const result = transformBillReminder('doc-1', {
      billId: 'bill-uuid',
      remindAt: { toDate: () => new Date('2026-07-01T09:00:00Z') },
      sent: false,
    }, CLIENT, USER_UUID);
    expect(result.sent).toBe(false);
    expect(result.remindAt).toBeInstanceOf(Date);
  });
});

describe('transformReminderLog', () => {
  it('maps reminder_logs doc to bill_reminders row with sent: true', () => {
    const result = transformReminderLog('log-1', {
      billId: 'bill-uuid',
      sentAt: { toDate: () => new Date('2026-06-01T09:00:00Z') },
      sentVia: 'email',
    }, CLIENT, USER_UUID);
    expect(result.sent).toBe(true);
    expect(result.sentVia).toBe('email');
  });
});

describe('transformLead', () => {
  it('maps leads doc to leads row (no clientId)', () => {
    const result = transformLead('lead-1', {
      email: 'lead@example.com',
      name: 'Potential User',
      plan: 'pro',
      status: 'new',
    });
    expect(result).toEqual({
      firebaseDocId: 'lead-1',
      email: 'lead@example.com',
      name: 'Potential User',
      plan: 'pro',
      status: 'new',
      metadata: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run apps/api/src/db/migration/transforms.test.ts
```

Expected: FAIL — `Cannot find module './transforms'`

- [ ] **Step 3: Implement transforms.ts**

Create `apps/api/src/db/migration/transforms.ts`:

```typescript
type Row = Record<string, unknown>;

function toDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate() as Date;
  if (val instanceof Date) return val;
  return new Date(val as string);
}

function toNumericString(val: any): string | null {
  if (val === undefined || val === null) return null;
  return String(val);
}

export function transformUser(docId: string, data: Row, clientId: string) {
  return {
    clientId,
    email: data.email as string,
    name: (data.name as string) ?? null,
    firebaseUid: docId,
    role: 'user' as const,
  };
}

export function transformAccount(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    type: (data.type as string) ?? null,
    color: (data.color as string) ?? null,
    icon: (data.icon as string) ?? null,
    balance: toNumericString(data.balance),
  };
}

export function transformCategory(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    color: (data.color as string) ?? null,
    icon: (data.icon as string) ?? null,
    type: (data.type as string) ?? null,
  };
}

export function transformTransaction(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    amount: toNumericString(data.amount)!,
    type: data.type as string,
    description: (data.description as string) ?? null,
    date: data.date ? String(data.date).slice(0, 10) : null,
    categoryId: (data.categoryId as string) ?? null,
    accountId: (data.bankId as string) ?? (data.accountId as string) ?? null,
    importId: (data.importId as string) ?? null,
  };
}

export function transformBill(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    amount: toNumericString(data.amount)!,
    dueDate: String(data.dueDate).slice(0, 10),
    status: (data.status as string) ?? 'pending',
    recurrence: (data.recurrence as string) ?? null,
    categoryId: (data.categoryId as string) ?? null,
  };
}

export function transformBillReminder(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    billId: data.billId as string,
    remindAt: toDate(data.remindAt)!,
    sent: (data.sent as boolean) ?? false,
    sentVia: (data.sentVia as string) ?? null,
  };
}

export function transformReminderLog(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: `log_${docId}`,
    billId: data.billId as string,
    remindAt: toDate(data.sentAt) ?? toDate(data.remindAt) ?? new Date(),
    sent: true,
    sentVia: (data.sentVia as string) ?? null,
  };
}

export function transformBudget(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    amount: toNumericString(data.amount)!,
    period: (data.period as string) ?? null,
    categoryId: (data.categoryId as string) ?? null,
  };
}

export function transformGoal(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    targetAmount: toNumericString(data.targetAmount)!,
    currentAmount: toNumericString(data.currentAmount) ?? '0',
    deadline: data.deadline ? String(data.deadline).slice(0, 10) : null,
  };
}

export function transformInvestment(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    ticker: (data.ticker as string) ?? null,
    name: data.name as string,
    type: (data.type as string) ?? 'other',
    quantity: toNumericString(data.quantity),
    avgPrice: toNumericString(data.avgPrice),
    currentPrice: toNumericString(data.currentPrice),
    lastSyncedAt: toDate(data.lastSyncedAt),
  };
}

export function transformPlanner(data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    salaryGross: toNumericString(data.salarioBruto ?? data.salaryGross),
    deductions: (data.salarioDeductions ?? data.deductions ?? null) as object | null,
    allocations: (data.allocations ?? null) as object | null,
  };
}

export function transformSettings(data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    currency: (data.currency as string) ?? 'BRL',
    language: (data.language as string) ?? 'pt-BR',
    darkMode: (data.darkMode as boolean) ?? false,
    billReminders: (data.billReminders as boolean) ?? true,
  };
}

export function transformCategorizationRule(
  docId: string,
  data: Row,
  clientId: string,
  userId: string,
) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    keyword: data.keyword as string,
    categoryId: (data.categoryId as string) ?? null,
  };
}

export function transformImport(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    bank: (data.bank as string) ?? null,
    status: (data.status as string) ?? 'complete',
    rowCount: (data.rowCount as number) ?? null,
  };
}

export function transformLead(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    email: data.email as string,
    name: (data.name as string) ?? null,
    plan: (data.plan as string) ?? null,
    status: (data.status as string) ?? 'new',
    metadata: (data.metadata as object) ?? null,
  };
}

export function transformPurchase(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    clientId: (data.clientId as string) ?? (data.tenantId as string) ?? '',
    email: data.email as string,
    plan: (data.plan as string) ?? null,
    amount: toNumericString(data.amount),
    status: (data.status as string) ?? 'pending',
    paymentProvider: (data.paymentProvider as string) ?? null,
    providerPaymentId: (data.providerPaymentId as string) ?? null,
    metadata: (data.metadata as object) ?? null,
  };
}

export function transformCoupon(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    code: data.code as string,
    discountType: (data.discountType as string) ?? null,
    discountValue: toNumericString(data.discountValue),
    maxUses: (data.maxUses as number) ?? null,
    useCount: (data.useCount as number) ?? 0,
    expiresAt: toDate(data.expiresAt),
  };
}

export function transformImportIssue(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    clientId: (data.clientId as string) ?? '',
    userId: (data.userId as string) ?? null,
    importId: (data.importId as string) ?? null,
    description: (data.description as string) ?? null,
    status: (data.status as string) ?? 'open',
    metadata: (data.metadata as object) ?? null,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run apps/api/src/db/migration/transforms.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migration/transforms.ts apps/api/src/db/migration/transforms.test.ts
git commit -m "feat(api): add migration transform functions with vitest coverage"
```

---

## Task 12: Migration script — tenant runner

**Files:**
- Create: `infrastructure/scripts/migrate-firestore.ts`

**Interfaces:**
- Consumes: all `transform*` functions from `../../apps/api/src/db/migration/transforms`; all Drizzle table objects from `../../apps/api/src/db/schema`
- Produces: idempotent Firestore → PostgreSQL migration for all tenant collections; summary table printed to stdout

- [ ] **Step 1: Create infrastructure/scripts/migrate-firestore.ts**

```typescript
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

dotenv.config({ path: path.resolve(__dirname, '../migration/.env') });

import {
  transformUser,
  transformAccount,
  transformCategory,
  transformTransaction,
  transformBill,
  transformBillReminder,
  transformReminderLog,
  transformBudget,
  transformGoal,
  transformInvestment,
  transformPlanner,
  transformSettings,
  transformCategorizationRule,
  transformImport,
  transformLead,
  transformPurchase,
  transformCoupon,
  transformImportIssue,
} from '../../apps/api/src/db/migration/transforms';

import {
  users,
  accounts,
  categories,
  transactions,
  bills,
  billReminders,
  budgets,
  goals,
  investments,
  planner,
  settings,
  categorizationRules,
  imports,
  leads,
  purchases,
  coupons,
  importIssues,
} from '../../apps/api/src/db/schema';

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const clientFlag = args.indexOf('--client');
const onlyClient = clientFlag !== -1 ? args[clientFlag + 1] : null;

// ─── DB connection ──────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is required');
  process.exit(1);
}

const ssl = process.env.DATABASE_SSL === 'true' ? true : false;
const sql = postgres(DATABASE_URL, { ssl });
const db = drizzle(sql);

// ─── Summary tracking ───────────────────────────────────────────────────────

type CollectionStats = { attempted: number; inserted: number; updated: number; errors: number };
const summary: Record<string, CollectionStats> = {};

function initStats(name: string) {
  summary[name] = { attempted: 0, inserted: 0, updated: 0, errors: 0 };
}

async function upsertRow<T extends Record<string, unknown>>(
  collectionName: string,
  table: any,
  row: T,
  conflictTarget: string[],
) {
  summary[collectionName].attempted++;
  try {
    const result = await db
      .insert(table)
      .values(row as any)
      .onConflictDoUpdate({
        target: conflictTarget.map((c) => (table as any)[c]),
        set: row as any,
      });
    if ((result as any).rowCount === 0) {
      summary[collectionName].updated++;
    } else {
      summary[collectionName].inserted++;
    }
  } catch (err) {
    summary[collectionName].errors++;
    console.warn(`  WARN [${collectionName}] doc error:`, (err as Error).message);
  }
}

// ─── Tenant migration ────────────────────────────────────────────────────────

async function migrateTenant(clientId: string, db_: ReturnType<typeof getFirestore>) {
  console.log(`\n→ Migrating tenant: ${clientId}`);

  // 1. Users — keyed by firebase uid (doc id)
  initStats('users');
  const userDocs = await db_.collection('users').get();
  const userIdMap: Record<string, string> = {};

  for (const doc of userDocs.docs) {
    const row = transformUser(doc.id, doc.data(), clientId);
    try {
      const inserted = await sql`
        INSERT INTO users ${sql(row as any)}
        ON CONFLICT (client_id, email) DO UPDATE SET
          firebase_uid = EXCLUDED.firebase_uid,
          name = EXCLUDED.name,
          updated_at = now()
        RETURNING id, firebase_uid
      `;
      userIdMap[doc.id] = inserted[0].id;
      summary['users'].attempted++;
      summary['users'].inserted++;
    } catch (err) {
      summary['users'].attempted++;
      summary['users'].errors++;
      console.warn(`  WARN [users] ${doc.id}:`, (err as Error).message);
    }
  }

  // Helper: resolve user UUID from firebase uid or userId field
  function resolveUserId(data: Record<string, any>): string {
    return userIdMap[data.userId as string] ?? userIdMap[data.uid as string] ?? '';
  }

  // 2. Accounts (userBanks)
  initStats('accounts');
  const accountDocs = await db_.collection('userBanks').get();
  for (const doc of accountDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['accounts'].errors++; continue; }
    await upsertRow('accounts', accounts, transformAccount(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 3. Categories
  initStats('categories');
  const catDocs = await db_.collection('categories').get();
  for (const doc of catDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['categories'].errors++; continue; }
    await upsertRow('categories', categories, transformCategory(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 4. Transactions
  initStats('transactions');
  const txDocs = await db_.collection('transactions').get();
  for (const doc of txDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['transactions'].errors++; continue; }
    await upsertRow('transactions', transactions, transformTransaction(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 5. Bills
  initStats('bills');
  const billDocs = await db_.collection('bills').get();
  for (const doc of billDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bills'].errors++; continue; }
    await upsertRow('bills', bills, transformBill(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 6. Bill reminders
  initStats('bill_reminders');
  const reminderDocs = await db_.collection('bill_reminders').get();
  for (const doc of reminderDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bill_reminders'].errors++; continue; }
    await upsertRow('bill_reminders', billReminders, transformBillReminder(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 7. Reminder logs (merged into bill_reminders with sent: true)
  const reminderLogs = await db_.collection('reminder_logs').get();
  for (const doc of reminderLogs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['bill_reminders'].errors++; continue; }
    await upsertRow('bill_reminders', billReminders, transformReminderLog(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 8. Budgets
  initStats('budgets');
  const budgetDocs = await db_.collection('budgets').get();
  for (const doc of budgetDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['budgets'].errors++; continue; }
    await upsertRow('budgets', budgets, transformBudget(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 9. Goals
  initStats('goals');
  const goalDocs = await db_.collection('goals').get();
  for (const doc of goalDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['goals'].errors++; continue; }
    await upsertRow('goals', goals, transformGoal(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 10. Investments
  initStats('investments');
  const invDocs = await db_.collection('investments').get();
  for (const doc of invDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['investments'].errors++; continue; }
    await upsertRow('investments', investments, transformInvestment(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 11. Planner (single doc per user)
  initStats('planner');
  const plannerDocs = await db_.collection('planner').get();
  for (const doc of plannerDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['planner'].errors++; continue; }
    await upsertRow('planner', planner, transformPlanner(doc.data(), clientId, userId), ['clientId', 'userId']);
  }

  // 12. Settings (single doc per user)
  initStats('settings');
  const settingsDocs = await db_.collection('settings').get();
  for (const doc of settingsDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['settings'].errors++; continue; }
    await upsertRow('settings', settings, transformSettings(doc.data(), clientId, userId), ['clientId', 'userId']);
  }

  // 13. Categorization rules
  initStats('categorization_rules');
  const ruleDocs = await db_.collection('userCategorizationRules').get();
  for (const doc of ruleDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['categorization_rules'].errors++; continue; }
    await upsertRow('categorization_rules', categorizationRules, transformCategorizationRule(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }

  // 14. Imports
  initStats('imports');
  const importDocs = await db_.collection('imports').get();
  for (const doc of importDocs.docs) {
    const userId = resolveUserId(doc.data());
    if (!userId) { summary['imports'].errors++; continue; }
    await upsertRow('imports', imports, transformImport(doc.id, doc.data(), clientId, userId), ['firebaseDocId']);
  }
}

// ─── Admin migration ─────────────────────────────────────────────────────────

async function migrateAdmin(db_: ReturnType<typeof getFirestore>) {
  console.log('\n→ Migrating admin collections');

  initStats('leads');
  const leadDocs = await db_.collection('leads').get();
  for (const doc of leadDocs.docs) {
    await upsertRow('leads', leads, transformLead(doc.id, doc.data()), ['firebaseDocId']);
  }

  initStats('purchases');
  const purchaseDocs = await db_.collection('purchases').get();
  for (const doc of purchaseDocs.docs) {
    await upsertRow('purchases', purchases, transformPurchase(doc.id, doc.data()), ['firebaseDocId']);
  }

  initStats('coupons');
  const couponDocs = await db_.collection('coupons').get();
  for (const doc of couponDocs.docs) {
    await upsertRow('coupons', coupons, transformCoupon(doc.id, doc.data()), ['firebaseDocId']);
  }

  initStats('import_issues');
  const issueDocs = await db_.collection('importIssues').get();
  for (const doc of issueDocs.docs) {
    await upsertRow('import_issues', importIssues, transformImportIssue(doc.id, doc.data()), ['firebaseDocId']);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const clientsConfigPath = path.resolve(__dirname, '../migration/clients.json');
  const clientsConfig: Record<string, string> = JSON.parse(
    fs.readFileSync(clientsConfigPath, 'utf8'),
  );

  const clientEntries = Object.entries(clientsConfig).filter(
    ([id]) => !onlyClient || id === onlyClient,
  );

  if (clientEntries.length === 0) {
    console.error(`No matching client found for --client ${onlyClient}`);
    process.exit(1);
  }

  for (const [clientId, credPath] of clientEntries) {
    const absoluteCredPath = path.resolve(path.dirname(clientsConfigPath), credPath);
    const serviceAccount = JSON.parse(fs.readFileSync(absoluteCredPath, 'utf8'));

    const existingApp = getApps().find((a) => a.name === clientId);
    if (existingApp) await deleteApp(existingApp);

    const app = initializeApp({ credential: cert(serviceAccount) }, clientId);
    const firestore = getFirestore(app);

    if (clientId === 'admin') {
      await migrateAdmin(firestore);
    } else {
      await migrateTenant(clientId, firestore);
    }

    await deleteApp(app);
  }

  // Print summary
  console.log('\n─── Migration Summary ─────────────────────────────────────');
  console.log(
    'Collection'.padEnd(30) + 'Attempted'.padEnd(12) + 'Inserted'.padEnd(12) + 'Updated'.padEnd(12) + 'Errors',
  );
  console.log('─'.repeat(72));
  let totalErrors = 0;
  for (const [name, stats] of Object.entries(summary)) {
    totalErrors += stats.errors;
    console.log(
      name.padEnd(30) +
        String(stats.attempted).padEnd(12) +
        String(stats.inserted).padEnd(12) +
        String(stats.updated).padEnd(12) +
        String(stats.errors),
    );
  }
  console.log('─'.repeat(72));

  await sql.end();

  if (totalErrors > 0) {
    console.error(`\n✖ Migration completed with ${totalErrors} errors`);
    process.exit(1);
  } else {
    console.log('\n✔ Migration completed successfully');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script compiles**

```bash
pnpm --filter @realwise/api exec ts-node --project ../../infrastructure/scripts/tsconfig.json --transpile-only ../../infrastructure/scripts/migrate-firestore.ts --help 2>&1 || true
```

Expected: the script starts executing (will exit with `DATABASE_URL env var is required` — that's correct, means it compiled successfully).

- [ ] **Step 3: Commit**

```bash
git add infrastructure/scripts/migrate-firestore.ts
git commit -m "feat: add Firestore → PostgreSQL migration script"
```

---

## Task 13: End-to-end verification

This task verifies the complete migration pipeline against real data.

- [ ] **Step 1: Copy service account credentials**

Place the jonathalimax Firebase service account JSON at:
```
infrastructure/migration/credentials/jonathalimax.json
```

Place the admin Firebase service account JSON at:
```
infrastructure/migration/credentials/admin.json
```

These files are gitignored. Download them from Firebase Console → Project Settings → Service Accounts → Generate New Private Key.

- [ ] **Step 2: Create infrastructure/migration/.env**

```bash
DATABASE_URL=postgres://postgres:dev@localhost:5432/realwise
DATABASE_SSL=false
```

Point at your **staging** DB first. Never run against production without a backup.

- [ ] **Step 3: Run the full migration**

```bash
pnpm --filter @realwise/api migrate:firestore
```

Expected: summary table printed with 0 errors. All collection rows show non-zero `attempted` counts.

- [ ] **Step 4: Verify idempotency — run again**

```bash
pnpm --filter @realwise/api migrate:firestore
```

Expected: all `inserted` counts are 0 (all rows already exist, only updates). 0 errors.

- [ ] **Step 5: Run the unit tests one final time**

```bash
npx vitest run apps/api/src/
```

Expected: all tests pass.

- [ ] **Step 6: Final commit**

```bash
git add infrastructure/migration/.env.example
git commit -m "chore: verify plan 3 complete — drizzle schema + firestore migration"
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | Drizzle deps, drizzle.config.ts, nest-cli.json |
| 2 | Schema enums |
| 3 | clients + users tables |
| 4 | accounts + categories + transactions tables |
| 5 | bills + bill-reminders + budgets + goals tables |
| 6 | investments + planner + settings + imports + attachments + categorization-rules tables |
| 7 | Admin tables (leads, purchases, coupons, import-issues) |
| 8 | Schema barrel + generated SQL migrations |
| 9 | DrizzleModule + migration auto-run in main.ts |
| 10 | Migration script infrastructure (tsconfig, client config, env docs) |
| 11 | Transform functions + Vitest tests |
| 12 | Full migration script (tenant + admin runners) |
| 13 | End-to-end verification against real Firestore data |
