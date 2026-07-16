# Plan 1: Monorepo + Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo as a pnpm monorepo with three apps (web, admin, api), provision a Hetzner CX32 VPS, install Coolify, and deploy all backing services (PostgreSQL, Redis, MinIO, Uptime Kuma).

**Architecture:** The existing React + Vite frontend moves to `apps/web/` unchanged. A minimal React + Vite admin app is scaffolded at `apps/admin/`. A minimal NestJS app with a `/health` endpoint is scaffolded at `apps/api/`. All three apps share TypeScript types via `packages/types/`. Backing services run as Docker containers managed by Coolify on the VPS.

**Tech Stack:** pnpm workspaces, React 19 + Vite 7, NestJS 10, Docker, Coolify, PostgreSQL 16, Redis 7, MinIO, Uptime Kuma

## Global Constraints

- Node.js ≥ 20
- pnpm ≥ 9
- All workspace packages use the `@realwise/` npm scope
- No secrets committed to git — all credentials go in Coolify secrets UI
- The existing `functions/` directory is NOT touched in this plan (removed in Plan 7)
- The existing `firebase.json`, `firestore.rules`, `storage.rules` are NOT touched (removed in Plan 7)

---

## File Map

### Created
- `pnpm-workspace.yaml` — workspace package globs
- `package.json` (root, rewritten) — workspace root, no app dependencies
- `apps/web/` — existing frontend files moved here
- `apps/web/package.json` — `@realwise/web`, all current frontend deps
- `apps/web/vite.config.js` — updated alias paths
- `apps/admin/` — new minimal React + Vite admin app
- `apps/admin/package.json` — `@realwise/admin`
- `apps/admin/index.html`
- `apps/admin/vite.config.js`
- `apps/admin/src/main.jsx`
- `apps/admin/src/App.jsx`
- `apps/api/` — new NestJS app
- `apps/api/package.json` — `@realwise/api`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.module.ts`
- `packages/types/package.json` — `@realwise/types`
- `packages/types/src/index.ts`
- `infrastructure/docker/docker-compose.yml` — local dev backing services
- `infrastructure/scripts/backup-postgres.sh` — daily backup script

### Modified
- `.gitignore` — add monorepo-specific entries

---

## Task 1: Initialize pnpm workspace root

**Files:**
- Rewrite: `package.json`
- Create: `pnpm-workspace.yaml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pnpm install` succeeds from repo root; `pnpm --filter @realwise/web dev` is the new way to start the frontend

- [ ] **Step 1: Rewrite root `package.json`**

Replace the entire file with:

```json
{
  "name": "realwise",
  "private": true,
  "scripts": {
    "web:dev": "pnpm --filter @realwise/web dev",
    "admin:dev": "pnpm --filter @realwise/admin dev",
    "api:dev": "pnpm --filter @realwise/api dev",
    "web:build": "pnpm --filter @realwise/web build",
    "admin:build": "pnpm --filter @realwise/admin build",
    "api:build": "pnpm --filter @realwise/api build",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Add monorepo entries to `.gitignore`**

Append to the existing `.gitignore`:

```
# monorepo
apps/*/dist
apps/*/node_modules
packages/*/dist
packages/*/node_modules
```

- [ ] **Step 4: Commit**

```bash
rtk git add package.json pnpm-workspace.yaml .gitignore
rtk git commit -m "chore: initialize pnpm monorepo workspace root"
```

---

## Task 2: Move frontend to `apps/web/`

**Files:**
- Create: `apps/web/` directory with all current frontend files
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.js`

**Interfaces:**
- Consumes: existing `src/`, `public/`, `landing_page/`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`
- Produces: `pnpm --filter @realwise/web dev` starts the app on port 5173; `pnpm --filter @realwise/web build` produces `apps/web/dist/`

- [ ] **Step 1: Create `apps/web/` directory and move files**

```bash
mkdir -p apps/web
mv src apps/web/src
mv public apps/web/public
mv landing_page apps/web/landing_page
mv index.html apps/web/index.html
mv tailwind.config.js apps/web/tailwind.config.js
mv postcss.config.js apps/web/postcss.config.js
mv eslint.config.js apps/web/eslint.config.js
```

- [ ] **Step 2: Create `apps/web/package.json`**

This is the old root `package.json` content, renamed and scoped:

```json
{
  "name": "@realwise/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@headlessui/react": "^2.2.9",
    "@heroicons/react": "^2.2.0",
    "@mui/material": "^7.3.7",
    "@mui/x-charts": "^8.26.0",
    "@tailwindcss/postcss": "^4.1.18",
    "@realwise/types": "workspace:*",
    "autoprefixer": "^10.4.23",
    "firebase": "^12.7.0",
    "framer-motion": "^12.23.26",
    "i18next": "^25.7.4",
    "lottie-react": "^2.4.1",
    "lucide-react": "^0.562.0",
    "papaparse": "^5.5.3",
    "pdfjs-dist": "^5.6.205",
    "postcss": "^8.5.6",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-i18next": "^16.5.1",
    "react-number-format": "^5.4.4",
    "react-router-dom": "^7.11.0",
    "tailwindcss": "^4.1.18",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "concurrently": "^9.2.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "googleapis": "^171.4.0",
    "sharp": "^0.34.5",
    "vite": "^7.3.1",
    "vite-plugin-pwa": "^1.2.0",
    "vitest": "^4.1.4"
  }
}
```

- [ ] **Step 3: Create `apps/web/vite.config.js`**

Same as root `vite.config.js` — alias paths are relative so they still resolve correctly:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

function copyStaticPages() {
  return {
    name: 'copy-static-pages',
    closeBundle() {
      copyFileSync(
        resolve(process.cwd(), 'public/sales-card.html'),
        resolve(process.cwd(), 'dist/sales-card.html')
      );
    },
  };
}

function readBuildHash() {
  try {
    const head = readFileSync(resolve(process.cwd(), '../../.git/HEAD'), 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const refPath = head.slice(5);
      const sha = readFileSync(resolve(process.cwd(), '../../.git', refPath), 'utf8').trim();
      return sha.slice(0, 7);
    }
    return head.slice(0, 7);
  } catch {
    return Date.now().toString(36);
  }
}
const buildHash = readBuildHash();

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      copyStaticPages(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        workbox: {
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        manifest: {
          name: 'Realwise',
          short_name: 'Realwise',
          start_url: '/loading',
          description: 'Controle financeiro pessoal simples e eficiente.',
          theme_color: '#f43f5e',
          background_color: '#f43f5e',
          display: 'standalone',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) return 'vendor-firebase';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor-react';
            if (id.includes('node_modules/@radix-ui')) return 'vendor-radix';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@landing': path.resolve(__dirname, './landing_page'),
      },
    },
    define: {
      __BUILD_HASH__: JSON.stringify(buildHash),
    },
    test: {
      environment: 'node',
      exclude: ['node_modules/**'],
    },
  }
})
```

- [ ] **Step 4: Install dependencies and verify the frontend builds**

```bash
pnpm install
pnpm --filter @realwise/web build
```

Expected: build succeeds, `apps/web/dist/` is created with `index.html` inside.

- [ ] **Step 5: Verify dev server starts**

```bash
pnpm --filter @realwise/web dev
```

Expected: Vite dev server starts at `http://localhost:5173`. Open the URL and confirm the app loads. Stop the server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/ pnpm-workspace.yaml
rtk git commit -m "chore: move frontend to apps/web/ monorepo structure"
```

---

## Task 3: Create shared types package

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/tsconfig.json`

