# Plan 4: Authentication (Passport.js + JWT) ✅ COMPLETE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete authentication for `apps/api` — Google OAuth2 and Apple Sign-In via Passport.js, JWT access/refresh tokens stored in httpOnly cookies, a global JWT guard with `@Public()` opt-out, and a Firebase Auth bridge so existing users link on first login without re-registration.

**Architecture:** `AuthModule` owns all auth logic. `JwtStrategy` extracts the `access_token` cookie and validates it. Two OAuth strategies (Google, Apple) are mounted in `AuthController`; the tenant `client_id` is encoded in the OAuth `state` parameter so the callback knows which tenant the user belongs to. `AuthService` handles user upsert (matched by `email + clientId`), JWT issuance, and refresh token rotation (hashed with bcryptjs, stored in `users.refresh_token_hash`). A global `JwtAuthGuard` protects every route by default; routes opt out via `@Public()`. The Firebase bridge matches existing rows by `email + clientId` and links `firebase_uid` without forcing re-registration.

**Tech Stack:** `@nestjs/passport`, `passport`, `passport-google-oauth20`, `passport-apple`, `@nestjs/jwt`, `passport-jwt`, `cookie-parser`, `bcryptjs`

## Global Constraints

- Node ≥ 22, pnpm ≥ 9
- All npm script commands: `pnpm --filter @realwise/api <script>`
- All Jest test commands: `pnpm --filter @realwise/api test`
- JWT access token: 15 min expiry, httpOnly cookie named `access_token`
- JWT refresh token: 7 day expiry, httpOnly cookie named `refresh_token`, rotated on every use
- Cookie options: `{ httpOnly: true, secure: NODE_ENV==='production', sameSite: 'lax', path: '/' }`
- JWT payload shape: `{ sub: string, clientId: string, role: 'user' | 'admin' }`
- Access token signed with `JWT_SECRET`; refresh token signed with `JWT_REFRESH_SECRET` (falls back to `JWT_SECRET`)
- Bcrypt salt rounds: 10
- All auth routes mounted at `/auth/*`
- Admin routes protected by `AdminGuard` checking `role === 'admin'` in JWT payload
- `@Public()` decorator marks routes that skip `JwtAuthGuard`
- `GET /health` must remain publicly accessible (add `@Public()` in Task 7)
- Drizzle ORM via `DRIZZLE` injection token from `DrizzleModule`
- `rtk` prefix on all CLI commands per project convention

## Environment Variables Required

Add these to `.env` in `apps/api/` (or to the Coolify environment for production):

```bash
JWT_SECRET=            # openssl rand -base64 64
JWT_REFRESH_SECRET=    # openssl rand -base64 64 (optional, falls back to JWT_SECRET)
GOOGLE_CLIENT_ID=      # Google Cloud Console → OAuth2 credentials
GOOGLE_CLIENT_SECRET=  # Google Cloud Console
APPLE_CLIENT_ID=       # Apple Service ID, e.g. br.com.realwise.web
APPLE_TEAM_ID=         # 10-char Apple Team ID
APPLE_KEY_ID=          # Key ID for the P8 key
APPLE_PRIVATE_KEY=     # Full P8 key content with literal \n for newlines
API_BASE_URL=          # e.g. https://api.realwise.com.br (no trailing slash)
FRONTEND_BASE_URL=     # e.g. https://realwise.com.br (post-auth redirect target)
```

---

## File Map

### Created
- `apps/api/src/auth/interfaces/jwt-payload.interface.ts` — `JwtPayload` type
- `apps/api/src/auth/auth.service.ts` — user upsert, token issuance, refresh rotation, logout
- `apps/api/src/auth/auth.service.spec.ts` — Jest unit tests for AuthService
- `apps/api/src/auth/auth.controller.ts` — `/auth/google`, `/auth/apple`, `/auth/refresh`, `/auth/me`, `/auth/logout`
- `apps/api/src/auth/auth.controller.spec.ts` — Jest unit tests for AuthController
- `apps/api/src/auth/auth.module.ts` — AuthModule wiring
- `apps/api/src/auth/strategies/jwt.strategy.ts` — reads `access_token` cookie, validates JWT
- `apps/api/src/auth/strategies/google.strategy.ts` — Google OAuth2 Passport strategy
- `apps/api/src/auth/strategies/apple.strategy.ts` — Apple Sign-In Passport strategy
- `apps/api/src/auth/guards/jwt-auth.guard.ts` — global guard, skips `@Public()` routes
- `apps/api/src/auth/guards/admin.guard.ts` — checks `role === 'admin'`
- `apps/api/src/auth/decorators/public.decorator.ts` — `@Public()` metadata decorator
- `apps/api/src/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` param decorator
- `apps/api/src/db/migrations/0001_*.sql` — drizzle-kit generated (add `refresh_token_hash`)

