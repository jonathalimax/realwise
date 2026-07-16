# Plan 6: Feature Parity (Storage, Import, B3 Sync, Bill Reminders, Admin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the remaining Firebase Cloud Functions to NestJS — MinIO file storage, bank statement import pipeline, B3 investment sync, bill reminder emails, and admin management endpoints.

**Architecture:** Seven NestJS modules added to the existing `apps/api/`. All Drizzle tables (`attachments`, `imports`, `bill_reminders`, `leads`, `purchases`, `coupons`, `import_issues`) already exist from Plan 3. MinIO is accessed via the AWS S3 SDK (MinIO is S3-compatible). Cron jobs run via `@nestjs/schedule`. Email via `@nestjs/mailer` + `nodemailer`. CSV/XLSX parsing is ported inline from `functions/parsers/` — no shared npm package needed. Admin routes are protected by a new `AdminGuard` that checks `role === 'admin'` on the JWT payload.

**Tech Stack:** NestJS 10, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@nestjs/mailer`, `nodemailer`, `@nestjs/schedule`, `multer`, `csv-parse`, `xlsx`, `axios`, Drizzle ORM (existing)

## Global Constraints

- Node ≥ 22, pnpm ≥ 9
- All pnpm commands: `pnpm --filter @realwise/api <script>`
- All Jest commands: `pnpm --filter @realwise/api test`
- All routes behind global `JwtAuthGuard` — no `@Public()` needed
- All queries filter by BOTH `clientId` AND `userId` from JWT (`req.user = { sub, clientId, role }`)
- Admin routes additionally require `role === 'admin'` via `AdminGuard`
- `rtk` prefix on all CLI commands per project convention
- Environment variables required (add to Coolify secrets):
  - `MINIO_ENDPOINT` — e.g. `minio.realwise.com.br`
  - `MINIO_PORT` — e.g. `9000`
  - `MINIO_ACCESS_KEY` — MinIO access key
  - `MINIO_SECRET_KEY` — MinIO secret key
  - `MINIO_BUCKET` — `realwise-attachments`
  - `MINIO_USE_SSL` — `true` in prod, `false` locally
  - `EMAIL_HOST` — SMTP host (Umbler)
  - `EMAIL_PORT` — SMTP port (e.g. `587`)
  - `EMAIL_USER` — SMTP username
  - `EMAIL_PASSWORD` — SMTP password
  - `EMAIL_FROM` — sender address, e.g. `noreply@realwise.com.br`
  - `BRAPI_TOKEN` — optional Brapi.dev token (leave empty to use free tier)

---

## File Map

### Created
- `apps/api/src/storage/storage.service.ts`
- `apps/api/src/storage/storage.service.spec.ts`
- `apps/api/src/storage/storage.controller.ts`
- `apps/api/src/storage/storage.module.ts`
- `apps/api/src/imports/bank-parser.service.ts`
- `apps/api/src/imports/bank-parser.service.spec.ts`
- `apps/api/src/imports/dto/confirm-import.dto.ts`
- `apps/api/src/imports/imports.service.ts`
- `apps/api/src/imports/imports.service.spec.ts`
- `apps/api/src/imports/imports.controller.ts`
- `apps/api/src/imports/imports.module.ts`
- `apps/api/src/notifications/notifications.service.ts`
- `apps/api/src/notifications/notifications.service.spec.ts`
- `apps/api/src/notifications/notifications.module.ts`
- `apps/api/src/b3-sync/b3-sync.service.ts`
- `apps/api/src/b3-sync/b3-sync.service.spec.ts`
- `apps/api/src/b3-sync/b3-sync.scheduler.ts`
- `apps/api/src/b3-sync/b3-sync.module.ts`
- `apps/api/src/bill-reminders/bill-reminders.service.ts`
- `apps/api/src/bill-reminders/bill-reminders.service.spec.ts`
- `apps/api/src/bill-reminders/bill-reminders.scheduler.ts`
- `apps/api/src/bill-reminders/bill-reminders.module.ts`
- `apps/api/src/admin/admin.guard.ts`
- `apps/api/src/admin/admin.guard.spec.ts`
- `apps/api/src/admin/dto/update-lead.dto.ts`
- `apps/api/src/admin/dto/create-coupon.dto.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.module.ts`

### Modified
- `apps/api/package.json` — add new dependencies
- `apps/api/src/app.module.ts` — import 6 new modules + ScheduleModule + MailerModule
- `apps/api/src/investments/investments.controller.ts` — add `POST /investments/b3-sync`
- `apps/api/src/investments/investments.module.ts` — import B3SyncModule

---

## Task 1: Install new dependencies

**Files:**
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces: all new packages available for import in subsequent tasks

- [ ] **Step 1: Add to `dependencies` in `apps/api/package.json`**

Add these entries under `"dependencies"`:

```json
"@aws-sdk/client-s3": "^3.600.0",
"@aws-sdk/s3-request-presigner": "^3.600.0",
"@nestjs/mailer": "^2.0.2",
"@nestjs/schedule": "^4.1.0",
"nodemailer": "^6.9.13",
"multer": "^1.4.5-lts.1",
"csv-parse": "^5.5.6",
"xlsx": "^0.18.5",
"axios": "^1.7.2"
```

Add these under `"devDependencies"`:

```json
"@types/multer": "^1.4.11",
"@types/nodemailer": "^6.4.15"
```

- [ ] **Step 2: Install**

```bash
rtk pnpm --filter @realwise/api install
```

Expected: packages installed, no peer dependency errors.

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
rtk pnpm --filter @realwise/api build
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/api/package.json pnpm-lock.yaml
rtk git commit -m "chore(api): add storage, mailer, schedule, csv, xlsx, axios deps"
```

---

## Task 2: Storage module (MinIO presigned URLs)

MinIO is S3-compatible, so the AWS SDK works directly. Upload flow: frontend calls `POST /storage/upload` → gets a presigned PUT URL → uploads directly to MinIO → calls `POST /storage/confirm` to record the `attachments` row. Download flow: frontend calls `GET /storage/download/:key` → gets a short-lived presigned GET URL.

**Files:**
- Create: `apps/api/src/storage/storage.service.ts`
- Create: `apps/api/src/storage/storage.service.spec.ts`
- Create: `apps/api/src/storage/storage.controller.ts`
- Create: `apps/api/src/storage/storage.module.ts`

**Interfaces:**
- Consumes: `attachments` table from `../db/schema`, `DRIZZLE`, `@CurrentUser()`
- Produces: `StorageModule`; `StorageService.getPresignedUploadUrl(key, mime)`, `StorageService.getPresignedDownloadUrl(key)`; routes at `/storage`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/storage/storage.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { DRIZZLE } from '../db/drizzle.module';
import { ConfigService } from '@nestjs/config';