**Interfaces:**
- Produces: `@realwise/types` importable in any workspace package; initially exports placeholder types that expand in later plans

- [ ] **Step 1: Create `packages/types/package.json`**

```json
{
  "name": "@realwise/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 2: Create `packages/types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/types/src/index.ts`**

```typescript
export interface ClientConfig {
  clientId: string;
  features: {
    investments: boolean;
    goals: boolean;
    b3Sync: boolean;
    whatsapp: boolean;
    salaryBreakdown: boolean;
  };
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export type UserRole = 'user' | 'admin';

export interface JwtPayload {
  sub: string;
  client_id: string;
  role: UserRole;
  iat: number;
  exp: number;
}
```

- [ ] **Step 4: Install and verify**

```bash
pnpm install
```

Expected: `node_modules/@realwise/types` symlink appears in `apps/web/node_modules/`.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/types/
rtk git commit -m "chore: add @realwise/types shared package"
```

---

## Task 4: Scaffold admin app (`apps/admin/`)

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/index.html`
- Create: `apps/admin/vite.config.js`
- Create: `apps/admin/src/main.jsx`
- Create: `apps/admin/src/App.jsx`

**Interfaces:**
- Produces: `pnpm --filter @realwise/admin dev` starts admin app on port 5174; `pnpm --filter @realwise/admin build` produces `apps/admin/dist/`

- [ ] **Step 1: Create `apps/admin/package.json`**

```json
{
  "name": "@realwise/admin",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5174",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@realwise/types": "workspace:*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.11.0",
    "lucide-react": "^0.562.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "vite": "^7.3.1"
  }
}
```

- [ ] **Step 2: Create `apps/admin/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Realwise Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `apps/admin/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create `apps/admin/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Create `apps/admin/src/App.jsx`**