### Modified
- `apps/api/package.json` — add auth dependencies
- `apps/api/src/db/schema/users.ts` — add `refreshTokenHash varchar nullable`
- `apps/api/src/app.module.ts` — import `AuthModule`, register global `JwtAuthGuard`
- `apps/api/src/main.ts` — add `cookieParser()` middleware
- `apps/api/src/health/health.controller.ts` — add `@Public()` to `check()` method

---

## Task 1: Install auth dependencies + add refresh_token_hash column

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/db/schema/users.ts`
- Created (generated): `apps/api/src/db/migrations/0001_*_add_refresh_token.sql`

**Interfaces:**
- Produces: `users` table with `refresh_token_hash varchar nullable`; all auth npm packages available to import

- [ ] **Step 1: Add dependencies to apps/api/package.json**

Add to `dependencies`:
```json
"@nestjs/jwt": "^10.2.0",
"@nestjs/passport": "^10.0.3",
"bcryptjs": "^2.4.3",
"cookie-parser": "^1.4.7",
"passport": "^0.7.0",
"passport-apple": "^2.0.2",
"passport-google-oauth20": "^2.0.0",
"passport-jwt": "^4.0.1"
```

Add to `devDependencies`:
```json
"@types/bcryptjs": "^2.4.6",
"@types/cookie-parser": "^1.4.8",
"@types/passport-apple": "^1.1.5",
"@types/passport-google-oauth20": "^2.0.16",
"@types/passport-jwt": "^4.0.1"
```

- [ ] **Step 2: Install dependencies**

```bash
rtk pnpm --filter @realwise/api install
```

Expected: packages installed, no peer dependency errors.

- [ ] **Step 3: Add refreshTokenHash column to apps/api/src/db/schema/users.ts**

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
    refreshTokenHash: varchar('refresh_token_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_client_email_idx').on(table.clientId, table.email),
  ],
);
```

- [ ] **Step 4: Generate migration**

You need a running PostgreSQL instance with the existing schema already applied (from Plan 3).

```bash
# Option A — local Docker (if not still running from Plan 3)
docker run -d --name pg-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=realwise -p 5432:5432 postgres:16

# Apply existing migrations first (if fresh DB)
DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" pnpm --filter @realwise/api migrate:run

# Generate the new migration
DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" pnpm --filter @realwise/api migrate:generate
```

Expected output:
```
Your SQL migration file ➜ src/db/migrations/0001_<hash>_add_refresh_token.sql
```

- [ ] **Step 5: Verify the generated SQL**

The generated file should contain only:
```sql
ALTER TABLE "users" ADD COLUMN "refresh_token_hash" varchar;
```

Open `apps/api/src/db/migrations/0001_*.sql` and confirm this is the only change.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/api/package.json apps/api/src/db/schema/users.ts apps/api/src/db/migrations/ pnpm-lock.yaml
rtk git commit -m "feat(api): install auth deps + add refresh_token_hash column"
```

---

## Task 2: JwtPayload interface + AuthService

**Files:**
- Create: `apps/api/src/auth/interfaces/jwt-payload.interface.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `DRIZZLE` injection token (type `NodePgDatabase` from `drizzle-orm/node-postgres` — use `any` in service to avoid import issues), `users` table from `../../db/schema`, `JwtService` from `@nestjs/jwt`, `bcryptjs`
- Produces:
  - `JwtPayload` interface: `{ sub: string; clientId: string; role: 'user' | 'admin' }`
  - `AuthService.findOrCreateUser(opts: { email: string; clientId: string; name?: string | null; firebaseUid?: string | null; appleId?: string | null })` → `Promise<typeof users.$inferSelect>`
  - `AuthService.issueTokens(user: Pick<typeof users.$inferSelect, 'id' | 'clientId' | 'role'>)` → `Promise<{ accessToken: string; refreshToken: string }>`
  - `AuthService.validateRefreshToken(userId: string, token: string)` → `Promise<typeof users.$inferSelect | null>`
  - `AuthService.logout(userId: string)` → `Promise<void>`