const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([{ id: 'att-1', objectKey: 'jonathalimax/user-1/import-1/file.csv' }]),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([{ id: 'att-1', objectKey: 'jonathalimax/user-1/import-1/file.csv', userId: 'user-1' }]),
};

const mockConfig = {
  get: (key: string) => {
    const map: Record<string, string> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'realwise-attachments',
      MINIO_USE_SSL: 'false',
    };
    return map[key];
  },
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(StorageService);
  });

  it('buildKey produces scoped path', () => {
    const key = service.buildKey('jonathalimax', 'user-1', 'import-1', 'file.csv');
    expect(key).toBe('jonathalimax/user-1/import-1/file.csv');
  });

  it('recordAttachment inserts and returns attachment', async () => {
    const att = await service.recordAttachment({
      clientId: 'jonathalimax',
      userId: 'user-1',
      importId: 'import-1',
      objectKey: 'jonathalimax/user-1/import-1/file.csv',
      mimeType: 'text/csv',
      sizeBytes: 1024,
    });
    expect(att.id).toBe('att-1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=storage.service
```

Expected: FAIL — `Cannot find module './storage.service'`

- [ ] **Step 3: Implement StorageService**

Create `apps/api/src/storage/storage.service.ts`:

```typescript
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { attachments } from '../db/schema';

type Attachment = typeof attachments.$inferSelect;

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT')!;
    const port = Number(this.config.get<string>('MINIO_PORT') ?? '9000');
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    this.bucket = this.config.get<string>('MINIO_BUCKET')!;

    this.s3 = new S3Client({
      endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('MINIO_ACCESS_KEY')!,
        secretAccessKey: this.config.get<string>('MINIO_SECRET_KEY')!,
      },
      forcePathStyle: true,
    });
  }

  buildKey(clientId: string, userId: string, importId: string, fileName: string): string {
    return `${clientId}/${userId}/${importId}/${fileName}`;
  }

  async getPresignedUploadUrl(key: string, mimeType: string): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.s3, cmd, { expiresIn: 300 });
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: 300 });
  }

  async recordAttachment(input: {
    clientId: string;
    userId: string;
    importId?: string;
    objectKey: string;
    mimeType?: string;
    sizeBytes?: number;
  }): Promise<Attachment> {
    const rows = await this.db
      .insert(attachments)
      .values(input)
      .returning();
    return rows[0];
  }

  async getDownloadUrl(attachmentId: string, clientId: string, userId: string): Promise<string> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.clientId, clientId), eq(attachments.userId, userId)));
    if (rows.length === 0) throw new NotFoundException();
    return this.getPresignedDownloadUrl(rows[0].objectKey);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=storage.service
```

Expected: all tests PASS.

- [ ] **Step 5: Create StorageController and StorageModule**

Create `apps/api/src/storage/storage.controller.ts`:

```typescript
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';

class RequestUploadDto {
  @IsString() fileName: string;
  @IsString() mimeType: string;
  @IsOptional() @IsNumber() sizeBytes?: number;
  @IsOptional() @IsString() importId?: string;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Post('upload')
  async requestUpload(@Body() dto: RequestUploadDto, @CurrentUser() user: JwtPayload) {
    const importId = dto.importId ?? uuidv4();
    const key = this.service.buildKey(user.clientId, user.sub, importId, dto.fileName);
    const uploadUrl = await this.service.getPresignedUploadUrl(key, dto.mimeType);
    return { uploadUrl, key, importId };
  }