```jsx
export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Realwise Admin</h1>
      <p>Coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 6: Install and verify**

```bash
pnpm install
pnpm --filter @realwise/admin build
```

Expected: build succeeds, `apps/admin/dist/` is created.

- [ ] **Step 7: Commit**

```bash
rtk git add apps/admin/
rtk git commit -m "chore: scaffold @realwise/admin app"
```

---

## Task 5: Scaffold NestJS API (`apps/api/`)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.controller.spec.ts`
- Create: `apps/api/Dockerfile`

**Interfaces:**
- Produces: `GET /health` returns `{ status: 'ok', timestamp: '<ISO string>' }` with HTTP 200; `pnpm --filter @realwise/api build` compiles to `apps/api/dist/`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@realwise/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@realwise/types": "workspace:*",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.8.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 3: Write the failing test first**

Create `apps/api/src/health/health.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('returns status ok with a timestamp', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm install
cd apps/api && pnpm test
```

Expected: FAIL — `Cannot find module './health.controller'`

- [ ] **Step 5: Create `apps/api/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

- [ ] **Step 6: Create `apps/api/src/health/health.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 7: Create `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

@Module({ imports: [HealthModule] })
export class AppModule {}
```

- [ ] **Step 8: Create `apps/api/src/main.ts`**

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}
bootstrap();
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
cd apps/api && pnpm test
```

Expected:
```
PASS src/health/health.controller.spec.ts
  HealthController
    ✓ returns status ok with a timestamp
```

- [ ] **Step 10: Verify the API starts and health endpoint responds**

```bash
pnpm --filter @realwise/api dev
```

In a second terminal:

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"2026-06-23T...Z"}`

Stop the server with Ctrl+C.

- [ ] **Step 11: Create `apps/api/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/
RUN pnpm --filter @realwise/api build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/main"]
```

- [ ] **Step 12: Build Docker image locally to verify**

```bash
docker build -t realwise-api:local -f apps/api/Dockerfile .
docker run --rm -p 3001:3001 realwise-api:local &
sleep 2
curl http://localhost:3001/health
docker stop $(docker ps -q --filter ancestor=realwise-api:local)
```

Expected: `{"status":"ok","timestamp":"..."}` from the container.

- [ ] **Step 13: Commit**

```bash
rtk git add apps/api/
rtk git commit -m "feat: scaffold @realwise/api NestJS app with /health endpoint"
```

---

## Task 6: Local dev Docker Compose

**Files:**
- Create: `infrastructure/docker/docker-compose.yml`

**Interfaces:**
- Produces: `docker compose -f infrastructure/docker/docker-compose.yml up -d` starts PostgreSQL on 5432, Redis on 6379, MinIO on 9000/9001

- [ ] **Step 1: Create `infrastructure/docker/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: realwise
      POSTGRES_USER: realwise
      POSTGRES_PASSWORD: realwise_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U realwise"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: realwise_dev
      MINIO_ROOT_PASSWORD: realwise_dev_secret
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

- [ ] **Step 2: Start services and verify**

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Expected output: three containers starting. Verify:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
```

Expected: all three services show `healthy` or `running`.

```bash
# Verify PostgreSQL
psql postgresql://realwise:realwise_dev@localhost:5432/realwise -c "SELECT 1;"

# Verify Redis
redis-cli ping

# Verify MinIO
curl http://localhost:9000/minio/health/live
```