- [ ] **Step 1: Write the failing tests first**

Create `apps/api/src/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DRIZZLE } from '../db/drizzle.module';

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: 'jonathalimax',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  firebaseUid: null,
  appleId: null,
  refreshTokenHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('findOrCreateUser', () => {
    it('returns existing user when email+clientId match', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const result = await service.findOrCreateUser({
        email: 'test@example.com',
        clientId: 'jonathalimax',
      });
      expect(result.id).toBe(fakeUser.id);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('creates user when none exists', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });

      const result = await service.findOrCreateUser({
        email: 'test@example.com',
        clientId: 'jonathalimax',
        name: 'Test User',
      });
      expect(result.id).toBe(fakeUser.id);
    });
  });

  describe('issueTokens', () => {
    it('returns access and refresh tokens', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.issueTokens(fakeUser);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateRefreshToken', () => {
    it('returns null when user has no stored hash', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([fakeUser]),
        }),
      });
      const result = await service.validateRefreshToken(fakeUser.id, 'any-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears the refresh token hash', async () => {
      const setSpy = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      });
      mockDb.update.mockReturnValue({ set: setSpy });

      await service.logout(fakeUser.id);
      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({ refreshTokenHash: null }));
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=auth.service
```

Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: Create apps/api/src/auth/interfaces/jwt-payload.interface.ts**

```typescript
export interface JwtPayload {
  sub: string;
  clientId: string;
  role: 'user' | 'admin';
}
```