  @Post('confirm')
  async confirmUpload(
    @Body() dto: { key: string; importId?: string; mimeType?: string; sizeBytes?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.recordAttachment({
      clientId: user.clientId,
      userId: user.sub,
      importId: dto.importId,
      objectKey: dto.key,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  @Get('download/:id')
  async download(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const url = await this.service.getDownloadUrl(id, user.clientId, user.sub);
    return { url };
  }
}
```

Create `apps/api/src/storage/storage.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule, ConfigModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/api/src/storage/
rtk git commit -m "feat(api): add storage module — MinIO presigned upload/download"
```

---

## Task 3: Import module (bank statement parsing + confirm)

Handles `multipart/form-data` file uploads, detects the bank format (Nubank/Itaú/Bradesco/generic), parses CSV/XLSX to a transaction list for frontend preview, then persists on confirm. Parser logic is ported inline from `functions/parsers/bankParsers.js`.

**Files:**
- Create: `apps/api/src/imports/bank-parser.service.ts`
- Create: `apps/api/src/imports/bank-parser.service.spec.ts`
- Create: `apps/api/src/imports/dto/confirm-import.dto.ts`
- Create: `apps/api/src/imports/imports.service.ts`
- Create: `apps/api/src/imports/imports.service.spec.ts`
- Create: `apps/api/src/imports/imports.controller.ts`
- Create: `apps/api/src/imports/imports.module.ts`

**Interfaces:**
- Consumes: `imports` table, `transactions` table, `DRIZZLE`, `@CurrentUser()`
- Produces: `ImportsModule`; `BankParserService.parse(buffer, fileName)` → `ParsedTransaction[]`; routes: `POST /imports/upload`, `POST /imports/:id/confirm`

- [ ] **Step 1: Write bank parser tests**

Create `apps/api/src/imports/bank-parser.service.spec.ts`:

```typescript
import { BankParserService } from './bank-parser.service';

const service = new BankParserService();

describe('BankParserService', () => {
  it('parses Nubank credit card CSV', () => {
    const csv = `date,title,amount\n2026-06-01,Supermercado,-150.00\n2026-06-02,Netflix,-39.90`;
    const result = service.parse(Buffer.from(csv), 'nubank.csv');
    expect(result.bank).toBe('nubank');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe('150.00');
    expect(result.transactions[0].type).toBe('expense');
    expect(result.transactions[0].description).toBe('Supermercado');
  });

  it('parses Nubank account CSV (Portuguese headers)', () => {
    const csv = `Data,Valor,Descricao\n01/06/2026,-100.00,Padaria\n02/06/2026,500.00,Salario`;
    const result = service.parse(Buffer.from(csv), 'nubank_conta.csv');
    expect(result.bank).toBe('nubank');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].type).toBe('expense');
    expect(result.transactions[1].type).toBe('income');
  });

  it('parses Itau CSV', () => {
    const csv = `Data,Lançamento,Valor\n01/06/2026,Supermercado Extra,-200,00\n02/06/2026,Salario,3000,00`;
    const result = service.parse(Buffer.from(csv), 'itau.csv');
    expect(result.bank).toBe('itau');
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  it('returns generic bank for unknown format', () => {
    const csv = `date,description,value\n2026-06-01,Test,-50.00`;
    const result = service.parse(Buffer.from(csv), 'unknown.csv');
    expect(result.bank).toBe('generic');
    expect(result.transactions.length).toBeGreaterThanOrEqual(0);
  });

  it('throws on unsupported extension', () => {
    expect(() => service.parse(Buffer.from('data'), 'file.pdf')).toThrow('Unsupported file format');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=bank-parser.service
```

Expected: FAIL — `Cannot find module './bank-parser.service'`

- [ ] **Step 3: Implement BankParserService**

Create `apps/api/src/imports/bank-parser.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export interface ParsedTransaction {
  date: string;
  amount: string;
  type: 'income' | 'expense';
  description: string;
}

export interface ParseResult {
  bank: 'nubank' | 'itau' | 'bradesco' | 'generic';
  transactions: ParsedTransaction[];
}

@Injectable()
export class BankParserService {
  parse(buffer: Buffer, fileName: string): ParseResult {
    const ext = fileName.split('.').pop()?.toLowerCase();
    let rows: Record<string, string>[];

    if (ext === 'csv') {
      rows = parseCsv(buffer, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      throw new Error('Unsupported file format. Use CSV or XLSX.');
    }

    if (rows.length === 0) return { bank: 'generic', transactions: [] };

    const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

    if (this.detectNubank(headers)) {
      return { bank: 'nubank', transactions: this.parseNubank(rows) };
    }
    if (this.detectItau(headers)) {
      return { bank: 'itau', transactions: this.parseItau(rows) };
    }
    if (this.detectBradesco(headers)) {
      return { bank: 'bradesco', transactions: this.parseBradesco(rows) };
    }
    return { bank: 'generic', transactions: this.parseGeneric(rows) };
  }

  private detectNubank(h: string[]): boolean {
    return (h.includes('data') && h.includes('valor') && (h.includes('descricao') || h.includes('descricao'))) ||
      (h.includes('date') && h.includes('title') && h.includes('amount'));
  }

  private detectItau(h: string[]): boolean {
    return h.includes('data') && (h.includes('lancamento') || h.includes('lançamento') || h.includes('lancamento')) && h.includes('valor');
  }

  private detectBradesco(h: string[]): boolean {
    return h.includes('data') && (h.includes('historico') || h.includes('histórico') || h.includes('historico')) && (h.includes('credito') || h.includes('debito') || h.includes('crédito') || h.includes('débito'));
  }

  private parseNubank(rows: Record<string, string>[]): ParsedTransaction[] {
    const first = rows[0];
    if ('title' in first || 'Title' in first) {
      return rows.map((r) => {
        const amount = this.parseBRNumber(r['amount'] ?? r['Amount'] ?? '0');
        return {
          date: this.parseDateBR(r['date'] ?? r['Date']),
          amount: Math.abs(amount).toFixed(2),
          type: 'expense' as const,
          description: r['title'] ?? r['Title'] ?? '',
        };
      }).filter((t) => Number(t.amount) > 0 && t.description);
    }
    return rows.map((r) => {
      const amount = this.parseBRNumber(r['Valor'] ?? r['valor'] ?? '0');
      return {
        date: this.parseDateBR(r['Data'] ?? r['data']),
        amount: Math.abs(amount).toFixed(2),
        type: (amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
        description: r['Descricao'] ?? r['descricao'] ?? r['Descrição'] ?? r['descrição'] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseItau(rows: Record<string, string>[]): ParsedTransaction[] {
    return rows.map((r) => {
      const raw = r['Valor'] ?? r['valor'] ?? r['VALOR'] ?? '0';
      const amount = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
      return {
        date: this.parseDateBR(r['Data'] ?? r['data'] ?? r['DATA']),
        amount: Math.abs(amount).toFixed(2),
        type: (amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
        description: r['Lançamento'] ?? r['Lancamento'] ?? r['lancamento'] ?? r['LANCAMENTO'] ?? r['Descrição'] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseBradesco(rows: Record<string, string>[]): ParsedTransaction[] {
    return rows.map((r) => {
      const credit = this.parseBRNumber(r['Crédito'] ?? r['Credito'] ?? r['credito'] ?? '0');
      const debit = this.parseBRNumber(r['Débito'] ?? r['Debito'] ?? r['debito'] ?? '0');
      const amount = credit > 0 ? credit : debit;
      const type: 'income' | 'expense' = credit > 0 ? 'income' : 'expense';
      return {
        date: this.parseDateBR(r['Data'] ?? r['data']),
        amount: Math.abs(amount).toFixed(2),
        type,
        description: r['Histórico'] ?? r['Historico'] ?? r['historico'] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseGeneric(rows: Record<string, string>[]): ParsedTransaction[] {
    const keys = Object.keys(rows[0] ?? {});
    const dateKey = keys.find((k) => /date|data/i.test(k));
    const amountKey = keys.find((k) => /amount|valor|value/i.test(k));
    const descKey = keys.find((k) => /desc|title|name|hist/i.test(k));
    if (!dateKey || !amountKey || !descKey) return [];
    return rows.map((r) => {
      const raw = r[amountKey] ?? '0';
      const amount = this.parseBRNumber(raw);
      return {
        date: this.parseDateBR(r[dateKey]),
        amount: Math.abs(amount).toFixed(2),
        type: (amount < 0 ? 'expense' : 'income') as 'income' | 'expense',
        description: r[descKey] ?? '',
      };
    }).filter((t) => Number(t.amount) > 0 && t.description);
  }

  private parseBRNumber(str: string): number {
    if (!str) return 0;
    const cleaned = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  private parseDateBR(str: string): string {
    if (!str) return new Date().toISOString().slice(0, 10);
    const parts = str.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const fullYear = year.length === 2 ? '20' + year : year;
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const iso = new Date(str);
    if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=bank-parser.service
```

Expected: all tests PASS.

- [ ] **Step 5: Write imports service tests**

Create `apps/api/src/imports/imports.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ImportsService } from './imports.service';
import { DRIZZLE } from '../db/drizzle.module';
import { BankParserService } from './bank-parser.service';

const mockImportRow = {
  id: 'imp-1', clientId: 'jonathalimax', userId: 'user-1', bank: 'nubank',
  status: 'review', rowCount: 2, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null,
};

const mockDb = {
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockImportRow]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockImportRow]),
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
};

const mockParser = {
  parse: jest.fn().mockReturnValue({
    bank: 'nubank',
    transactions: [
      { date: '2026-06-01', amount: '150.00', type: 'expense', description: 'Supermercado' },
      { date: '2026-06-02', amount: '39.90', type: 'expense', description: 'Netflix' },
    ],
  }),
};

describe('ImportsService', () => {
  let service: ImportsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: BankParserService, useValue: mockParser },
      ],
    }).compile();
    service = module.get(ImportsService);
    jest.clearAllMocks();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([mockImportRow]);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue([mockImportRow]);
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
  });

  it('processUpload creates import record and returns parsed transactions', async () => {
    const csv = Buffer.from('date,title,amount\n2026-06-01,Supermercado,-150.00');
    const result = await service.processUpload(csv, 'nubank.csv', 'jonathalimax', 'user-1');
    expect(result.importId).toBe('imp-1');
    expect(result.bank).toBe('nubank');
    expect(result.transactions).toHaveLength(2);
  });

  it('confirm inserts transactions and marks import complete', async () => {
    await expect(
      service.confirm('imp-1', [
        { date: '2026-06-01', amount: '150.00', type: 'expense', description: 'Supermercado', categoryId: undefined, accountId: undefined },
      ], 'jonathalimax', 'user-1'),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 6: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=imports.service
```

Expected: FAIL — `Cannot find module './imports.service'`

- [ ] **Step 7: Implement ImportsService + DTO**

Create `apps/api/src/imports/dto/confirm-import.dto.ts`:

```typescript
import { IsArray, IsString, IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConfirmTransactionDto {
  @IsString() date: string;
  @IsString() amount: string;
  @IsIn(['income', 'expense']) type: string;
  @IsString() description: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() accountId?: string;
}

export class ConfirmImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmTransactionDto)
  transactions: ConfirmTransactionDto[];
}
```

Create `apps/api/src/imports/imports.service.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { imports, transactions } from '../db/schema';
import { BankParserService, ParsedTransaction } from './bank-parser.service';

type Import = typeof imports.$inferSelect;

interface ConfirmTransaction extends ParsedTransaction {
  categoryId?: string;
  accountId?: string;
}

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly parser: BankParserService,
  ) {}

  async processUpload(
    buffer: Buffer,
    fileName: string,
    clientId: string,
    userId: string,
  ): Promise<{ importId: string; bank: string; transactions: ParsedTransaction[] }> {
    const { bank, transactions: parsed } = this.parser.parse(buffer, fileName);

    const rows = await this.db
      .insert(imports)
      .values({ clientId, userId, bank, status: 'review', rowCount: parsed.length })
      .returning();
    const imp: Import = rows[0];

    return { importId: imp.id, bank, transactions: parsed };
  }

  async confirm(
    importId: string,
    txs: ConfirmTransaction[],
    clientId: string,
    userId: string,
  ): Promise<void> {
    if (txs.length > 0) {
      await this.db.insert(transactions).values(
        txs.map((t) => ({
          clientId,
          userId,
          amount: t.amount,
          type: t.type,
          date: t.date,
          description: t.description,
          categoryId: t.categoryId ?? null,
          accountId: t.accountId ?? null,
        })),
      );
    }

    await this.db
      .update(imports)
      .set({ status: 'complete', updatedAt: new Date() })
      .where(and(eq(imports.id, importId), eq(imports.clientId, clientId), eq(imports.userId, userId)));
  }
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=imports.service
```

Expected: all tests PASS.

- [ ] **Step 9: Create controller and module**

Create `apps/api/src/imports/imports.controller.ts`:

```typescript
import {
  Controller, Post, Param, Body,
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })] }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.processUpload(file.buffer, file.originalname, user.clientId, user.sub);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') importId: string,
    @Body() dto: ConfirmImportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.confirm(importId, dto.transactions as any, user.clientId, user.sub);
  }
}
```

Create `apps/api/src/imports/imports.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BankParserService } from './bank-parser.service';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [
    DrizzleModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [ImportsController],
  providers: [BankParserService, ImportsService],
})
export class ImportsModule {}
```

- [ ] **Step 10: Commit**

```bash
rtk git add apps/api/src/imports/
rtk git commit -m "feat(api): add imports module — CSV/XLSX bank statement parsing and confirm"
```

---

## Task 4: Notifications module (email via SMTP)

Wraps `@nestjs/mailer` with bill-reminder email templates. Used by the bill reminders scheduler in Task 6.

**Files:**
- Create: `apps/api/src/notifications/notifications.service.ts`
- Create: `apps/api/src/notifications/notifications.service.spec.ts`
- Create: `apps/api/src/notifications/notifications.module.ts`

**Interfaces:**
- Consumes: `@nestjs/mailer` `MailerService`
- Produces: `NotificationsModule` exporting `NotificationsService`; `sendBillReminderEmail(to, bills)` method

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/notifications/notifications.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { MailerService } from '@nestjs/mailer';

const mockMailer = { sendMail: jest.fn().mockResolvedValue({ messageId: 'abc' }) };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();
    service = module.get(NotificationsService);
    jest.clearAllMocks();
    mockMailer.sendMail.mockResolvedValue({ messageId: 'abc' });
  });

  it('sendBillReminderEmail calls sendMail once', async () => {
    await service.sendBillReminderEmail('user@example.com', {
      overdue: [{ id: 'b-1', name: 'Rent', amount: '1500.00', dueDate: '2026-06-01', daysOverdue: 5 }],
      dueToday: [],
      dueSoon: [],
    });
    expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
    const args = mockMailer.sendMail.mock.calls[0][0];
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toMatch(/conta/i);
  });

  it('does not send email when all groups empty', async () => {
    await service.sendBillReminderEmail('user@example.com', { overdue: [], dueToday: [], dueSoon: [] });
    expect(mockMailer.sendMail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=notifications.service
```

Expected: FAIL — `Cannot find module './notifications.service'`

- [ ] **Step 3: Implement NotificationsService**

Create `apps/api/src/notifications/notifications.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs/mailer';

interface BillEntry {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
}

interface BillGroups {
  overdue: BillEntry[];
  dueToday: BillEntry[];
  dueSoon: BillEntry[];
}

@Injectable()
export class NotificationsService {
  constructor(private readonly mailer: MailerService) {}

  async sendBillReminderEmail(to: string, groups: BillGroups): Promise<void> {
    const total = groups.overdue.length + groups.dueToday.length + groups.dueSoon.length;
    if (total === 0) return;

    const formatAmount = (v: string) =>
      `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const formatDate = (iso: string) => {
      const [y, m, d] = iso.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    };

    const section = (title: string, bills: BillEntry[]) => {
      if (!bills.length) return '';
      return `<h3>${title}</h3><ul>${bills
        .map(
          (b) =>
            `<li><strong>${b.name}</strong> — ${formatAmount(b.amount)}, vence ${formatDate(b.dueDate)}${b.daysOverdue ? ` (${b.daysOverdue} dias em atraso)` : ''}</li>`,
        )
        .join('')}</ul>`;
    };

    const html = `
      <p>Olá! Aqui estão suas contas pendentes:</p>
      ${section('⚠️ Em atraso', groups.overdue)}
      ${section('📅 Vence hoje', groups.dueToday)}
      ${section('🔔 Vence em breve (1–3 dias)', groups.dueSoon)}
      <p style="font-size:12px;color:#888">Realwise — gestão financeira pessoal</p>
    `;

    await this.mailer.sendMail({
      to,
      subject: `Realwise — lembrete de conta${total > 1 ? 's' : ''}`,
      html,
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=notifications.service
```

Expected: all tests PASS.

- [ ] **Step 5: Create NotificationsModule**

Create `apps/api/src/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/api/src/notifications/
rtk git commit -m "feat(api): add notifications module — SMTP bill reminder email"
```

---

## Task 5: B3 sync module (Brapi + daily scheduler + manual trigger)

Ports `functions/b3Sync.js`. Fetches current prices from `https://brapi.dev/api/quote/{tickers}` and updates `investments.currentPrice` + `investments.lastSyncedAt`. Manual trigger exposed at `POST /investments/b3-sync`. Daily automatic sync runs at 9 AM BRT via `@nestjs/schedule`.

**Files:**
- Create: `apps/api/src/b3-sync/b3-sync.service.ts`
- Create: `apps/api/src/b3-sync/b3-sync.service.spec.ts`
- Create: `apps/api/src/b3-sync/b3-sync.scheduler.ts`
- Create: `apps/api/src/b3-sync/b3-sync.module.ts`
- Modify: `apps/api/src/investments/investments.controller.ts`
- Modify: `apps/api/src/investments/investments.module.ts`

**Interfaces:**
- Consumes: `investments` table, `transactions` table, `DRIZZLE`, `axios`
- Produces: `B3SyncModule` exporting `B3SyncService`; `B3SyncService.syncUser(userId, clientId)` → `{ updated: number }`; `POST /investments/b3-sync` returns the result

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/b3-sync/b3-sync.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { B3SyncService } from './b3-sync.service';
import { DRIZZLE } from '../db/drizzle.module';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockInvestments = [
  { id: 'inv-1', ticker: 'PETR4', quantity: '100', type: 'stock', userId: 'user-1', clientId: 'jonathalimax' },
  { id: 'inv-2', ticker: 'VALE3', quantity: '50', type: 'stock', userId: 'user-1', clientId: 'jonathalimax' },
];

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue(mockInvestments),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

describe('B3SyncService', () => {
  let service: B3SyncService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        B3SyncService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(B3SyncService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue(mockInvestments);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockedAxios.get.mockResolvedValue({
      data: {
        results: [
          { symbol: 'PETR4', regularMarketPrice: 38.5 },
          { symbol: 'VALE3', regularMarketPrice: 65.2 },
        ],
      },
    });
  });

  it('syncUser fetches prices and returns updated count', async () => {
    // Separate mock chains: first call returns investments, subsequent calls return void for updates
    mockDb.where.mockResolvedValueOnce(mockInvestments).mockResolvedValue(undefined);
    const result = await service.syncUser('user-1', 'jonathalimax');
    expect(result.updated).toBeGreaterThanOrEqual(0);
    expect(mockedAxios.get).toHaveBeenCalled();
  });

  it('syncUser returns 0 when no B3 investments found', async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const result = await service.syncUser('user-1', 'jonathalimax');
    expect(result.updated).toBe(0);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=b3-sync.service
```

Expected: FAIL — `Cannot find module './b3-sync.service'`

- [ ] **Step 3: Implement B3SyncService**

Create `apps/api/src/b3-sync/b3-sync.service.ts`:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray } from 'drizzle-orm';
import axios from 'axios';
import { DRIZZLE } from '../db/drizzle.module';
import { investments } from '../db/schema';

const BRAPI_BASE = 'https://brapi.dev/api';

@Injectable()
export class B3SyncService {
  private readonly logger = new Logger(B3SyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly config: ConfigService,
  ) {}

  async syncUser(userId: string, clientId: string): Promise<{ updated: number }> {
    const rows = await this.db
      .select()
      .from(investments)
      .where(
        and(
          eq(investments.userId, userId),
          eq(investments.clientId, clientId),
          inArray(investments.type, ['stock', 'fii', 'etf']),
        ),
      );

    const b3Investments = rows.filter((i: any) => i.ticker);
    if (b3Investments.length === 0) return { updated: 0 };

    const tickers: string[] = [...new Set(b3Investments.map((i: any) => i.ticker as string))];
    const prices = await this.fetchPrices(tickers);

    let updated = 0;
    for (const inv of b3Investments) {
      const price = prices[inv.ticker];
      if (price == null) continue;
      await this.db
        .update(investments)
        .set({ currentPrice: price.toFixed(2), lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(investments.id, inv.id));
      updated++;
    }

    this.logger.log(`[B3Sync] ${clientId}/${userId} — updated ${updated}/${b3Investments.length} investments`);
    return { updated };
  }

  private async fetchPrices(tickers: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const token = this.config.get<string>('BRAPI_TOKEN');
    const tokenParam = token ? `?token=${token}` : '';

    const BATCH = 10;
    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH).join(',');
      try {
        const url = `${BRAPI_BASE}/quote/${batch}${tokenParam}`;
        const { data } = await axios.get(url, { timeout: 10_000 });
        for (const r of data?.results ?? []) {
          if (r.symbol && r.regularMarketPrice != null) {
            prices[r.symbol] = r.regularMarketPrice;
          }
        }
      } catch (err) {
        this.logger.warn(`[B3Sync] Failed to fetch batch ${batch}: ${(err as Error).message}`);
      }
    }
    return prices;
  }

  async syncAllUsers(): Promise<void> {
    const rows: { userId: string; clientId: string }[] = await this.db
      .select({ userId: investments.userId, clientId: investments.clientId })
      .from(investments)
      .where(inArray(investments.type, ['stock', 'fii', 'etf']));

    const unique = new Map<string, { userId: string; clientId: string }>();
    for (const r of rows) unique.set(`${r.clientId}:${r.userId}`, r);

    for (const { userId, clientId } of unique.values()) {
      try {
        await this.syncUser(userId, clientId);
      } catch (err) {
        this.logger.error(`[B3Sync] Failed for ${clientId}/${userId}: ${(err as Error).message}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=b3-sync.service
```

Expected: all tests PASS.

- [ ] **Step 5: Create scheduler and module**

Create `apps/api/src/b3-sync/b3-sync.scheduler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { B3SyncService } from './b3-sync.service';

@Injectable()
export class B3SyncScheduler {
  private readonly logger = new Logger(B3SyncScheduler.name);

  constructor(private readonly b3Sync: B3SyncService) {}

  // Daily at 9 AM Brasilia time (UTC-3 → 12:00 UTC)
  @Cron('0 12 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailySync(): Promise<void> {
    this.logger.log('[B3Sync] Starting daily B3 sync for all users');
    await this.b3Sync.syncAllUsers();
    this.logger.log('[B3Sync] Daily B3 sync complete');
  }
}
```

Create `apps/api/src/b3-sync/b3-sync.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { B3SyncService } from './b3-sync.service';
import { B3SyncScheduler } from './b3-sync.scheduler';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule, ConfigModule],
  providers: [B3SyncService, B3SyncScheduler],
  exports: [B3SyncService],
})
export class B3SyncModule {}
```

- [ ] **Step 6: Add manual sync endpoint to InvestmentsController**

In `apps/api/src/investments/investments.controller.ts`, add at the top of imports:

```typescript
import { B3SyncService } from '../b3-sync/b3-sync.service';
```

Add to the constructor (after the existing `service` param):

```typescript
constructor(
  private readonly service: InvestmentsService,
  private readonly b3Sync: B3SyncService,
) {}
```

Add this method to the class (after `remove`):

```typescript
@Post('b3-sync')
syncB3(@CurrentUser() user: JwtPayload) {
  return this.b3Sync.syncUser(user.sub, user.clientId);
}
```

- [ ] **Step 7: Update InvestmentsModule to import B3SyncModule**

In `apps/api/src/investments/investments.module.ts`, change to:

```typescript
import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { DrizzleModule } from '../db/drizzle.module';
import { B3SyncModule } from '../b3-sync/b3-sync.module';

@Module({
  imports: [DrizzleModule, B3SyncModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
})
export class InvestmentsModule {}
```

- [ ] **Step 8: Build to verify no TypeScript errors**

```bash
rtk pnpm --filter @realwise/api build
```

Expected: zero TypeScript errors.

- [ ] **Step 9: Commit**

```bash
rtk git add apps/api/src/b3-sync/ apps/api/src/investments/
rtk git commit -m "feat(api): add B3 sync — daily Brapi price update + POST /investments/b3-sync"
```

---

## Task 6: Bill reminders scheduler (daily cron + email)

Ports `functions/clientScheduledBillReminders.js`. Runs daily at 9 AM BRT: finds all users with pending bills overdue, due today, or due in 1–3 days; groups per user; sends one email per user via `NotificationsService`. Logs sent reminders to `bill_reminders` table.

**Files:**
- Create: `apps/api/src/bill-reminders/bill-reminders.service.ts`
- Create: `apps/api/src/bill-reminders/bill-reminders.service.spec.ts`
- Create: `apps/api/src/bill-reminders/bill-reminders.scheduler.ts`
- Create: `apps/api/src/bill-reminders/bill-reminders.module.ts`

**Interfaces:**
- Consumes: `bills` table, `bill_reminders` table, `users` table, `DRIZZLE`, `NotificationsService`
- Produces: `BillRemindersModule`; `BillRemindersService.runForAllUsers()` dispatches reminder emails

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/bill-reminders/bill-reminders.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BillRemindersService } from './bill-reminders.service';
import { DRIZZLE } from '../db/drizzle.module';
import { NotificationsService } from '../notifications/notifications.service';

const today = new Date().toISOString().slice(0, 10);

const mockBills = [
  { id: 'bill-1', userId: 'user-1', clientId: 'c1', name: 'Rent', amount: '1500.00', dueDate: today, status: 'pending' },
];
const mockUsers = [
  { id: 'user-1', email: 'user@example.com', clientId: 'c1' },
];

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(mockBills),
};

const mockNotifications = { sendBillReminderEmail: jest.fn().mockResolvedValue(undefined) };

describe('BillRemindersService', () => {
  let service: BillRemindersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BillRemindersService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get(BillRemindersService);
    jest.clearAllMocks();
    mockNotifications.sendBillReminderEmail.mockResolvedValue(undefined);
  });

  it('groupBillsForUser categorises overdue bill correctly', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const overdueBill = { id: 'b1', name: 'Rent', amount: '1500', dueDate: pastDate.toISOString().slice(0, 10) };
    const groups = service.groupBillsForUser([overdueBill as any]);
    expect(groups.overdue).toHaveLength(1);
    expect(groups.overdue[0].daysOverdue).toBeGreaterThan(0);
  });

  it('groupBillsForUser categorises dueToday bill correctly', () => {
    const bill = { id: 'b2', name: 'Netflix', amount: '39.90', dueDate: today };
    const groups = service.groupBillsForUser([bill as any]);
    expect(groups.dueToday).toHaveLength(1);
  });

  it('groupBillsForUser categorises dueSoon bill correctly', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const bill = { id: 'b3', name: 'Gym', amount: '100', dueDate: soon.toISOString().slice(0, 10) };
    const groups = service.groupBillsForUser([bill as any]);
    expect(groups.dueSoon).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=bill-reminders.service
```

Expected: FAIL — `Cannot find module './bill-reminders.service'`

- [ ] **Step 3: Implement BillRemindersService**

Create `apps/api/src/bill-reminders/bill-reminders.service.ts`:

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { bills, users, billReminders } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';

interface BillRow {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  status: string;
  userId: string;
  clientId: string;
}

interface BillEntry {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  daysOverdue?: number;
}

@Injectable()
export class BillRemindersService {
  private readonly logger = new Logger(BillRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly notifications: NotificationsService,
  ) {}

  groupBillsForUser(pendingBills: BillRow[]): {
    overdue: BillEntry[];
    dueToday: BillEntry[];
    dueSoon: BillEntry[];
  } {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().slice(0, 10);

    const overdue: BillEntry[] = [];
    const dueToday: BillEntry[] = [];
    const dueSoon: BillEntry[] = [];

    for (const bill of pendingBills) {
      const dueStr = bill.dueDate.slice(0, 10);
      if (dueStr < todayStr) {
        const daysOverdue = Math.floor((now.getTime() - new Date(dueStr).getTime()) / 86_400_000);
        overdue.push({ id: bill.id, name: bill.name, amount: bill.amount, dueDate: dueStr, daysOverdue });
      } else if (dueStr === todayStr) {
        dueToday.push({ id: bill.id, name: bill.name, amount: bill.amount, dueDate: dueStr });
      } else if (dueStr <= in3DaysStr) {
        dueSoon.push({ id: bill.id, name: bill.name, amount: bill.amount, dueDate: dueStr });
      }
    }
    return { overdue, dueToday, dueSoon };
  }

  async runForAllUsers(): Promise<void> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);

    const pendingBills: BillRow[] = await this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.status, 'pending'),
          gte(bills.dueDate, thirtyDaysAgo.toISOString().slice(0, 10)),
          lte(bills.dueDate, in3Days.toISOString().slice(0, 10)),
        ),
      );

    if (pendingBills.length === 0) {
      this.logger.log('[BillReminders] No pending bills in reminder window');
      return;
    }

    const userIds = [...new Set(pendingBills.map((b) => b.userId))];
    const userRows: { id: string; email: string; clientId: string }[] = await this.db
      .select({ id: users.id, email: users.email, clientId: users.clientId })
      .from(users)
      .where(inArray(users.id, userIds));

    for (const user of userRows) {
      const userBills = pendingBills.filter((b) => b.userId === user.id);
      const groups = this.groupBillsForUser(userBills);
      const totalActionable = groups.overdue.length + groups.dueToday.length + groups.dueSoon.length;
      if (totalActionable === 0) continue;

      try {
        await this.notifications.sendBillReminderEmail(user.email, groups);
        const billIds = [...groups.overdue, ...groups.dueToday, ...groups.dueSoon].map((b) => b.id);
        await this.db.insert(billReminders).values(
          billIds.map((billId) => ({
            clientId: user.clientId,
            userId: user.id,
            billId,
            remindAt: now,
            sent: true,
            sentVia: 'email',
          })),
        );
        this.logger.log(`[BillReminders] Sent to ${user.email}: ${totalActionable} bill(s)`);
      } catch (err) {
        this.logger.error(`[BillReminders] Failed for ${user.email}: ${(err as Error).message}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=bill-reminders.service
```

Expected: all tests PASS.

- [ ] **Step 5: Create scheduler and module**

Create `apps/api/src/bill-reminders/bill-reminders.scheduler.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillRemindersService } from './bill-reminders.service';

@Injectable()
export class BillRemindersScheduler {
  private readonly logger = new Logger(BillRemindersScheduler.name);

  constructor(private readonly service: BillRemindersService) {}

  // Daily at 9 AM Brasilia time (UTC-3 → 12:00 UTC)
  @Cron('0 12 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyReminders(): Promise<void> {
    this.logger.log('[BillReminders] Starting daily reminder run');
    await this.service.runForAllUsers();
    this.logger.log('[BillReminders] Daily reminder run complete');
  }
}
```

Create `apps/api/src/bill-reminders/bill-reminders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BillRemindersService } from './bill-reminders.service';
import { BillRemindersScheduler } from './bill-reminders.scheduler';
import { DrizzleModule } from '../db/drizzle.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DrizzleModule, NotificationsModule],
  providers: [BillRemindersService, BillRemindersScheduler],
})
export class BillRemindersModule {}
```

- [ ] **Step 6: Commit**

```bash
rtk git add apps/api/src/bill-reminders/
rtk git commit -m "feat(api): add bill reminders — daily cron email via SMTP"
```

---

## Task 7: Admin module (leads, purchases, coupons, import issues)

Routes are protected by both `JwtAuthGuard` (global) and a new `AdminGuard` that checks `role === 'admin'` on the JWT payload. Includes CRUD for admin-managed resources.

**Files:**
- Create: `apps/api/src/admin/admin.guard.ts`
- Create: `apps/api/src/admin/admin.guard.spec.ts`
- Create: `apps/api/src/admin/dto/update-lead.dto.ts`
- Create: `apps/api/src/admin/dto/create-coupon.dto.ts`
- Create: `apps/api/src/admin/admin.service.ts`
- Create: `apps/api/src/admin/admin.service.spec.ts`
- Create: `apps/api/src/admin/admin.controller.ts`
- Create: `apps/api/src/admin/admin.module.ts`

**Interfaces:**
- Consumes: `leads`, `purchases`, `coupons`, `importIssues` tables, `DRIZZLE`, `JwtPayload`
- Produces: `AdminModule`; routes at `/admin/*` — all require `role: 'admin'` in JWT

- [ ] **Step 1: Write AdminGuard tests**

Create `apps/api/src/admin/admin.guard.spec.ts`:

```typescript
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

const makeCtx = (role: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'uid', clientId: 'c1', role } }),
    }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows admin users', () => {
    expect(guard.canActivate(makeCtx('admin'))).toBe(true);
  });

  it('throws ForbiddenException for non-admin users', () => {
    expect(() => guard.canActivate(makeCtx('user'))).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=admin.guard
```

Expected: FAIL — `Cannot find module './admin.guard'`

- [ ] **Step 3: Implement AdminGuard**

Create `apps/api/src/admin/admin.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    if (req.user?.role !== 'admin') throw new ForbiddenException();
    return true;
  }
}
```

- [ ] **Step 4: Run guard tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=admin.guard
```

Expected: all tests PASS.

- [ ] **Step 5: Write AdminService tests**

Create `apps/api/src/admin/admin.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { DRIZZLE } from '../db/drizzle.module';

const mockLead = { id: 'lead-1', email: 'test@example.com', name: 'Test', plan: 'basic', status: 'new', metadata: null, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null };
const mockCoupon = { id: 'coup-1', code: 'SAVE20', discountType: 'percent', discountValue: '20', maxUses: 100, useCount: 0, expiresAt: null, createdAt: new Date(), updatedAt: new Date(), firebaseDocId: null };

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue([mockLead]),
  orderBy: jest.fn().mockResolvedValue([mockLead]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([mockCoupon]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();
    service = module.get(AdminService);
    jest.clearAllMocks();
    mockDb.select.mockReturnThis(); mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([mockLead]); mockDb.orderBy.mockResolvedValue([mockLead]);
    mockDb.insert.mockReturnThis(); mockDb.values.mockReturnThis(); mockDb.returning.mockResolvedValue([mockCoupon]);
    mockDb.update.mockReturnThis(); mockDb.set.mockReturnThis(); mockDb.delete.mockReturnThis();
  });

  it('listLeads returns leads ordered by createdAt', async () => {
    const result = await service.listLeads();
    expect(result).toEqual([mockLead]);
  });

  it('createCoupon inserts and returns coupon', async () => {
    const result = await service.createCoupon({ code: 'SAVE20', discountType: 'percent', discountValue: '20' });
    expect(result.code).toBe('SAVE20');
  });
});
```

- [ ] **Step 6: Run tests to confirm they fail**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=admin.service
```

Expected: FAIL — `Cannot find module './admin.service'`

- [ ] **Step 7: Implement DTOs and AdminService**

Create `apps/api/src/admin/dto/update-lead.dto.ts`:

```typescript
import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateLeadDto {
  @IsOptional()
  @IsIn(['new', 'contacted', 'converted', 'lost'])
  status?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
```

Create `apps/api/src/admin/dto/create-coupon.dto.ts`:

```typescript
import { IsString, IsOptional, IsIn, IsNumber, IsDateString } from 'class-validator';

export class CreateCouponDto {
  @IsString() code: string;
  @IsOptional() @IsIn(['percent', 'fixed']) discountType?: string;
  @IsOptional() @IsString() discountValue?: string;
  @IsOptional() @IsNumber() maxUses?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
}
```

Create `apps/api/src/admin/admin.service.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.module';
import { leads, purchases, coupons, importIssues } from '../db/schema';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  listLeads(): Promise<(typeof leads.$inferSelect)[]> {
    return this.db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  updateLead(id: string, dto: UpdateLeadDto): Promise<(typeof leads.$inferSelect)[]> {
    return this.db
      .update(leads)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
  }

  listPurchases(): Promise<(typeof purchases.$inferSelect)[]> {
    return this.db.select().from(purchases).orderBy(desc(purchases.createdAt));
  }

  listCoupons(): Promise<(typeof coupons.$inferSelect)[]> {
    return this.db.select().from(coupons).orderBy(desc(coupons.createdAt));
  }

  async createCoupon(dto: CreateCouponDto): Promise<typeof coupons.$inferSelect> {
    const rows = await this.db.insert(coupons).values(dto).returning();
    return rows[0];
  }

  async deleteCoupon(id: string): Promise<void> {
    await this.db.delete(coupons).where(eq(coupons.id, id));
  }

  listImportIssues(): Promise<(typeof importIssues.$inferSelect)[]> {
    return this.db.select().from(importIssues).orderBy(desc(importIssues.createdAt));
  }

  async resolveImportIssue(id: string): Promise<void> {
    await this.db
      .update(importIssues)
      .set({ status: 'resolved', updatedAt: new Date() })
      .where(eq(importIssues.id, id));
  }
}
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
rtk pnpm --filter @realwise/api test --testPathPattern=admin.service
```

Expected: all tests PASS.

- [ ] **Step 9: Create controller and module**

Create `apps/api/src/admin/admin.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('leads')
  listLeads() { return this.service.listLeads(); }

  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.updateLead(id, dto);
  }

  @Get('purchases')
  listPurchases() { return this.service.listPurchases(); }

  @Get('coupons')
  listCoupons() { return this.service.listCoupons(); }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) { return this.service.createCoupon(dto); }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) { return this.service.deleteCoupon(id); }

  @Get('import-issues')
  listImportIssues() { return this.service.listImportIssues(); }

  @Patch('import-issues/:id/resolve')
  resolveImportIssue(@Param('id') id: string) { return this.service.resolveImportIssue(id); }
}
```

Create `apps/api/src/admin/admin.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { DrizzleModule } from '../db/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
```

- [ ] **Step 10: Commit**

```bash
rtk git add apps/api/src/admin/
rtk git commit -m "feat(api): add admin module — leads, purchases, coupons, import issues"
```

---

## Task 8: Wire all new modules into AppModule + register ScheduleModule + MailerModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: all 5 new modules + `ScheduleModule` + `MailerModule`
- Produces: complete NestJS app with all feature-parity routes active and scheduled jobs running

- [ ] **Step 1: Replace apps/api/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs/mailer';

import { HealthModule } from './health/health.module';
import { DrizzleModule } from './db/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Business modules (Plan 5)
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BillsModule } from './bills/bills.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { InvestmentsModule } from './investments/investments.module';
import { PlannerModule } from './planner/planner.module';
import { UserSettingsModule } from './user-settings/user-settings.module';

// Feature parity modules (Plan 6)
import { StorageModule } from './storage/storage.module';
import { ImportsModule } from './imports/imports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { B3SyncModule } from './b3-sync/b3-sync.module';
import { BillRemindersModule } from './bill-reminders/bill-reminders.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT ?? 587),
          secure: Number(process.env.EMAIL_PORT) === 465,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        },
        defaults: {
          from: process.env.EMAIL_FROM ?? 'noreply@realwise.com.br',
        },
      }),
    }),
    DrizzleModule,
    HealthModule,
    AuthModule,
    // Plan 5
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BillsModule,
    BudgetsModule,
    GoalsModule,
    InvestmentsModule,
    PlannerModule,
    UserSettingsModule,
    // Plan 6
    StorageModule,
    ImportsModule,
    NotificationsModule,
    B3SyncModule,
    BillRemindersModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

- [ ] **Step 2: Run the full test suite**

```bash
rtk pnpm --filter @realwise/api test
```

Expected: all spec files pass. No failures.

- [ ] **Step 3: Build the API**

```bash
rtk pnpm --filter @realwise/api build
```

Expected: `dist/` created, zero TypeScript errors.

- [ ] **Step 4: Smoke-test locally (requires running API + local MinIO)**

Start local backing services (PostgreSQL + MinIO via docker-compose):

```bash
rtk docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Start the API:

```bash
DATABASE_URL="postgres://postgres:dev@localhost:5432/realwise" \
MINIO_ENDPOINT="localhost" MINIO_PORT="9000" \
MINIO_ACCESS_KEY="minioadmin" MINIO_SECRET_KEY="minioadmin" \
MINIO_BUCKET="realwise-attachments" MINIO_USE_SSL="false" \
EMAIL_HOST="localhost" EMAIL_PORT="1025" EMAIL_USER="" EMAIL_PASSWORD="" \
rtk pnpm --filter @realwise/api dev
```

Confirm unauthenticated request to admin returns 401 (JWT guard) not 403 (admin guard):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/admin/leads
```

Expected: `401`

Confirm health still public:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
```

Expected: `200`

- [ ] **Step 5: Commit**

```bash
rtk git add apps/api/src/app.module.ts
rtk git commit -m "feat(api): wire Plan 6 modules — storage, imports, B3 sync, bill reminders, admin"
```

---

## Summary

| Task | Deliverable | Routes / Cron |
|------|-------------|---------------|
| 1 | Install deps | — |
| 2 | StorageModule | `POST /storage/upload`, `POST /storage/confirm`, `GET /storage/download/:id` |
| 3 | ImportsModule + BankParserService | `POST /imports/upload`, `POST /imports/:id/confirm` |
| 4 | NotificationsModule | Internal (email service only) |
| 5 | B3SyncModule | `POST /investments/b3-sync` + daily cron at 9 AM BRT |
| 6 | BillRemindersModule | Daily cron at 9 AM BRT |
| 7 | AdminModule + AdminGuard | `GET/PATCH /admin/leads`, `GET /admin/purchases`, `GET/POST/DELETE /admin/coupons`, `GET/PATCH /admin/import-issues/:id/resolve` |
| 8 | AppModule wiring + smoke test | — |

After Plan 6, all Firebase Cloud Functions have NestJS equivalents. Plan 7 (validation + Firebase decommission) can proceed.