Expected: `1`, `PONG`, HTTP 200.

- [ ] **Step 3: Stop services**

```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

- [ ] **Step 4: Commit**

```bash
rtk git add infrastructure/docker/
rtk git commit -m "chore: add local dev Docker Compose for backing services"
```

---

## Task 7: Backup script

**Files:**
- Create: `infrastructure/scripts/backup-postgres.sh`

**Interfaces:**
- Produces: executable script that dumps PostgreSQL to a gzipped file and optionally syncs to Hetzner Storage Box via rclone

- [ ] **Step 1: Create `infrastructure/scripts/backup-postgres.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Required environment variables:
# DATABASE_URL     — postgres connection string
# BACKUP_DIR       — local directory to write backup files
# RCLONE_REMOTE    — rclone remote name (e.g. "hetzner-box:backups/postgres")
#                    leave empty to skip rclone upload

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/realwise_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] dumping database to ${BACKUP_FILE}"
pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
echo "[backup] dump complete: $(du -sh "${BACKUP_FILE}" | cut -f1)"

# Prune local backups older than 7 days
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +7 -delete
echo "[backup] pruned local backups older than 7 days"

# Upload to remote if configured
if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  echo "[backup] syncing to ${RCLONE_REMOTE}"
  rclone copy "${BACKUP_FILE}" "${RCLONE_REMOTE}"
  echo "[backup] sync complete"
fi

echo "[backup] done"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infrastructure/scripts/backup-postgres.sh
```

- [ ] **Step 3: Commit**

```bash
rtk git add infrastructure/scripts/
rtk git commit -m "chore: add PostgreSQL backup script"
```

---

## Task 8: Hetzner VPS + Coolify provisioning

> This task is manual. Follow each step exactly. No automated verification — confirm each step visually before proceeding.

**Interfaces:**
- Produces: Coolify dashboard accessible at `http://<vps-ip>:8000`; PostgreSQL, Redis, MinIO, Uptime Kuma running as Coolify-managed services

- [ ] **Step 1: Create Hetzner VPS**

