# Plan 5: API Routes (Business Logic Endpoints)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all tenant business-logic REST endpoints — accounts, categories, transactions, bills, budgets, goals, investments, planner, and user settings — backed by the Drizzle/PostgreSQL schema from Plan 3, protected by the JWT auth from Plan 4.

**Architecture:** One NestJS module per resource (`AccountsModule`, `TransactionsModule`, etc.), each with a controller, service, and DTOs. Every service injects the `DRIZZLE` token and scopes all queries to `{ clientId, userId }` extracted from `@CurrentUser()` — cross-user data leakage is structurally impossible. A global `ValidationPipe` (added to `main.ts`) handles DTO validation. Singleton resources (planner, user settings) use upsert rather than create/delete.

**Tech Stack:** NestJS 10, Drizzle ORM (`drizzle-orm/pg-core`), `class-validator`, `class-transformer`, `@nestjs/mapped-types`, Jest (existing)

## Global Constraints

- Node ≥ 20, pnpm ≥ 9
- All npm script commands: `pnpm --filter @realwise/api <script>`
- All Jest test commands: `pnpm --filter @realwise/api test`
- Every route is behind the global `JwtAuthGuard` — no `@Public()` needed for business routes
- All queries filter by BOTH `clientId` AND `userId` from JWT — never trust user-provided IDs for scoping
- `numeric(12,2)` columns return as strings from postgres.js — return them as-is in JSON (don't parse to float)
- Return `404 NotFoundException` (not `403`) when a record exists but belongs to another user — don't leak existence
- DTOs use `class-validator` decorators; `ValidationPipe` is global with `{ whitelist: true, transform: true }`
- Update DTOs extend `PartialType(CreateDto)` from `@nestjs/mapped-types`
- Route prefix convention: `/accounts`, `/categories`, `/transactions`, `/bills`, `/budgets`, `/goals`, `/investments`, `/planner`, `/user-settings`
- `rtk` prefix on all CLI commands per project convention

---

## File Map

### Created
- `apps/api/src/accounts/dto/create-account.dto.ts`
- `apps/api/src/accounts/accounts.service.ts`
- `apps/api/src/accounts/accounts.service.spec.ts`
- `apps/api/src/accounts/accounts.controller.ts`
- `apps/api/src/accounts/accounts.module.ts`
- `apps/api/src/categories/dto/create-category.dto.ts`
- `apps/api/src/categories/categories.service.ts`
- `apps/api/src/categories/categories.service.spec.ts`
- `apps/api/src/categories/categories.controller.ts`
- `apps/api/src/categories/categories.module.ts`
- `apps/api/src/transactions/dto/create-transaction.dto.ts`
- `apps/api/src/transactions/dto/list-transactions.dto.ts`
- `apps/api/src/transactions/transactions.service.ts`
- `apps/api/src/transactions/transactions.service.spec.ts`
- `apps/api/src/transactions/transactions.controller.ts`
- `apps/api/src/transactions/transactions.module.ts`
- `apps/api/src/bills/dto/create-bill.dto.ts`
- `apps/api/src/bills/bills.service.ts`
- `apps/api/src/bills/bills.service.spec.ts`
- `apps/api/src/bills/bills.controller.ts`
- `apps/api/src/bills/bills.module.ts`
- `apps/api/src/budgets/dto/create-budget.dto.ts`
- `apps/api/src/budgets/budgets.service.ts`
- `apps/api/src/budgets/budgets.service.spec.ts`
- `apps/api/src/budgets/budgets.controller.ts`
- `apps/api/src/budgets/budgets.module.ts`
- `apps/api/src/goals/dto/create-goal.dto.ts`
- `apps/api/src/goals/goals.service.ts`
- `apps/api/src/goals/goals.service.spec.ts`
- `apps/api/src/goals/goals.controller.ts`
- `apps/api/src/goals/goals.module.ts`
- `apps/api/src/investments/dto/create-investment.dto.ts`
- `apps/api/src/investments/investments.service.ts`
- `apps/api/src/investments/investments.service.spec.ts`
- `apps/api/src/investments/investments.controller.ts`
- `apps/api/src/investments/investments.module.ts`
- `apps/api/src/planner/dto/upsert-planner.dto.ts`
- `apps/api/src/planner/planner.service.ts`
- `apps/api/src/planner/planner.service.spec.ts`
- `apps/api/src/planner/planner.controller.ts`
- `apps/api/src/planner/planner.module.ts`
- `apps/api/src/user-settings/dto/upsert-user-settings.dto.ts`
- `apps/api/src/user-settings/user-settings.service.ts`
- `apps/api/src/user-settings/user-settings.service.spec.ts`
- `apps/api/src/user-settings/user-settings.controller.ts`
- `apps/api/src/user-settings/user-settings.module.ts`

### Modified
- `apps/api/package.json` — add `class-validator`, `class-transformer`, `@nestjs/mapped-types`
- `apps/api/src/main.ts` — add global `ValidationPipe`
- `apps/api/src/app.module.ts` — import all new modules

---

## Task 1: Install validation deps + enable global ValidationPipe

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Produces: `class-validator` decorators usable in all DTOs; global pipe that strips unknown fields and transforms types

- [ ] **Step 1: Add dependencies to apps/api/package.json**

In `dependencies`, add:
```json
"class-validator": "^0.14.1",
"class-transformer": "^0.5.1",
"@nestjs/mapped-types": "^2.0.5"
```

- [ ] **Step 2: Install**

```bash
pnpm --filter @realwise/api install
```

Expected: packages installed, no peer dependency errors.

- [ ] **Step 3: Add global ValidationPipe in apps/api/src/main.ts**

Replace the existing `main.ts` with:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as path from 'path';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
dotenv.config();

async function bootstrap() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);
  await migrate(db, { migrationsFolder: path.join(__dirname, 'db/migrations') });
  await migrationClient.end();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}