- [ ] **Step 4: Create apps/api/src/auth/auth.service.ts**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { users } from '../db/schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type User = typeof users.$inferSelect;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly jwtService: JwtService,
  ) {}

  async findOrCreateUser(opts: {
    email: string;
    clientId: string;
    name?: string | null;
    firebaseUid?: string | null;
    appleId?: string | null;
  }): Promise<User> {
    const existing = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, opts.email), eq(users.clientId, opts.clientId)));

    if (existing.length > 0) {
      const user = existing[0] as User;
      const updates: Partial<User> = { updatedAt: new Date() };
      if (opts.firebaseUid && !user.firebaseUid) updates.firebaseUid = opts.firebaseUid;
      if (opts.appleId && !user.appleId) updates.appleId = opts.appleId;
      if (opts.name && !user.name) updates.name = opts.name;
      await this.db.update(users).set(updates).where(eq(users.id, user.id));
      return { ...user, ...updates };
    }

    const inserted = await this.db
      .insert(users)
      .values({
        clientId: opts.clientId,
        email: opts.email,
        name: opts.name ?? null,
        firebaseUid: opts.firebaseUid ?? null,
        appleId: opts.appleId ?? null,
      })
      .returning();

    return inserted[0] as User;
  }

  async issueTokens(user: Pick<User, 'id' | 'clientId' | 'role'>): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      clientId: user.clientId,
      role: user.role as 'user' | 'admin',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
    });

    const hash = await bcrypt.hash(refreshToken, 10);
    await this.db
      .update(users)
      .set({ refreshTokenHash: hash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { accessToken, refreshToken };
  }

  async validateRefreshToken(userId: string, token: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (rows.length === 0) return null;
    const user = rows[0] as User;
    if (!user.refreshTokenHash) return null;

    const valid = await bcrypt.compare(token, user.refreshTokenHash);
    return valid ? user : null;
  }

  async logout(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ refreshTokenHash: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=auth.service
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/api/src/auth/interfaces/jwt-payload.interface.ts apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
rtk git commit -m "feat(api): add AuthService — user upsert, JWT issuance, refresh rotation"
```

---

## Task 3: JWT strategy + global guard + decorators

**Files:**
- Create: `apps/api/src/auth/decorators/public.decorator.ts`
- Create: `apps/api/src/auth/decorators/current-user.decorator.ts`
- Create: `apps/api/src/auth/strategies/jwt.strategy.ts`
- Create: `apps/api/src/auth/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/guards/admin.guard.ts`

**Interfaces:**
- Consumes: `JwtPayload` from `../interfaces/jwt-payload.interface`; `PassportStrategy`, `ExtractJwt`, `Strategy` from `passport-jwt`
- Produces:
  - `IS_PUBLIC_KEY = 'isPublic'` metadata key
  - `@Public()` — class/method decorator setting `IS_PUBLIC_KEY`
  - `@CurrentUser()` — param decorator extracting `req.user as JwtPayload`
  - `JwtStrategy` — Passport strategy reading `access_token` cookie
  - `JwtAuthGuard` — `CanActivate` that skips routes marked `@Public()`
  - `AdminGuard` — `CanActivate` that checks `role === 'admin'`

- [ ] **Step 1: Create apps/api/src/auth/decorators/public.decorator.ts**

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Create apps/api/src/auth/decorators/current-user.decorator.ts**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
```

- [ ] **Step 3: Create apps/api/src/auth/strategies/jwt.strategy.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const cookieExtractor = (req: Request): string | null => {
  return req?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
```

- [ ] **Step 4: Create apps/api/src/auth/guards/jwt-auth.guard.ts**

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 5: Create apps/api/src/auth/guards/admin.guard.ts**

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user || user.role !== 'admin') throw new ForbiddenException();
    return true;
  }
}
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/api/src/auth/decorators/ apps/api/src/auth/strategies/jwt.strategy.ts apps/api/src/auth/guards/
rtk git commit -m "feat(api): add JWT strategy, JwtAuthGuard, AdminGuard, Public/CurrentUser decorators"
```

---

## Task 4: Google OAuth strategy

**Files:**
- Create: `apps/api/src/auth/strategies/google.strategy.ts`

**Interfaces:**
- Consumes: `passport-google-oauth20` `Strategy`, `Profile`
- Produces: `GoogleStrategy` Passport strategy; on callback calls `done(null, { email, name, googleId })` so the controller can call `AuthService.findOrCreateUser`

- [ ] **Step 1: Create apps/api/src/auth/strategies/google.strategy.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  email: string;
  name: string | null;
  googleId: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user?: GoogleProfile) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('No email returned from Google'), undefined);
      return;
    }
    done(null, {
      email,
      name: profile.displayName ?? null,
      googleId: profile.id,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/api/src/auth/strategies/google.strategy.ts
rtk git commit -m "feat(api): add Google OAuth2 Passport strategy"
```

---

## Task 5: Apple Sign-In strategy

**Files:**
- Create: `apps/api/src/auth/strategies/apple.strategy.ts`

**Interfaces:**
- Consumes: `passport-apple` `Strategy`; Apple sends a POST to callback with `id_token` JWT containing `sub` (apple_id) and `email`
- Produces: `AppleStrategy` Passport strategy; on callback calls `done(null, { email, name, appleId })`. Note: Apple only returns `email` and `name` on the **first** login — subsequent logins have `email: undefined` and `name: undefined`. The strategy must handle this gracefully (the controller will look up by `appleId` if email is absent).

- [ ] **Step 1: Create apps/api/src/auth/strategies/apple.strategy.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import AppleStrategy, { AuthenticateOptions } from 'passport-apple';

export interface AppleProfile {
  email: string | null;
  name: string | null;
  appleId: string;
}

@Injectable()
export class AppleSignInStrategy extends PassportStrategy(AppleStrategy, 'apple') {
  constructor() {
    const privateKey = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    super({
      clientID: process.env.APPLE_CLIENT_ID ?? '',
      teamID: process.env.APPLE_TEAM_ID ?? '',
      keyID: process.env.APPLE_KEY_ID ?? '',
      privateKeyString: privateKey,
      callbackURL: `${process.env.API_BASE_URL ?? 'http://localhost:3001'}/auth/apple/callback`,
      passReqToCallback: false,
      scope: ['name', 'email'],
    } as AuthenticateOptions);
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    idToken: any,
    profile: any,
    done: (err: any, user?: AppleProfile) => void,
  ): Promise<void> {
    const appleId: string = idToken?.sub ?? profile?.id;
    if (!appleId) {
      done(new Error('No sub in Apple id_token'), undefined);
      return;
    }

    const email: string | null =
      idToken?.email ?? profile?.email ?? null;
    const firstName: string | null = profile?.name?.firstName ?? null;
    const lastName: string | null = profile?.name?.lastName ?? null;
    const name =
      firstName || lastName
        ? [firstName, lastName].filter(Boolean).join(' ')
        : null;

    done(null, { email, name, appleId });
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add apps/api/src/auth/strategies/apple.strategy.ts
rtk git commit -m "feat(api): add Apple Sign-In Passport strategy"
```

---

## Task 6: AuthController

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Consumes:
  - `AuthService.findOrCreateUser`, `AuthService.issueTokens`, `AuthService.validateRefreshToken`, `AuthService.logout`
  - `GoogleProfile` from `./strategies/google.strategy`
  - `AppleProfile` from `./strategies/apple.strategy`
  - `JwtPayload` from `./interfaces/jwt-payload.interface`
  - `@Public()` from `./decorators/public.decorator`
  - `@CurrentUser()` from `./decorators/current-user.decorator`
- Produces:
  - `GET /auth/google?clientId=<id>` — initiates Google OAuth, encodes `clientId` in state
  - `GET /auth/google/callback?state=<b64>&code=<code>` — Google redirects here; sets cookies, redirects to frontend
  - `GET /auth/apple?clientId=<id>` — initiates Apple Sign-In
  - `POST /auth/apple/callback` — Apple POSTs here; sets cookies, redirects to frontend
  - `POST /auth/refresh` — rotates tokens from `refresh_token` cookie
  - `GET /auth/me` — returns current user JWT payload
  - `POST /auth/logout` — clears cookies, nulls hash

**Note:** The `state` parameter encodes the `clientId` as `Buffer.from(JSON.stringify({ clientId })).toString('base64url')` and is decoded in the callback. All OAuth-initiating and callback routes are `@Public()` since the JWT guard has not yet issued tokens.

- [ ] **Step 1: Write the failing tests first**

Create `apps/api/src/auth/auth.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  clientId: 'jonathalimax',
  email: 'test@example.com',
  name: 'Test',
  role: 'user' as const,
  firebaseUid: null,
  appleId: null,
  refreshTokenHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAuthService = {
  findOrCreateUser: jest.fn().mockResolvedValue(fakeUser),
  issueTokens: jest.fn().mockResolvedValue({
    accessToken: 'access-jwt',
    refreshToken: 'refresh-jwt',
  }),
  validateRefreshToken: jest.fn(),
  logout: jest.fn(),
};

const mockRes = () => {
  const res: any = {};
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no refresh cookie', async () => {
      const req: any = { cookies: {} };
      const res = mockRes();
      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is invalid', async () => {
      mockAuthService.validateRefreshToken.mockResolvedValue(null);
      const req: any = {
        cookies: { refresh_token: 'bad-token' },
        user: { sub: 'uuid', clientId: 'test', role: 'user' },
      };
      const res = mockRes();
      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    });

    it('sets cookies and returns ok on valid refresh', async () => {
      mockAuthService.validateRefreshToken.mockResolvedValue(fakeUser);
      const req: any = {
        cookies: { refresh_token: 'valid-token' },
        user: { sub: fakeUser.id },
      };
      const res = mockRes();
      await controller.refresh(req, res);
      expect(mockAuthService.issueTokens).toHaveBeenCalledWith(fakeUser);
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('me', () => {
    it('returns current user payload', () => {
      const payload = { sub: fakeUser.id, clientId: 'jonathalimax', role: 'user' as const };
      const result = controller.me(payload);
      expect(result).toEqual(payload);
    });
  });

  describe('logout', () => {
    it('calls logout service and clears cookies', async () => {
      const payload = { sub: fakeUser.id, clientId: 'jonathalimax', role: 'user' as const };
      const res = mockRes();
      await controller.logout(payload, res);
      expect(mockAuthService.logout).toHaveBeenCalledWith(fakeUser.id);
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @realwise/api test --testPathPattern=auth.controller
```

Expected: FAIL — `Cannot find module './auth.controller'`

- [ ] **Step 3: Create apps/api/src/auth/auth.controller.ts**

```typescript
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Next,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response, NextFunction } from 'express';
import * as passport from 'passport';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { GoogleProfile } from './strategies/google.strategy';
import { AppleProfile } from './strategies/apple.strategy';

function encodeState(clientId: string): string {
  return Buffer.from(JSON.stringify({ clientId })).toString('base64url');
}

function decodeState(state: string): { clientId: string } {
  return JSON.parse(Buffer.from(state, 'base64url').toString());
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
    res.cookie('access_token', accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  // ─── Google ──────────────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  googleAuth(
    @Query('clientId') clientId: string = 'app',
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    passport.authenticate('google', {
      scope: ['email', 'profile'],
      state: encodeState(clientId),
      session: false,
    })(req, res, next);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    passport.authenticate('google', { session: false }, async (err: any, profile: GoogleProfile) => {
      if (err || !profile) {
        return res.redirect(
          `${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=oauth`,
        );
      }
      try {
        const { clientId } = decodeState(state ?? encodeState('app'));
        const user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId,
          name: profile.name,
        });
        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/${clientId}/dashboard`);
      } catch {
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=server`);
      }
    })(req, res, next);
  }

  // ─── Apple ───────────────────────────────────────────────────────────────────

  @Public()
  @Get('apple')
  appleAuth(
    @Query('clientId') clientId: string = 'app',
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): void {
    passport.authenticate('apple', {
      state: encodeState(clientId),
      session: false,
    })(req, res, next);
  }

  @Public()
  @Post('apple/callback')
  async appleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ): Promise<void> {
    passport.authenticate('apple', { session: false }, async (err: any, profile: AppleProfile) => {
      if (err || !profile) {
        return res.redirect(
          `${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=oauth`,
        );
      }
      try {
        const state = (req.body as any)?.state ?? '';
        const { clientId } = decodeState(state || encodeState('app'));

        let user;
        if (!profile.email) {
          // Subsequent Apple logins — no email returned; look up by appleId
          // AuthService.findOrCreateUser will handle this via appleId link
          throw new Error('Apple subsequent login without email not yet supported — look up by appleId');
        }

        user = await this.authService.findOrCreateUser({
          email: profile.email,
          clientId,
          name: profile.name,
          appleId: profile.appleId,
        });

        const { accessToken, refreshToken } = await this.authService.issueTokens(user);
        this.setTokenCookies(res, accessToken, refreshToken);
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/${clientId}/dashboard`);
      } catch {
        res.redirect(`${process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173'}/login?error=server`);
      }
    })(req, res, next);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token: string | undefined = (req.cookies as any)?.refresh_token;
    if (!token) throw new UnauthorizedException();

    const userId = (req as any).user?.sub;
    if (!userId) {
      // Decode sub from the refresh token without verifying expiry for rotation
      // We rely on validateRefreshToken's hash check as the authority
      const parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedException();
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      (req as any).user = payload;
    }

    const sub = (req as any).user?.sub;
    if (!sub) throw new UnauthorizedException();

    const user = await this.authService.validateRefreshToken(sub, token);
    if (!user) throw new UnauthorizedException();

    const { accessToken, refreshToken } = await this.authService.issueTokens(user);
    this.setTokenCookies(res, accessToken, refreshToken);
    res.json({ ok: true });
  }

  // ─── Me ──────────────────────────────────────────────────────────────────────

  @Get('me')
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload, @Res() res: Response): Promise<void> {
    await this.authService.logout(user.sub);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.json({ ok: true });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @realwise/api test --testPathPattern=auth.controller
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.controller.spec.ts
rtk git commit -m "feat(api): add AuthController — Google/Apple OAuth, refresh, me, logout"
```

---

## Task 7: AuthModule + wire globally + cookie-parser

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/health/health.controller.ts`

**Interfaces:**
- Consumes: all auth files from Tasks 2–6; `DrizzleModule`, `JwtModule`, `PassportModule` from `@nestjs/passport`
- Produces: fully wired `AuthModule`; global `JwtAuthGuard` registered as `APP_GUARD`; `cookie-parser` middleware so cookies are parsed before guards run

- [ ] **Step 1: Create apps/api/src/auth/auth.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DrizzleModule } from '../db/drizzle.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { AppleSignInStrategy } from './strategies/apple.strategy';