1. Log into [console.hetzner.cloud](https://console.hetzner.cloud)
2. Create new project: `realwise`
3. Add server:
   - Location: Falkenstein or Nuremberg (EU) — lowest latency to Brazil after US
   - Image: Ubuntu 24.04
   - Type: CX32 (4 vCPU / 8 GB RAM / 80 GB SSD)
   - SSH key: add your public key
   - Name: `realwise-prod`
4. Note the public IPv4 address — referred to as `<VPS_IP>` below

- [ ] **Step 2: Configure firewall**

In Hetzner console → Firewalls → Create firewall `realwise-fw`:

Inbound rules:
```
TCP  22    0.0.0.0/0   (SSH)
TCP  80    0.0.0.0/0   (HTTP)
TCP  443   0.0.0.0/0   (HTTPS)
TCP  8000  <YOUR_IP>/32  (Coolify dashboard — restrict to your IP)
```

Apply to `realwise-prod` server.

- [ ] **Step 3: SSH into the VPS and install Docker**

```bash
ssh root@<VPS_IP>
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Verify:

```bash
docker --version
```

Expected: `Docker version 27.x.x` or later.

- [ ] **Step 4: Install Coolify**

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Wait for installation to complete (~3 minutes). Expected output ends with:
```
Coolify is ready to use!
Please visit http://<VPS_IP>:8000
```

- [ ] **Step 5: Complete Coolify setup**

1. Open `http://<VPS_IP>:8000` in your browser
2. Create admin account (save credentials in your password manager)
3. Complete the onboarding wizard (select "localhost" as server — Coolify manages its own host)

- [ ] **Step 6: Deploy PostgreSQL 16**

In Coolify → New Resource → Database → PostgreSQL:
- Name: `realwise-postgres`
- Version: 16
- Database name: `realwise`
- Username: `realwise`
- Password: generate a strong password, save it
- Internal port: 5432 (do NOT expose externally)

Click Deploy. Wait until status shows `Running`.

- [ ] **Step 7: Deploy Redis 7**

In Coolify → New Resource → Database → Redis:
- Name: `realwise-redis`
- Version: 7
- Password: generate a strong password, save it
- Internal port: 6379 (do NOT expose externally)

Click Deploy. Wait until status shows `Running`.

- [ ] **Step 8: Deploy MinIO**

In Coolify → New Resource → Service → MinIO:
- Name: `realwise-minio`
- Root user: `realwise`
- Root password: generate a strong password, save it
- Expose console on: `minio.realwise.com.br` (set DNS A record → `<VPS_IP>` first)

Click Deploy. Verify MinIO console is accessible at `https://minio.realwise.com.br`.

- [ ] **Step 9: Deploy Uptime Kuma**

In Coolify → New Resource → Service → Uptime Kuma:
- Name: `realwise-uptime`
- Domain: `uptime.realwise.com.br` (set DNS A record → `<VPS_IP>` first)

Click Deploy. Open `https://uptime.realwise.com.br` and complete initial setup.

- [ ] **Step 10: Add monitors in Uptime Kuma**

Add these monitors:
```
HTTP   realwise.com.br               (frontend — add after Plan 2)
HTTP   api.realwise.com.br/health    (API — add after Plan 2)
HTTP   admin.realwise.com.br         (admin — add after Plan 2)
TCP    <postgres-internal-host>:5432  (PostgreSQL)
TCP    <redis-internal-host>:6379     (Redis)
HTTP   minio.realwise.com.br/minio/health/live  (MinIO)
```

Configure email alerts: Settings → Notifications → Email (SMTP) with Umbler credentials.

- [ ] **Step 11: Create MinIO bucket**

In MinIO console at `https://minio.realwise.com.br`:
1. Create bucket: `realwise-attachments`
2. Set access policy: private (no public read)

- [ ] **Step 12: Record all credentials**

Save in your password manager:
```
VPS IP:               <VPS_IP>
Coolify URL:          http://<VPS_IP>:8000
Coolify admin:        <email> / <password>
PostgreSQL URL:       postgresql://realwise:<pw>@realwise-postgres:5432/realwise
Redis URL:            redis://:<pw>@realwise-redis:6379
MinIO endpoint:       http://realwise-minio:9000
MinIO access key:     realwise
MinIO secret key:     <pw>
MinIO bucket:         realwise-attachments
```

---

## Task 9: DNS configuration

> Manual steps — do in your DNS provider (Cloudflare, Route53, etc.)

- [ ] **Step 1: Add DNS A records**

```
realwise.com.br          A  <VPS_IP>
api.realwise.com.br      A  <VPS_IP>
admin.realwise.com.br    A  <VPS_IP>
minio.realwise.com.br    A  <VPS_IP>
uptime.realwise.com.br   A  <VPS_IP>
staging.realwise.com.br  A  <VPS_IP>
```

- [ ] **Step 2: Wait for DNS propagation**

```bash
dig realwise.com.br +short
```

Expected: `<VPS_IP>`. May take up to 5 minutes with Cloudflare (orange-cloud proxy) or up to 48 hours with other providers.

- [ ] **Step 3: Verify Coolify SSL provisioning**

Coolify uses Let's Encrypt automatically. After DNS propagates, check that `https://minio.realwise.com.br` loads with a valid SSL certificate (green padlock).

---

## Verification Checklist

Before moving to Plan 2, confirm every item:

- [ ] `pnpm install` succeeds from repo root
- [ ] `pnpm --filter @realwise/web build` succeeds
- [ ] `pnpm --filter @realwise/admin build` succeeds
- [ ] `pnpm --filter @realwise/api build` succeeds
- [ ] `pnpm --filter @realwise/api test` passes (1 test)
- [ ] `docker build -t realwise-api:local -f apps/api/Dockerfile .` succeeds
- [ ] `curl http://localhost:3001/health` returns `{"status":"ok","timestamp":"..."}` from Docker
- [ ] `docker compose -f infrastructure/docker/docker-compose.yml up -d` starts all 3 services healthy
- [ ] Coolify dashboard accessible at `http://<VPS_IP>:8000`
- [ ] PostgreSQL, Redis, MinIO, Uptime Kuma show `Running` in Coolify
- [ ] `https://minio.realwise.com.br` loads with valid SSL
- [ ] `https://uptime.realwise.com.br` loads with valid SSL
- [ ] All DNS A records resolve to `<VPS_IP>`