bootstrap();
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
pnpm --filter @realwise/api build
```

Expected: `dist/` created, zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/main.ts
git commit -m "feat(api): install class-validator, add global ValidationPipe"
```

---

## Task 2: Accounts module

Maps to the `accounts` table (was `userBanks` in Firestore). Routes: `GET /accounts`, `POST /accounts`, `PATCH /accounts/:id`, `DELETE /accounts/:id`.

**Files:**
- Create: `apps/api/src/accounts/dto/create-account.dto.ts`
- Create: `apps/api/src/accounts/accounts.service.ts`
- Create: `apps/api/src/accounts/accounts.service.spec.ts`
- Create: `apps/api/src/accounts/accounts.controller.ts`
- Create: `apps/api/src/accounts/accounts.module.ts`

**Interfaces:**
- Consumes: `DRIZZLE` token, `accounts` table from `../db/schema`, `@CurrentUser()` → `JwtPayload { sub, clientId }`
- Produces: `AccountsModule` exporting nothing (self-contained); routes available at `/accounts`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/accounts/dto/create-account.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['checking', 'savings', 'credit', 'investment', 'wallet'])
  type?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  balance?: string;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/accounts/accounts.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'uuid-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Nubank', type: 'credit', color: null, icon: null, balance: '0', createdAt: new Date(), updatedAt: new Date() };

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AccountsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(AccountsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns rows for the user', async () => {
    const result = await service.findAll('jonathalimax', 'user-1');
    expect(result).toEqual([mockRow]);
  });

  it('findOne returns row when found', async () => {
    const result = await service.findOne('uuid-1', 'jonathalimax', 'user-1');
    expect(result).toEqual(mockRow);
  });

  it('findOne throws NotFoundException when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('uuid-999', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    const result = await service.create({ name: 'Nubank', type: 'credit' }, 'jonathalimax', 'user-1');
    expect(result).toEqual(mockRow);
  });

  it('remove deletes the row', async () => {
    mockDb.where.mockResolvedValueOnce([mockRow]).mockResolvedValueOnce([]);
    await expect(service.remove('uuid-1', 'jonathalimax', 'user-1')).resolves.not.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=accounts.service
```

Expected: FAIL — `Cannot find module './accounts.service'`

- [ ] **Step 4: Implement AccountsService**

Create `apps/api/src/accounts/accounts.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { accounts } from '../db/schema';
import { CreateAccountDto, UpdateAccountDto } from './dto/create-account.dto';

type Account = typeof accounts.$inferSelect;

@Injectable()
export class AccountsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Account> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateAccountDto, clientId: string, userId: string): Promise<Account> {
    const rows = await this.db
      .insert(accounts)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateAccountDto, clientId: string, userId: string): Promise<Account> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(accounts)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.clientId, clientId), eq(accounts.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.clientId, clientId), eq(accounts.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=accounts.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create AccountsController and AccountsModule**

Create `apps/api/src/accounts/accounts.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/create-account.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/accounts/accounts.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/accounts/
git commit -m "feat(api): add accounts module (CRUD)"
```

---

## Task 3: Categories module

Routes: `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`.

**Files:**
- Create: `apps/api/src/categories/dto/create-category.dto.ts`
- Create: `apps/api/src/categories/categories.service.ts`
- Create: `apps/api/src/categories/categories.service.spec.ts`
- Create: `apps/api/src/categories/categories.controller.ts`
- Create: `apps/api/src/categories/categories.module.ts`

**Interfaces:**
- Consumes: `categories` table, `DRIZZLE`, `@CurrentUser()`
- Produces: `CategoriesModule`; routes at `/categories`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/categories/dto/create-category.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/categories/categories.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'cat-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Food', type: 'expense', color: null, icon: null, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(CategoriesService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns rows for the user', async () => {
    const result = await service.findAll('jonathalimax', 'user-1');
    expect(result).toEqual([mockRow]);
  });

  it('findOne throws NotFoundException when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad-id', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    const result = await service.create({ name: 'Food', type: 'expense' }, 'jonathalimax', 'user-1');
    expect(result).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=categories.service
```

Expected: FAIL — `Cannot find module './categories.service'`

- [ ] **Step 4: Implement CategoriesService**

Create `apps/api/src/categories/categories.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { categories } from '../db/schema';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

type Category = typeof categories.$inferSelect;

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .where(and(eq(categories.clientId, clientId), eq(categories.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Category> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.clientId, clientId), eq(categories.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateCategoryDto, clientId: string, userId: string): Promise<Category> {
    const rows = await this.db
      .insert(categories)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateCategoryDto, clientId: string, userId: string): Promise<Category> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(categories)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.clientId, clientId), eq(categories.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.clientId, clientId), eq(categories.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=categories.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/categories/categories.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/categories/categories.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/categories/
git commit -m "feat(api): add categories module (CRUD)"
```

---

## Task 4: Transactions module

Most feature-rich module. Routes: `GET /transactions` (with filters), `GET /transactions/:id`, `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id`.

Query filters: `?month=YYYY-MM` (required for list), `?type=income|expense`, `?categoryId=uuid`, `?accountId=uuid`, `?limit=50&offset=0`.

**Files:**
- Create: `apps/api/src/transactions/dto/create-transaction.dto.ts`
- Create: `apps/api/src/transactions/dto/list-transactions.dto.ts`
- Create: `apps/api/src/transactions/transactions.service.ts`
- Create: `apps/api/src/transactions/transactions.service.spec.ts`
- Create: `apps/api/src/transactions/transactions.controller.ts`
- Create: `apps/api/src/transactions/transactions.module.ts`

**Interfaces:**
- Consumes: `transactions` table, `DRIZZLE`, `and/eq/gte/lte/sql` from `drizzle-orm`
- Produces: `TransactionsModule`; routes at `/transactions`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/transactions/dto/create-transaction.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  amount: string;

  @IsIn(['income', 'expense'])
  type: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
```

Create `apps/api/src/transactions/dto/list-transactions.dto.ts`:

```typescript
import { IsOptional, IsString, IsIn, IsUUID, IsNumberString } from 'class-validator';

export class ListTransactionsDto {
  @IsOptional()
  @IsString()
  month?: string; // YYYY-MM

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/transactions/transactions.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'tx-1', clientId: 'jonathalimax', userId: 'user-1', amount: '100.00', type: 'expense', date: '2026-06-15', description: 'Lunch', categoryId: null, accountId: null, createdAt: new Date(), updatedAt: new Date() };

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TransactionsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(TransactionsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.offset.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns paged rows', async () => {
    const result = await service.findAll('jonathalimax', 'user-1', { month: '2026-06' });
    expect(result).toEqual([mockRow]);
  });

  it('findOne throws NotFoundException when not found', async () => {
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.offset.mockResolvedValueOnce([]);
    // findOne uses a simpler chain — adjust mock for single-row query
    const mockDbSingle = { ...mockDb, where: jest.fn().mockResolvedValue([]) };
    const module2 = await Test.createTestingModule({
      providers: [TransactionsService, { provide: DRIZZLE, useValue: mockDbSingle }],
    }).compile();
    const svc2 = module2.get(TransactionsService);
    await expect(svc2.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    const result = await service.create(
      { amount: '100.00', type: 'expense', date: '2026-06-15' },
      'jonathalimax',
      'user-1',
    );
    expect(result).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=transactions.service
```

Expected: FAIL — `Cannot find module './transactions.service'`

- [ ] **Step 4: Implement TransactionsService**

Create `apps/api/src/transactions/transactions.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { transactions } from '../db/schema';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';

type Transaction = typeof transactions.$inferSelect;

@Injectable()
export class TransactionsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string, filters: ListTransactionsDto): Promise<Transaction[]> {
    const conditions = [eq(transactions.clientId, clientId), eq(transactions.userId, userId)];

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const start = `${year}-${month}-01`;
      const endDate = new Date(Number(year), Number(month), 0); // last day of month
      const end = endDate.toISOString().slice(0, 10);
      conditions.push(gte(transactions.date, start));
      conditions.push(lte(transactions.date, end));
    }
    if (filters.type) conditions.push(eq(transactions.type, filters.type as any));
    if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
    if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));

    const limit = filters.limit ? Number(filters.limit) : 200;
    const offset = filters.offset ? Number(filters.offset) : 0;

    return this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(sql`${transactions.date} DESC`)
      .limit(limit)
      .offset(offset);
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Transaction> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateTransactionDto, clientId: string, userId: string): Promise<Transaction> {
    const rows = await this.db
      .insert(transactions)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateTransactionDto, clientId: string, userId: string): Promise<Transaction> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(transactions)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.clientId, clientId), eq(transactions.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=transactions.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/transactions/transactions.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  findAll(@Query() filters: ListTransactionsDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/transactions/transactions.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/transactions/
git commit -m "feat(api): add transactions module (CRUD + month/type/category/account filters)"
```

---

## Task 5: Bills module

Routes: `GET /bills`, `GET /bills/:id`, `POST /bills`, `PATCH /bills/:id`, `PATCH /bills/:id/mark-paid`, `DELETE /bills/:id`.

**Files:**
- Create: `apps/api/src/bills/dto/create-bill.dto.ts`
- Create: `apps/api/src/bills/bills.service.ts`
- Create: `apps/api/src/bills/bills.service.spec.ts`
- Create: `apps/api/src/bills/bills.controller.ts`
- Create: `apps/api/src/bills/bills.module.ts`

**Interfaces:**
- Consumes: `bills` table, `DRIZZLE`, `@CurrentUser()`
- Produces: `BillsModule`; routes at `/bills`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/bills/dto/create-bill.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString, IsUUID } from 'class-validator';

export class CreateBillDto {
  @IsString()
  name: string;

  @IsString()
  amount: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsIn(['pending', 'paid', 'overdue'])
  status?: string;

  @IsOptional()
  @IsIn(['monthly', 'weekly', 'yearly'])
  recurrence?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateBillDto extends PartialType(CreateBillDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/bills/bills.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BillsService } from './bills.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'bill-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Rent', amount: '1500.00', dueDate: '2026-07-01', status: 'pending', recurrence: 'monthly', categoryId: null, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('BillsService', () => {
  let service: BillsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BillsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(BillsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns bills for user', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('markPaid updates status to paid', async () => {
    mockDb.where.mockResolvedValueOnce([mockRow]);
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValueOnce([{ ...mockRow, status: 'paid' }]);
    const result = await service.markPaid('bill-1', 'jonathalimax', 'user-1');
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=bills.service
```

Expected: FAIL — `Cannot find module './bills.service'`

- [ ] **Step 4: Implement BillsService**

Create `apps/api/src/bills/bills.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { bills } from '../db/schema';
import { CreateBillDto, UpdateBillDto } from './dto/create-bill.dto';

type Bill = typeof bills.$inferSelect;

@Injectable()
export class BillsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Bill[]> {
    return this.db
      .select()
      .from(bills)
      .where(and(eq(bills.clientId, clientId), eq(bills.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Bill> {
    const rows = await this.db
      .select()
      .from(bills)
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateBillDto, clientId: string, userId: string): Promise<Bill> {
    const rows = await this.db
      .insert(bills)
      .values({ ...dto, clientId, userId })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateBillDto, clientId: string, userId: string): Promise<Bill> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(bills)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)))
      .returning();
    return rows[0];
  }

  async markPaid(id: string, clientId: string, userId: string): Promise<Bill> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(bills)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db
      .delete(bills)
      .where(and(eq(bills.id, id), eq(bills.clientId, clientId), eq(bills.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=bills.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/bills/bills.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateBillDto, UpdateBillDto } from './dto/create-bill.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('bills')
export class BillsController {
  constructor(private readonly service: BillsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateBillDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBillDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markPaid(id, user.clientId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/bills/bills.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [BillsController],
  providers: [BillsService],
})
export class BillsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/bills/
git commit -m "feat(api): add bills module (CRUD + mark-paid)"
```

---

## Task 6: Budgets module

Routes: `GET /budgets`, `GET /budgets/:id`, `POST /budgets`, `PATCH /budgets/:id`, `DELETE /budgets/:id`.

**Files:**
- Create: `apps/api/src/budgets/dto/create-budget.dto.ts`
- Create: `apps/api/src/budgets/budgets.service.ts`
- Create: `apps/api/src/budgets/budgets.service.spec.ts`
- Create: `apps/api/src/budgets/budgets.controller.ts`
- Create: `apps/api/src/budgets/budgets.module.ts`

**Interfaces:**
- Consumes: `budgets` table, `DRIZZLE`, `@CurrentUser()`
- Produces: `BudgetsModule`; routes at `/budgets`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/budgets/dto/create-budget.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  name: string;

  @IsString()
  amount: string;

  @IsOptional()
  @IsIn(['monthly', 'weekly', 'yearly'])
  period?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/budgets/budgets.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'bud-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Food Budget', amount: '500.00', period: 'monthly', categoryId: null, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('BudgetsService', () => {
  let service: BudgetsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BudgetsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(BudgetsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  it('findAll returns budgets', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    expect(await service.create({ name: 'Food Budget', amount: '500.00' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=budgets.service
```

Expected: FAIL — `Cannot find module './budgets.service'`

- [ ] **Step 4: Implement BudgetsService**

Create `apps/api/src/budgets/budgets.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { budgets } from '../db/schema';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/create-budget.dto';

type Budget = typeof budgets.$inferSelect;

@Injectable()
export class BudgetsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Budget[]> {
    return this.db.select().from(budgets).where(and(eq(budgets.clientId, clientId), eq(budgets.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Budget> {
    const rows = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.clientId, clientId), eq(budgets.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateBudgetDto, clientId: string, userId: string): Promise<Budget> {
    const rows = await this.db.insert(budgets).values({ ...dto, clientId, userId }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateBudgetDto, clientId: string, userId: string): Promise<Budget> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(budgets)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(budgets.id, id), eq(budgets.clientId, clientId), eq(budgets.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.clientId, clientId), eq(budgets.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=budgets.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/budgets/budgets.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/create-budget.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.clientId, user.sub); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.clientId, user.sub); }

  @Post()
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: JwtPayload) { return this.service.create(dto, user.clientId, user.sub); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.clientId, user.sub); }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.remove(id, user.clientId, user.sub); }
}
```

Create `apps/api/src/budgets/budgets.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/budgets/
git commit -m "feat(api): add budgets module (CRUD)"
```

---

## Task 7: Goals module

Routes: `GET /goals`, `GET /goals/:id`, `POST /goals`, `PATCH /goals/:id`, `DELETE /goals/:id`.

**Files:**
- Create: `apps/api/src/goals/dto/create-goal.dto.ts`
- Create: `apps/api/src/goals/goals.service.ts`
- Create: `apps/api/src/goals/goals.service.spec.ts`
- Create: `apps/api/src/goals/goals.controller.ts`
- Create: `apps/api/src/goals/goals.module.ts`

**Interfaces:**
- Consumes: `goals` table, `DRIZZLE`, `@CurrentUser()`
- Produces: `GoalsModule`; routes at `/goals`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/goals/dto/create-goal.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  name: string;

  @IsString()
  targetAmount: string;

  @IsOptional()
  @IsString()
  currentAmount?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/goals/goals.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'goal-1', clientId: 'jonathalimax', userId: 'user-1', name: 'Emergency Fund', targetAmount: '10000.00', currentAmount: '2500.00', deadline: null, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('GoalsService', () => {
  let service: GoalsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [GoalsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(GoalsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('findAll returns goals', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    expect(await service.create({ name: 'Emergency Fund', targetAmount: '10000.00' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=goals.service
```

Expected: FAIL — `Cannot find module './goals.service'`

- [ ] **Step 4: Implement GoalsService**

Create `apps/api/src/goals/goals.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { goals } from '../db/schema';
import { CreateGoalDto, UpdateGoalDto } from './dto/create-goal.dto';

type Goal = typeof goals.$inferSelect;

@Injectable()
export class GoalsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Goal[]> {
    return this.db.select().from(goals).where(and(eq(goals.clientId, clientId), eq(goals.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Goal> {
    const rows = await this.db
      .select().from(goals)
      .where(and(eq(goals.id, id), eq(goals.clientId, clientId), eq(goals.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateGoalDto, clientId: string, userId: string): Promise<Goal> {
    const rows = await this.db.insert(goals).values({ ...dto, clientId, userId }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateGoalDto, clientId: string, userId: string): Promise<Goal> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(goals).set({ ...dto, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.clientId, clientId), eq(goals.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(goals).where(and(eq(goals.id, id), eq(goals.clientId, clientId), eq(goals.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=goals.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/goals/goals.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto, UpdateGoalDto } from './dto/create-goal.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('goals')
export class GoalsController {
  constructor(private readonly service: GoalsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.clientId, user.sub); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.clientId, user.sub); }

  @Post()
  create(@Body() dto: CreateGoalDto, @CurrentUser() user: JwtPayload) { return this.service.create(dto, user.clientId, user.sub); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.clientId, user.sub); }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.remove(id, user.clientId, user.sub); }
}
```

Create `apps/api/src/goals/goals.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/goals/
git commit -m "feat(api): add goals module (CRUD)"
```

---

## Task 8: Investments module

Routes: `GET /investments`, `GET /investments/:id`, `POST /investments`, `PATCH /investments/:id`, `DELETE /investments/:id`.

**Files:**
- Create: `apps/api/src/investments/dto/create-investment.dto.ts`
- Create: `apps/api/src/investments/investments.service.ts`
- Create: `apps/api/src/investments/investments.service.spec.ts`
- Create: `apps/api/src/investments/investments.controller.ts`
- Create: `apps/api/src/investments/investments.module.ts`

**Interfaces:**
- Consumes: `investments` table, `DRIZZLE`, `@CurrentUser()`
- Produces: `InvestmentsModule`; routes at `/investments`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/investments/dto/create-investment.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateInvestmentDto {
  @IsString()
  name: string;

  @IsIn(['stock', 'fii', 'etf', 'fixed', 'crypto', 'other'])
  type: string;

  @IsOptional()
  @IsString()
  ticker?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  avgPrice?: string;

  @IsOptional()
  @IsString()
  currentPrice?: string;
}

export class UpdateInvestmentDto extends PartialType(CreateInvestmentDto) {}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/investments/investments.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotFoundException } from '@nestjs/common';

const mockRow = { id: 'inv-1', clientId: 'jonathalimax', userId: 'user-1', name: 'PETR4', ticker: 'PETR4', type: 'stock', quantity: '100', avgPrice: '35.50', currentPrice: '38.00', lastSyncedAt: null, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('InvestmentsService', () => {
  let service: InvestmentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [InvestmentsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(InvestmentsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('findAll returns investments', async () => {
    expect(await service.findAll('jonathalimax', 'user-1')).toEqual([mockRow]);
  });

  it('findOne throws when not found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    await expect(service.findOne('bad', 'jonathalimax', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('create inserts and returns row', async () => {
    expect(await service.create({ name: 'PETR4', type: 'stock', ticker: 'PETR4' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=investments.service
```

Expected: FAIL — `Cannot find module './investments.service'`

- [ ] **Step 4: Implement InvestmentsService**

Create `apps/api/src/investments/investments.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { investments } from '../db/schema';
import { CreateInvestmentDto, UpdateInvestmentDto } from './dto/create-investment.dto';

type Investment = typeof investments.$inferSelect;

@Injectable()
export class InvestmentsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  findAll(clientId: string, userId: string): Promise<Investment[]> {
    return this.db.select().from(investments).where(and(eq(investments.clientId, clientId), eq(investments.userId, userId)));
  }

  async findOne(id: string, clientId: string, userId: string): Promise<Investment> {
    const rows = await this.db
      .select().from(investments)
      .where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return rows[0];
  }

  async create(dto: CreateInvestmentDto, clientId: string, userId: string): Promise<Investment> {
    const rows = await this.db.insert(investments).values({ ...dto, clientId, userId }).returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateInvestmentDto, clientId: string, userId: string): Promise<Investment> {
    await this.findOne(id, clientId, userId);
    const rows = await this.db
      .update(investments).set({ ...dto, updatedAt: new Date() })
      .where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)))
      .returning();
    return rows[0];
  }

  async remove(id: string, clientId: string, userId: string): Promise<void> {
    await this.findOne(id, clientId, userId);
    await this.db.delete(investments).where(and(eq(investments.id, id), eq(investments.clientId, clientId), eq(investments.userId, userId)));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=investments.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/investments/investments.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto, UpdateInvestmentDto } from './dto/create-investment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('investments')
export class InvestmentsController {
  constructor(private readonly service: InvestmentsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.clientId, user.sub); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.clientId, user.sub); }

  @Post()
  create(@Body() dto: CreateInvestmentDto, @CurrentUser() user: JwtPayload) { return this.service.create(dto, user.clientId, user.sub); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvestmentDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.clientId, user.sub); }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.remove(id, user.clientId, user.sub); }
}
```

Create `apps/api/src/investments/investments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
})
export class InvestmentsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/investments/
git commit -m "feat(api): add investments module (CRUD)"
```

---

## Task 9: Planner module (singleton upsert)

`planner` is a singleton per user — there's at most one row per `(clientId, userId)`. Routes: `GET /planner`, `PATCH /planner`.

**Files:**
- Create: `apps/api/src/planner/dto/upsert-planner.dto.ts`
- Create: `apps/api/src/planner/planner.service.ts`
- Create: `apps/api/src/planner/planner.service.spec.ts`
- Create: `apps/api/src/planner/planner.controller.ts`
- Create: `apps/api/src/planner/planner.module.ts`

**Interfaces:**
- Consumes: `planner` table (unique on `(clientId, userId)`), `DRIZZLE`, `@CurrentUser()`
- Produces: `PlannerModule`; routes at `/planner`. GET returns the row or `null`. PATCH upserts.

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/planner/dto/upsert-planner.dto.ts`:

```typescript
import { IsOptional, IsString } from 'class-validator';

export class UpsertPlannerDto {
  @IsOptional()
  @IsString()
  salaryGross?: string;

  @IsOptional()
  deductions?: Record<string, unknown>;

  @IsOptional()
  allocations?: Record<string, unknown>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/planner/planner.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PlannerService } from './planner.service';
import { DRIZZLE } from '../db/drizzle.module';

const mockRow = { id: 'plan-1', clientId: 'jonathalimax', userId: 'user-1', salaryGross: '8000.00', deductions: {}, allocations: {}, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
};

describe('PlannerService', () => {
  let service: PlannerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PlannerService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(PlannerService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.onConflictDoUpdate.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
  });

  it('get returns current planner or null', async () => {
    expect(await service.get('jonathalimax', 'user-1')).toEqual(mockRow);
  });

  it('get returns null when no planner exists', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    expect(await service.get('jonathalimax', 'user-1')).toBeNull();
  });

  it('upsert returns updated row', async () => {
    expect(await service.upsert({ salaryGross: '8000.00' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=planner.service
```

Expected: FAIL — `Cannot find module './planner.service'`

- [ ] **Step 4: Implement PlannerService**

Create `apps/api/src/planner/planner.service.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { planner } from '../db/schema';
import { UpsertPlannerDto } from './dto/upsert-planner.dto';

type Planner = typeof planner.$inferSelect;

@Injectable()
export class PlannerService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async get(clientId: string, userId: string): Promise<Planner | null> {
    const rows = await this.db
      .select().from(planner)
      .where(and(eq(planner.clientId, clientId), eq(planner.userId, userId)));
    return rows[0] ?? null;
  }

  async upsert(dto: UpsertPlannerDto, clientId: string, userId: string): Promise<Planner> {
    const rows = await this.db
      .insert(planner)
      .values({ ...dto, clientId, userId })
      .onConflictDoUpdate({
        target: [planner.clientId, planner.userId],
        set: { ...dto, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=planner.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/planner/planner.controller.ts`:

```typescript
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { UpsertPlannerDto } from './dto/upsert-planner.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('planner')
export class PlannerController {
  constructor(private readonly service: PlannerService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.service.get(user.clientId, user.sub);
  }

  @Patch()
  upsert(@Body() dto: UpsertPlannerDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsert(dto, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/planner/planner.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { PlannerController } from './planner.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [PlannerController],
  providers: [PlannerService],
})
export class PlannerModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/planner/
git commit -m "feat(api): add planner module (singleton GET + PATCH upsert)"
```

---

## Task 10: User Settings module (singleton upsert)

`settings` table has a unique index on `(clientId, userId)`. Named `user-settings` to avoid collision with the `settings` schema export. Routes: `GET /user-settings`, `PATCH /user-settings`.

**Files:**
- Create: `apps/api/src/user-settings/dto/upsert-user-settings.dto.ts`
- Create: `apps/api/src/user-settings/user-settings.service.ts`
- Create: `apps/api/src/user-settings/user-settings.service.spec.ts`
- Create: `apps/api/src/user-settings/user-settings.controller.ts`
- Create: `apps/api/src/user-settings/user-settings.module.ts`

**Interfaces:**
- Consumes: `settings` table from `../db/schema`, `DRIZZLE`, `@CurrentUser()`
- Produces: `UserSettingsModule`; routes at `/user-settings`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/user-settings/dto/upsert-user-settings.dto.ts`:

```typescript
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpsertUserSettingsDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsBoolean()
  billReminders?: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/user-settings/user-settings.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { UserSettingsService } from './user-settings.service';
import { DRIZZLE } from '../db/drizzle.module';

const mockRow = { id: 'set-1', clientId: 'jonathalimax', userId: 'user-1', currency: 'BRL', language: 'pt-BR', darkMode: false, billReminders: true, createdAt: new Date(), updatedAt: new Date() };
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockRow]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockRow]),
};

describe('UserSettingsService', () => {
  let service: UserSettingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserSettingsService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(UserSettingsService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis(); mockDb.where.mockResolvedValue([mockRow]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.onConflictDoUpdate.mockReturnThis(); mockDb.returning.mockResolvedValue([mockRow]);
  });

  it('get returns settings', async () => {
    expect(await service.get('jonathalimax', 'user-1')).toEqual(mockRow);
  });

  it('get returns null when no settings exist', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    expect(await service.get('jonathalimax', 'user-1')).toBeNull();
  });

  it('upsert returns updated settings', async () => {
    expect(await service.upsert({ currency: 'USD' }, 'jonathalimax', 'user-1')).toEqual(mockRow);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=user-settings.service
```

Expected: FAIL — `Cannot find module './user-settings.service'`

- [ ] **Step 4: Implement UserSettingsService**

Create `apps/api/src/user-settings/user-settings.service.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { settings } from '../db/schema';
import { UpsertUserSettingsDto } from './dto/upsert-user-settings.dto';

type Settings = typeof settings.$inferSelect;

@Injectable()
export class UserSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async get(clientId: string, userId: string): Promise<Settings | null> {
    const rows = await this.db
      .select().from(settings)
      .where(and(eq(settings.clientId, clientId), eq(settings.userId, userId)));
    return rows[0] ?? null;
  }

  async upsert(dto: UpsertUserSettingsDto, clientId: string, userId: string): Promise<Settings> {
    const rows = await this.db
      .insert(settings)
      .values({ ...dto, clientId, userId })
      .onConflictDoUpdate({
        target: [settings.clientId, settings.userId],
        set: { ...dto, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=user-settings.service
```

Expected: all tests PASS.

- [ ] **Step 6: Create controller and module**

Create `apps/api/src/user-settings/user-settings.controller.ts`:

```typescript
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { UpsertUserSettingsDto } from './dto/upsert-user-settings.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('user-settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.service.get(user.clientId, user.sub);
  }

  @Patch()
  upsert(@Body() dto: UpsertUserSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsert(dto, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/user-settings/user-settings.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsController } from './user-settings.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [UserSettingsController],
  providers: [UserSettingsService],
})
export class UserSettingsModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/user-settings/
git commit -m "feat(api): add user-settings module (singleton GET + PATCH upsert)"
```

---

## Task 11: Wire all modules into AppModule + final verification

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: all 9 new modules
- Produces: complete NestJS app with all business routes active and the build passing

- [ ] **Step 1: Update apps/api/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BillsModule } from './bills/bills.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { InvestmentsModule } from './investments/investments.module';
import { PlannerModule } from './planner/planner.module';
import { UserSettingsModule } from './user-settings/user-settings.module';

@Module({
  imports: [
    DrizzleModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BillsModule,
    BudgetsModule,
    GoalsModule,
    InvestmentsModule,
    PlannerModule,
    UserSettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

- [ ] **Step 2: Run the full test suite**

```bash
pnpm --filter @realwise/api test
```

Expected: all spec files pass. No failures.

- [ ] **Step 3: Build the API**

```bash
pnpm --filter @realwise/api build
```

Expected: `dist/` created, zero TypeScript errors.

- [ ] **Step 4: Smoke-test routes with curl (requires running API)**

Start the API in one terminal:
```bash
DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" pnpm --filter @realwise/api dev
```

In another terminal, confirm the global JWT guard is working (unauthenticated request returns 401):
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/accounts
```
Expected: `401`

Confirm health is still public (returns 200):
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
```
Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): wire all business modules into AppModule"
```

---

## Summary

| Task | Deliverable | Routes Added |
|------|-------------|--------------|
| 1 | class-validator + global ValidationPipe | — |
| 2 | AccountsModule | `GET/POST/PATCH/DELETE /accounts` |
| 3 | CategoriesModule | `GET/POST/PATCH/DELETE /categories` |
| 4 | TransactionsModule | `GET/POST/PATCH/DELETE /transactions` (filters: month, type, category, account) |
| 5 | BillsModule | `GET/POST/PATCH/DELETE /bills`, `PATCH /bills/:id/mark-paid` |
| 6 | BudgetsModule | `GET/POST/PATCH/DELETE /budgets` |
| 7 | GoalsModule | `GET/POST/PATCH/DELETE /goals` |
| 8 | InvestmentsModule | `GET/POST/PATCH/DELETE /investments` |
| 9 | PlannerModule | `GET /planner`, `PATCH /planner` |
| 10 | UserSettingsModule | `GET /user-settings`, `PATCH /user-settings` |
| 11 | AppModule wiring + final smoke test | — |