@Module({
  imports: [
    DrizzleModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, AppleSignInStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 2: Modify apps/api/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [HealthModule, DrizzleModule, AuthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
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
import * as cookieParser from 'cookie-parser';
dotenv.config();

async function bootstrap() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);
  await migrate(db, { migrationsFolder: path.join(__dirname, 'db/migrations') });
  await migrationClient.end();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_BASE_URL ?? true,
    credentials: true,
  });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}
bootstrap();
```

- [ ] **Step 4: Mark GET /health as @Public()**

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

- [ ] **Step 5: Verify the API builds**

```bash
pnpm --filter @realwise/api build
```

Expected: `dist/` created, no TypeScript errors.

- [ ] **Step 6: Run all API tests**

```bash
pnpm --filter @realwise/api test
```

Expected: all tests pass (health controller spec, auth service spec, auth controller spec).

- [ ] **Step 7: Commit**

```bash
rtk git add apps/api/src/auth/auth.module.ts apps/api/src/app.module.ts apps/api/src/main.ts apps/api/src/health/health.controller.ts
rtk git commit -m "feat(api): wire AuthModule globally, add cookie-parser, mark /health as @Public"
```

---

## Task 8: Manual smoke test

This task verifies the full auth pipeline end-to-end against a running API.

- [ ] **Step 1: Start a local PostgreSQL and apply migrations**

```bash
docker run -d --name pg-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=realwise -p 5432:5432 postgres:16

DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" pnpm --filter @realwise/api migrate:run
```

Expected: both migrations apply, tables created.

- [ ] **Step 2: Create apps/api/.env for local testing**

```bash
DATABASE_URL=postgres://postgres:dev@localhost:5432/realwise
JWT_SECRET=local-dev-secret-at-least-32-chars
JWT_REFRESH_SECRET=local-dev-refresh-secret-at-least-32
API_BASE_URL=http://localhost:3001
FRONTEND_BASE_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NODE_ENV=development
```

- [ ] **Step 3: Start the API**

```bash
DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" \
JWT_SECRET="local-dev-secret-at-least-32-chars" \
pnpm --filter @realwise/api dev
```

Expected: `API running on port 3001`

- [ ] **Step 4: Verify /health is public**

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"..."}` — not a 401.

- [ ] **Step 5: Verify /auth/me is protected**

```bash
curl http://localhost:3001/auth/me
```

Expected: HTTP 401 `{"statusCode":401,"message":"Unauthorized"}`

- [ ] **Step 6: Verify /auth/google redirects**

Open in browser: `http://localhost:3001/auth/google?clientId=jonathalimax`

Expected: browser redirects to Google's consent screen (requires real `GOOGLE_CLIENT_ID`).

If you don't have Google credentials configured yet, the redirect will 400 — that's expected. The important thing is the API didn't 401 or 500.

- [ ] **Step 7: Verify refresh endpoint with no cookie**

```bash
curl -X POST http://localhost:3001/auth/refresh
```

Expected: HTTP 401 `{"statusCode":401,"message":"Unauthorized"}`

- [ ] **Step 8: Final commit with smoke test confirmation**

```bash
rtk git add apps/api/.env.example  # create if you made one
rtk git commit -m "feat(api): plan 4 complete — Passport.js auth, JWT cookies, global guard"
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | Auth npm deps + `refresh_token_hash` column + new migration |
| 2 | `JwtPayload` interface + `AuthService` with full unit tests |
| 3 | JWT strategy, `JwtAuthGuard`, `AdminGuard`, `@Public()`, `@CurrentUser()` |
| 4 | Google OAuth2 Passport strategy |
| 5 | Apple Sign-In Passport strategy |
| 6 | `AuthController` — all 7 auth routes with unit tests |
| 7 | `AuthModule` wired into `AppModule`, `cookie-parser` in `main.ts`, `@Public()` on `/health` |
| 8 | Manual smoke test against running API |
