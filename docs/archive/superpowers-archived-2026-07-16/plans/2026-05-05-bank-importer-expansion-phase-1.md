# Bank Importer Expansion — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix and add bank statement parsers (Bradesco, Inter, Itaú PDF, Bradesco PDF, MP PDF, OFX), then add a "report failed import" pipeline that sends the user's file to the admin via the shared Firebase project (UI list + email with attachment).

**Architecture:** Pure-function parsers tested with Vitest using anonymized real-file fixtures. Frontend reports failed imports via a new callable Cloud Function on the shared `moneywise-ad9ec` project, which writes to Firestore `importIssues` and Storage `importIssues/{id}/{filename}`. A Firestore-trigger function emails the admin (`jonathalimax@gmail.com`) with the file attached. New admin pages at `/admin/import-issues` (list) and `/admin/import-issues/:id` (detail) show the queue.

**Tech Stack:** React 19 + Vite, Tailwind v4, Vitest (node env), Firebase v9 modular SDK, Cloud Functions Gen 1 (Node 20), Nodemailer (Gmail App Password), `pdfjs-dist` (already lazy-loaded via `pdfLoader.js`).

**Spec:** `docs/superpowers/specs/2026-05-05-bank-importer-expansion-design.md`

---

## File Structure

**New parsers (frontend):**

```
src/services/importers/
  bankParsers/
    inter.js                  ← NEW
    itauPdf.js                ← NEW
    bradescoPdf.js            ← NEW
    ofx.js                    ← NEW
    bradesco.js               ← FIX (broken column names, preamble, footer)
    mercadopagoPdf.js         ← FIX (currently a stub)
  index.js                    ← MODIFY (wire new parsers + .ofx routing)
  __tests__/
    fixtures/                 ← NEW dir (anonymized samples + extracted PDF text)
      inter-conta.csv
      inter-conta.ofx
      bradesco-conta.csv
      bradesco-conta.txt
      itau-extrato.txt
      mercadopago-fatura.txt
    inter.test.js
    itauPdf.test.js
    bradesco.test.js
    bradescoPdf.test.js
    mercadopagoPdf.test.js
    ofx.test.js
```

**Issue reporting (frontend):**

```
src/services/
  importIssueService.js       ← NEW (uploads file via callable function)
src/components/
  ImportIssueReport.jsx       ← NEW (opt-in modal/section)
  ImportModal.jsx             ← MODIFY (show "report" CTA on empty/wrong)
```

**Cloud Functions (shared `moneywise-ad9ec` project, in `/functions`):**

```
functions/
  submitImportIssue.js        ← NEW (callable; writes file to Storage + Firestore doc)
  sendImportIssueEmail.js     ← NEW (Firestore trigger; emails admin with attachment)
  index.js                    ← MODIFY (export the new functions)
```

**Admin UI (extends existing `/admin`):**

```
src/pages/admin/
  AdminApp.jsx                ← MODIFY (add nav link + routes)
  ImportIssues.jsx            ← NEW (list page)
  ImportIssueDetail.jsx       ← NEW (detail page)
```

**Storage rules:** `storage.rules` ← MODIFY (deny client writes to importIssues/)

---

## Task 1: Set up test fixtures from real files

**Files:** `src/services/importers/__tests__/fixtures/` (new dir), 5 fixture files.

The user's real files live at `~/Library/Mobile Documents/com~apple~CloudDocs/Realwise/banks-statement/`. We copy them with PII anonymized (replace personal names with "USUARIO TESTE", account numbers with zeros), keeping all amounts/dates/structure intact.

- [ ] **Step 1: Create fixtures directory**

Run: `mkdir -p src/services/importers/__tests__/fixtures`

- [ ] **Step 2: Copy & anonymize Inter CSV**

Run a `sed` pipeline that replaces names and account numbers, then writes to `src/services/importers/__tests__/fixtures/inter-conta.csv`. Source path: `~/Library/Mobile Documents/com~apple~CloudDocs/Realwise/banks-statement/inter/Extrato-05-02-2026-a-05-05-2026-CSV.csv`. Replacements: `JONATHA PEREIRA LIMA → USUARIO TESTE`, `Jonatha Pereira Lima → Usuario Teste`, `288190408 → 000000000`.

- [ ] **Step 3: Copy & anonymize Inter OFX**

Same approach for `inter/Extrato-05-02-2026-a-05-05-2026-OFX.ofx` → `inter-conta.ofx`.

- [ ] **Step 4: Copy & anonymize Bradesco CSV**

Source: `Bradesco/dd3752fe-784c-43a5-bffd-524fdf1fc8fa.csv` → `bradesco-conta.csv`. Replacements: `116670-0 → 000000-0`, `CARLOS ALBERTO CALZADILLA ROJAS → USUARIO TESTE`.

- [ ] **Step 5: Extract PDF text into fixtures**

Run a one-shot Node script that uses the project's installed `pdfjs-dist` (legacy ESM build) to extract text from:
- `itau/itau_extrato_072025.pdf` → `itau-extrato.txt` with replacements for name, CPF, account.
- `Bradesco/c27f7e68-8076-44b7-b7d2-4d5c2a90fe0e.pdf` → `bradesco-conta.txt` with name + account replacements.

The script imports `./node_modules/pdfjs-dist/legacy/build/pdf.mjs`, calls `getDocument({ data })`, iterates pages, joins items with spaces, applies replacements, writes to disk.

- [ ] **Step 6: Verify fixtures exist**

Run: `ls -la src/services/importers/__tests__/fixtures/`. Expected: 4 files (Inter CSV/OFX, Bradesco CSV, Bradesco TXT, Itaú TXT). MP fixture is created in Task 7.

- [ ] **Step 7: Commit**

Run: `git add src/services/importers/__tests__/fixtures/` then `git commit -m "test: add anonymized real-file fixtures for bank parsers"`.

---

## Task 2: Fix Bradesco CSV parser

**Files:**
- Test: `src/services/importers/__tests__/bradesco.test.js` (NEW)
- Modify: `src/services/importers/bankParsers/bradesco.js`

The current parser checks for headers `credito`/`debito` (no suffix) and reads `row['Credito']` — both fail because real Bradesco CSV uses `Crédito (R$)` and `Débito (R$)`. Also has a 1-line preamble and a footer "Últimos Lancamentos" with a duplicate header row.

- [ ] **Step 1: Write failing test**

Create `src/services/importers/__tests__/bradesco.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import Papa from 'papaparse';
import { parseBradescoStatement, detectBradesco } from '../bankParsers/bradesco';

function loadCsv(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const headerIdx = raw.indexOf('Data;');
  const trimmed = raw.substring(headerIdx);
  const { data } = Papa.parse(trimmed, { header: true, skipEmptyLines: true, delimiter: ';' });
  return data;
}

describe('bradesco CSV parser', () => {
  const data = loadCsv('src/services/importers/__tests__/fixtures/bradesco-conta.csv');

  it('detects Bradesco by real headers including (R$) suffix', () => {
    expect(detectBradesco(Object.keys(data[0]))).toBe(true);
  });

  it('parses credit transactions as income', () => {
    const txs = parseBradescoStatement(data);
    const credit = txs.find(t => t.description.includes('TRANSFERENCIA PIX') && t.amount === 571.27);
    expect(credit).toBeDefined();
    expect(credit.type).toBe('income');
    expect(credit.date).toMatch(/^2026-03-02/);
  });

  it('parses debit transactions as expense', () => {
    const txs = parseBradescoStatement(data);
    const debit = txs.find(t => t.amount === 1711.98);
    expect(debit).toBeDefined();
    expect(debit.type).toBe('expense');
  });

  it('skips footer "Últimos Lancamentos" header row and total row', () => {
    const txs = parseBradescoStatement(data);
    expect(txs.find(t => t.description === 'Histórico')).toBeUndefined();
    expect(txs.find(t => t.description === 'Total')).toBeUndefined();
  });

  it('returns at least 100 transactions from the real fixture', () => {
    const txs = parseBradescoStatement(data);
    expect(txs.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/services/importers/__tests__/bradesco.test.js`. Expected: detection and parse assertions fail.

- [ ] **Step 3: Replace the parser**

Replace `src/services/importers/bankParsers/bradesco.js` entirely with:

```javascript
// Bradesco CSV format (real export):
//   Header: Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)
//   Empty cell is a single space ' ' when credit/debit doesn't apply.
//   Date: DD/MM/YYYY ; Amount: BR (1.234,56)

function parseBrAmount(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  const iso = new Date(dateStr);
  return isNaN(iso.getTime()) ? new Date().toISOString() : iso.toISOString();
}

function pick(row, names) {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return '';
}

const HISTORICO_KEYS = ['Histórico', 'Historico', 'historico', 'histórico', 'HISTORICO'];
const CREDITO_KEYS = ['Crédito (R$)', 'Credito (R$)', 'Crédito', 'Credito', 'CREDITO'];
const DEBITO_KEYS = ['Débito (R$)', 'Debito (R$)', 'Débito', 'Debito', 'DEBITO'];
const DATA_KEYS = ['Data', 'data', 'DATA'];
const DOCTO_KEYS = ['Docto.', 'Docto', 'docto'];

export function parseBradescoStatement(data) {
  const out = [];
  for (const row of data) {
    const rawDate = pick(row, DATA_KEYS);
    const desc = pick(row, HISTORICO_KEYS);

    // Skip duplicate header from "Últimos Lancamentos" section
    if (rawDate === 'Data' || desc === 'Histórico') continue;
    if (!rawDate || !desc) continue;
    if (desc === 'Total') continue;
    if (rawDate.startsWith('Filtro') || rawDate.startsWith('Os dados') || rawDate.startsWith('Últimos')) continue;

    const credito = parseBrAmount(pick(row, CREDITO_KEYS));
    const debito = parseBrAmount(pick(row, DEBITO_KEYS));

    let amount, type;
    if (credito > 0 && debito === 0) { amount = credito; type = 'income'; }
    else if (debito > 0 && credito === 0) { amount = debito; type = 'expense'; }
    else continue;

    out.push({
      date: parseDate(rawDate),
      amount,
      type,
      description: desc,
      originalId: pick(row, DOCTO_KEYS),
    });
  }
  return out;
}

function norm(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function detectBradesco(headers) {
  const set = new Set(headers.map(norm));
  const has = (token) => [...set].some(h => h.includes(token));
  return set.has('data') && has('historico') && (has('credito') || has('debito'));
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/services/importers/__tests__/bradesco.test.js`. Expected: 5 passed.

- [ ] **Step 5: Commit**

Run: `git add src/services/importers/bankParsers/bradesco.js src/services/importers/__tests__/bradesco.test.js` then `git commit -m "fix(importer): repair Bradesco CSV parser for real header format"`.

---

## Task 3: Add Inter CSV parser

**Files:**
- Create: `src/services/importers/bankParsers/inter.js`
- Test: `src/services/importers/__tests__/inter.test.js`

`★ Insight ─────────────────────────────────────`
Inter CSV has a 4-line preamble like Mercado Pago. The existing `parseCSV()` in `index.js` already strips MP's preamble by finding `RELEASE_DATE`. Task 8 extends the same trick to find `Data Lançamento`. Detection runs after the strip, so the parser sees clean headers.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Write failing test**

Create `src/services/importers/__tests__/inter.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import Papa from 'papaparse';
import { parseInterStatement, detectInter } from '../bankParsers/inter';

function loadCsv(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const headerIdx = raw.indexOf('Data Lançamento');
  const { data } = Papa.parse(raw.substring(headerIdx), { header: true, skipEmptyLines: true, delimiter: ';' });
  return data;
}

describe('inter CSV parser', () => {
  const data = loadCsv('src/services/importers/__tests__/fixtures/inter-conta.csv');

  it('detects Inter by 5-column header', () => {
    expect(detectInter(Object.keys(data[0]))).toBe(true);
  });

  it('parses negative values as expenses', () => {
    const txs = parseInterStatement(data);
    const fatura = txs.find(t => t.amount === 374.95);
    expect(fatura.type).toBe('expense');
  });

  it('parses positive values as income', () => {
    const txs = parseInterStatement(data);
    const pix = txs.find(t => t.amount === 373.78);
    expect(pix.type).toBe('income');
  });

  it('combines Histórico + Descrição into description', () => {
    const txs = parseInterStatement(data);
    const fatura = txs.find(t => t.amount === 374.95);
    expect(fatura.description).toMatch(/Pagamento efetuado/);
    expect(fatura.description).toMatch(/Pagamento Fatura/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/services/importers/__tests__/inter.test.js`. Expected: cannot resolve `../bankParsers/inter`.

- [ ] **Step 3: Implement the parser**

Create `src/services/importers/bankParsers/inter.js`:

```javascript
// Inter CSV format (Conta Corrente):
//   Preamble (4 lines): Extrato Conta Corrente / Conta;XXX / Período;... / Saldo;X (then blank)
//   Header: Data Lançamento;Histórico;Descrição;Valor;Saldo
//   Date: DD/MM/YYYY ; Amount: BR with negative sign for expenses

function parseBrAmount(str) {
  if (str == null) return 0;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  return new Date().toISOString();
}

function pick(row, names) {
  for (const n of names) if (row[n] != null && row[n] !== '') return row[n];
  return '';
}

const DATE_KEYS = ['Data Lançamento', 'Data Lancamento', 'data lançamento'];
const HIST_KEYS = ['Histórico', 'Historico'];
const DESC_KEYS = ['Descrição', 'Descricao'];
const VALOR_KEYS = ['Valor', 'valor', 'VALOR'];

export function parseInterStatement(data) {
  const out = [];
  for (const row of data) {
    const rawDate = pick(row, DATE_KEYS);
    if (!rawDate || rawDate === 'Data Lançamento') continue;
    const valor = parseBrAmount(pick(row, VALOR_KEYS));
    if (valor === 0) continue;
    const hist = pick(row, HIST_KEYS);
    const descMore = pick(row, DESC_KEYS);
    const description = [hist, descMore].filter(Boolean).join(' - ').trim();
    if (!description) continue;
    out.push({
      date: parseDate(rawDate),
      amount: Math.abs(valor),
      type: valor < 0 ? 'expense' : 'income',
      description,
      originalId: '',
    });
  }
  return out;
}

function norm(h) {
  return String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function detectInter(headers) {
  const set = new Set(headers.map(norm));
  return set.has('data lancamento') && set.has('historico') && set.has('descricao') && set.has('valor');
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/services/importers/__tests__/inter.test.js`. Expected: 4 passed.

- [ ] **Step 5: Commit**

Run: `git add src/services/importers/bankParsers/inter.js src/services/importers/__tests__/inter.test.js` then `git commit -m "feat(importer): add Banco Inter CSV parser"`.

---

## Task 4: Add OFX parser

**Files:**
- Create: `src/services/importers/bankParsers/ofx.js`
- Test: `src/services/importers/__tests__/ofx.test.js`

`★ Insight ─────────────────────────────────────`
OFX (Open Financial Exchange) is SGML, not XML — tags don't always close. We don't need a real OFX library; a regex over `<STMTTRN>...</STMTTRN>` blocks plus per-tag extraction is enough for read-only import and avoids ~80KB of dependencies.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Write failing test**

Create `src/services/importers/__tests__/ofx.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseOfx } from '../bankParsers/ofx';

describe('ofx parser', () => {
  const raw = fs.readFileSync('src/services/importers/__tests__/fixtures/inter-conta.ofx', 'utf8');

  it('parses transactions from real Inter OFX', () => {
    const txs = parseOfx(raw);
    expect(txs.length).toBeGreaterThan(0);
  });

  it('returns ISO dates from YYYYMMDD format', () => {
    const txs = parseOfx(raw);
    expect(txs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses positive amount + type from sign', () => {
    const txs = parseOfx(raw);
    for (const t of txs) {
      expect(t.amount).toBeGreaterThan(0);
      expect(['income', 'expense']).toContain(t.type);
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/services/importers/__tests__/ofx.test.js`. Expected: cannot resolve `../bankParsers/ofx`.

- [ ] **Step 3: Implement parser**

Create `src/services/importers/bankParsers/ofx.js`:

```javascript
// Generic OFX (SGML) statement parser. Reads <STMTTRN> blocks.
// Tags read: TRNTYPE, DTPOSTED (YYYYMMDD or YYYYMMDDHHMMSS), TRNAMT (signed), MEMO, NAME, FITID.

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'));
  return m ? m[1].trim() : '';
}

function parseOfxDate(s) {
  if (!s) return new Date().toISOString();
  const y = s.substring(0, 4), mo = s.substring(4, 6), d = s.substring(6, 8);
  return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d)).toISOString();
}

export function parseOfx(text) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const amountStr = tag(b, 'TRNAMT');
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const memo = tag(b, 'MEMO') || tag(b, 'NAME') || tag(b, 'TRNTYPE');
    if (!memo) continue;
    out.push({
      date: parseOfxDate(tag(b, 'DTPOSTED')),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      description: memo,
      originalId: tag(b, 'FITID'),
    });
  }
  return out;
}

export function detectOfx(text) {
  return /<OFX>/i.test(text) || /OFXHEADER:/i.test(text);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/services/importers/__tests__/ofx.test.js`. Expected: 3 passed.

- [ ] **Step 5: Commit**

Run: `git add src/services/importers/bankParsers/ofx.js src/services/importers/__tests__/ofx.test.js` then `git commit -m "feat(importer): add generic OFX parser"`.

---

## Task 5: Add Itaú PDF parser

**Files:**
- Create: `src/services/importers/bankParsers/itauPdf.js`
- Test: `src/services/importers/__tests__/itauPdf.test.js`

The fixture `itau-extrato.txt` contains pdfjs-extracted text where every token is space-separated. Pattern is repeated `DD/MM/YYYY description amount`. Filter `SALDO DO DIA` rows.

- [ ] **Step 1: Write failing test**

Create `src/services/importers/__tests__/itauPdf.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseItauPdf } from '../bankParsers/itauPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/itau-extrato.txt', 'utf8');

describe('itau PDF parser', () => {
  it('parses transactions and skips SALDO DO DIA rows', () => {
    const txs = parseItauPdf(text);
    expect(txs.length).toBeGreaterThan(0);
    expect(txs.find(t => t.description === 'SALDO DO DIA')).toBeUndefined();
  });

  it('detects sign: positive value = income, negative = expense', () => {
    const txs = parseItauPdf(text);
    const expense = txs.find(t => t.description.includes('DA NIO FIBRA'));
    expect(expense.type).toBe('expense');
    const income = txs.find(t => t.description.includes('REND PAGO APLIC'));
    expect(income.type).toBe('income');
  });

  it('handles BR amount format with thousands separator', () => {
    const txs = parseItauPdf(text);
    const big = txs.find(t => t.amount === 15000);
    expect(big).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/services/importers/__tests__/itauPdf.test.js`. Expected: module not found.

- [ ] **Step 3: Implement parser**

Create `src/services/importers/bankParsers/itauPdf.js`:

```javascript
// Itaú PF PDF text format (extracted via pdfjs):
//   "data lançamentos valor (R$) saldo (R$)" header
//   Repeated rows: DD/MM/YYYY <description tokens> <amount> [<balance>]
//   "SALDO DO DIA" rows are filler — skip them.

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseDate(dmy) {
  const [d, m, y] = dmy.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
}

const ROW_RE = /(\d{2}\/\d{2}\/\d{4})\s+([^\d-][^]*?)\s+(-?[\d.]+,\d{2})/g;

export function parseItauPdf(text) {
  const flat = text.replace(/\s+/g, ' ');
  const out = [];
  ROW_RE.lastIndex = 0;
  let m;
  while ((m = ROW_RE.exec(flat)) !== null) {
    const [, dmy, descRaw, amountStr] = m;
    const description = descRaw.trim().replace(/\s+/g, ' ');
    if (description === 'SALDO DO DIA' || /^SALDO DO DIA/.test(description)) continue;
    const amount = parseBrAmount(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;
    out.push({
      date: parseDate(dmy),
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      description,
      originalId: '',
    });
  }
  return out;
}

export function detectItauPdf(text) {
  return /extrato conta/i.test(text) && /lançamentos/i.test(text) && /itau|itaú/i.test(text);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/services/importers/__tests__/itauPdf.test.js`. Expected: 3 passed. If a test fails because the regex captured the next date as part of a description, tighten by changing `[^]*?` to a bounded `[^\d]{1,80}?`.

- [ ] **Step 5: Commit**

Run: `git add src/services/importers/bankParsers/itauPdf.js src/services/importers/__tests__/itauPdf.test.js` then `git commit -m "feat(importer): add Itaú PDF statement parser"`.

---

## Task 6: Add Bradesco PDF parser

**Files:**
- Create: `src/services/importers/bankParsers/bradescoPdf.js`
- Test: `src/services/importers/__tests__/bradescoPdf.test.js`

Bradesco PDF format: header `Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)`. Subsequent rows on same date inherit the date. Last two numeric tokens on each row are amount + balance; middle is description+docto. Sign of amount is inferred from balance delta (running balance up = income, down = expense).

- [ ] **Step 1: Write failing test**

Create `src/services/importers/__tests__/bradescoPdf.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseBradescoPdf } from '../bankParsers/bradescoPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/bradesco-conta.txt', 'utf8');

describe('bradesco PDF parser', () => {
  it('parses transactions from real fixture', () => {
    const txs = parseBradescoPdf(text);
    expect(txs.length).toBeGreaterThan(50);
  });

  it('preserves richer descriptions with payee names', () => {
    const txs = parseBradescoPdf(text);
    const pix = txs.find(t => t.description.includes('REM:'));
    expect(pix).toBeDefined();
  });

  it('skips "COD. LANC. 0" rows', () => {
    const txs = parseBradescoPdf(text);
    expect(txs.find(t => t.description === 'COD. LANC. 0')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/services/importers/__tests__/bradescoPdf.test.js`. Expected: module not found.

- [ ] **Step 3: Implement parser**

Create `src/services/importers/bankParsers/bradescoPdf.js`:

```javascript
// Bradesco PF PDF text format (extracted via pdfjs).
// Header includes "Histórico" and amount columns. Each row may or may not start with a date;
// rows without a date inherit the last seen date. Last two numeric tokens are amount + balance.
// Sign is inferred from the balance delta vs. previous balance.

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function parseDate(dmy) {
  const [d, m, y] = dmy.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
}

const AMT_TOKEN = /-?[\d.]+,\d{2}/g;

export function parseBradescoPdf(text) {
  const cleaned = text
    .replace(/Bradesco Celular[^]*?Folha:\s*\d+\/\d+/g, '')
    .replace(/Aviso!.*$/s, '');

  let normalized = cleaned.replace(/\s+/g, ' ');
  normalized = normalized.replace(/(\d{2}\/\d{2}\/\d{4})/g, '\n$1');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  const out = [];
  let prevBalance = null;
  let currentDate = null;

  for (const line of lines) {
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.*)$/);
    let body;
    if (dateMatch) {
      currentDate = dateMatch[1];
      body = dateMatch[2];
    } else {
      body = line;
    }
    if (!currentDate) continue;

    const amounts = body.match(AMT_TOKEN);
    if (!amounts || amounts.length === 0) continue;

    let amountStr, balanceStr;
    if (amounts.length >= 2) {
      [amountStr, balanceStr] = amounts.slice(-2);
    } else {
      amountStr = amounts[0];
      balanceStr = null;
    }

    const tail = amountStr + (balanceStr ? ' ' + balanceStr : '');
    const tailIdx = body.lastIndexOf(tail);
    const descPart = tailIdx > 0 ? body.substring(0, tailIdx).trim() : body;

    if (/^COD\.\s*LANC\./i.test(descPart)) {
      if (balanceStr) prevBalance = parseBrAmount(balanceStr);
      continue;
    }

    const amount = parseBrAmount(amountStr);
    const balance = balanceStr ? parseBrAmount(balanceStr) : null;
    if (!Number.isFinite(amount)) continue;

    let type = 'expense';
    if (balance != null && prevBalance != null) {
      type = balance >= prevBalance ? 'income' : 'expense';
    }
    if (balance != null) prevBalance = balance;

    out.push({
      date: parseDate(currentDate),
      amount: Math.abs(amount),
      type,
      description: descPart.replace(/\s+\d{6,}\s*$/, '').trim(),
      originalId: '',
    });
  }
  return out;
}

export function detectBradescoPdf(text) {
  return /Bradesco/i.test(text) && /Histórico|Historico/i.test(text);
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/services/importers/__tests__/bradescoPdf.test.js`. Expected: 3 passed. If parsing diverges, log a slice of the output and adjust the heuristic.

- [ ] **Step 5: Commit**

Run: `git add src/services/importers/bankParsers/bradescoPdf.js src/services/importers/__tests__/bradescoPdf.test.js` then `git commit -m "feat(importer): add Bradesco PDF statement parser"`.

---

## Task 7: Implement Mercado Pago PDF parser stub

**Files:**
- Modify: `src/services/importers/bankParsers/mercadopagoPdf.js`
- Test: `src/services/importers/__tests__/mercadopagoPdf.test.js`

If a real MP PDF fixture exists in the user's folder, anonymize and copy it. Otherwise, write the synthetic fixture below.

- [ ] **Step 1: Check for real MP PDF, fall back to synthetic fixture**

Run: `find ~/Library/Mobile\ Documents/com~apple~CloudDocs/Realwise -iname "*mercado*pago*" -name "*.pdf"` — if empty, write a synthetic fixture file `src/services/importers/__tests__/fixtures/mercadopago-fatura.txt` with these contents:

```
Fatura Mercado Pago Vence em 15/05/2026
Data Descrição Valor Parcela
03/04/2026 IFOOD 35,00
05/04/2026 UBER TRIP 18,90
10/04/2026 NETFLIX 39,90
12/04/2026 AMAZON BR 199,90 1/3
```

- [ ] **Step 2: Write failing test**

Create `src/services/importers/__tests__/mercadopagoPdf.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { parseMercadoPagoPdf } from '../bankParsers/mercadopagoPdf';

const text = fs.readFileSync('src/services/importers/__tests__/fixtures/mercadopago-fatura.txt', 'utf8');

describe('mercadopago PDF parser', () => {
  it('returns at least one transaction (not the previous stub)', () => {
    const txs = parseMercadoPagoPdf(text);
    expect(txs.length).toBeGreaterThan(0);
  });

  it('marks all transactions as expense (credit card bill)', () => {
    const txs = parseMercadoPagoPdf(text);
    expect(txs.every(t => t.type === 'expense')).toBe(true);
  });

  it('infers year from "Vence em" line if dates lack year', () => {
    const txs = parseMercadoPagoPdf(text);
    expect(txs[0].date).toMatch(/^2026-/);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx vitest run src/services/importers/__tests__/mercadopagoPdf.test.js`. Expected: assertions fail (current stub returns `[]`).

- [ ] **Step 4: Replace the stub**

Replace `src/services/importers/bankParsers/mercadopagoPdf.js` entirely:

```javascript
// Mercado Pago credit card bill (fatura) PDF text parser.
// "Vence em DD/MM/YYYY" → year inference.
// Each row: DD/MM <description tokens> <amount> [<installment x/y>]
// All entries are expenses. "Pagamento da fatura" rows are skipped.

function parseBrAmount(str) {
  if (!str) return NaN;
  const cleaned = String(str).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

const ROW_RE = /(\d{2}\/\d{2}(?:\/\d{4})?)\s+([^\d][^]*?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s+(\d+\/\d+))?/g;

export function parseMercadoPagoPdf(text) {
  const flat = text.replace(/\s+/g, ' ');
  const venceMatch = flat.match(/Vence em \d{2}\/\d{2}\/(\d{4})/);
  const inferredYear = venceMatch ? venceMatch[1] : String(new Date().getFullYear());

  const out = [];
  ROW_RE.lastIndex = 0;
  let m;
  while ((m = ROW_RE.exec(flat)) !== null) {
    const [, rawDate, descRaw, amountStr, installment] = m;
    const description = descRaw.trim().replace(/\s+/g, ' ');
    if (/Pagamento da fatura/i.test(description)) continue;
    if (!description) continue;
    const amount = parseBrAmount(amountStr);
    if (!Number.isFinite(amount) || amount === 0) continue;
    let dmy = rawDate;
    if (!/\d{4}$/.test(dmy)) dmy = `${dmy}/${inferredYear}`;
    const [d, mo, y] = dmy.split('/');
    out.push({
      date: new Date(parseInt(y), parseInt(mo) - 1, parseInt(d)).toISOString(),
      amount: Math.abs(amount),
      type: 'expense',
      description: installment ? `${description} (${installment})` : description,
      originalId: '',
    });
  }
  return out;
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npx vitest run src/services/importers/__tests__/mercadopagoPdf.test.js`. Expected: 3 passed.

- [ ] **Step 6: Commit**

Run: `git add src/services/importers/bankParsers/mercadopagoPdf.js src/services/importers/__tests__/mercadopagoPdf.test.js src/services/importers/__tests__/fixtures/mercadopago-fatura.txt` then `git commit -m "feat(importer): implement Mercado Pago PDF parser (was stub)"`.

---

## Task 8: Wire new parsers into index.js

**Files:** Modify `src/services/importers/index.js`.

- [ ] **Step 1: Add parser imports**

At the top of `src/services/importers/index.js`, add (keep existing imports):

```javascript
import { parseInterStatement, detectInter } from './bankParsers/inter';
import { parseOfx } from './bankParsers/ofx';
import { parseItauPdf, detectItauPdf } from './bankParsers/itauPdf';
import { parseBradescoPdf, detectBradescoPdf } from './bankParsers/bradescoPdf';
```

- [ ] **Step 2: Add `.ofx` extension branch in `parseFile()`**

After the `.pdf` branch and before the "Unsupported file format" throw, add:

```javascript
} else if (fileExtension === 'ofx') {
  const text = await file.text();
  const transactions = parseOfx(text);
  return await categorizeParsedTransactions(transactions, userId, options);
}
```

- [ ] **Step 3: Update PDF branch to dispatch by content**

Replace the existing PDF block with:

```javascript
} else if (fileExtension === 'pdf') {
  const { text, requiresPassword } = await extractPdfText(file, options.pdfPassword);
  if (requiresPassword) {
    const err = new Error('PDF_PASSWORD_REQUIRED');
    err.code = 'PDF_PASSWORD_REQUIRED';
    throw err;
  }
  let transactions;
  if (bankType === 'itauPdf' || (bankType === 'auto' && detectItauPdf(text))) {
    transactions = parseItauPdf(text);
  } else if (bankType === 'bradescoPdf' || (bankType === 'auto' && detectBradescoPdf(text))) {
    transactions = parseBradescoPdf(text);
  } else {
    transactions = parseMercadoPagoPdf(text);
  }
  return await categorizeParsedTransactions(transactions, userId, options);
}
```

- [ ] **Step 4: Add Inter to auto-detect chain**

Inside the `if (bankType === 'auto')` block, replace the chain with:

```javascript
if (detectNubank(headers)) {
  transactions = parseNubankStatement(data);
} else if (detectInter(headers)) {
  transactions = parseInterStatement(data);
} else if (detectItau(headers)) {
  transactions = parseItauStatement(data);
} else if (detectBradesco(headers)) {
  transactions = parseBradescoStatement(data);
} else if (detectMercadopago(headers)) {
  transactions = parseMercadopagoStatement(data);
} else {
  transactions = parseGenericStatement(data);
}
```

- [ ] **Step 5: Add Inter to manual `bankType` switch**

Add to the switch:

```javascript
case 'inter':
  transactions = parseInterStatement(data);
  break;
```

- [ ] **Step 6: Update `parseCSV()` to strip Inter and Bradesco preambles**

Find the `mpHeaderIndex` block in `parseCSV()` and add:

```javascript
const interHeaderIndex = content.indexOf('Data Lançamento');
if (interHeaderIndex > 0) content = content.substring(interHeaderIndex);

const bradescoHeaderIndex = content.indexOf('Data;Histórico');
if (bradescoHeaderIndex > 0) content = content.substring(bradescoHeaderIndex);
```

- [ ] **Step 7: Update `BANK_OPTIONS`**

Replace the `BANK_OPTIONS` export with:

```javascript
export const BANK_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'nubank', label: 'Nubank' },
  { value: 'inter', label: 'Banco Inter' },
  { value: 'itau', label: 'Itaú (CSV)' },
  { value: 'itauPdf', label: 'Itaú (PDF)' },
  { value: 'bradesco', label: 'Bradesco (CSV)' },
  { value: 'bradescoPdf', label: 'Bradesco (PDF)' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'ofx', label: 'OFX (qualquer banco)' },
  { value: 'generic', label: 'Outro / Genérico' }
];
```

- [ ] **Step 8: Run all importer tests**

Run: `npx vitest run src/services/importers/`. Expected: all parser + existing tests pass.

- [ ] **Step 9: Commit**

Run: `git add src/services/importers/index.js` then `git commit -m "feat(importer): wire Inter, Itaú PDF, Bradesco PDF, OFX parsers into router"`.

---

## Task 9: Cloud Function — submitImportIssue

**Files:**
- Create: `functions/submitImportIssue.js`
- Modify: `functions/index.js`

`★ Insight ─────────────────────────────────────`
This function lives on the **shared** `moneywise-ad9ec` Firebase project, not per-client. The frontend gets a `Functions` instance pointed at the shared project (the same way `AdminApp.jsx` initializes `adminFunctions`). The file is base64-encoded over the wire (≤2MB), then decoded and written to Storage with admin SDK.
`─────────────────────────────────────────────────`

- [ ] **Step 1: Create the function**

Create `functions/submitImportIssue.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const storage = admin.storage();

const MAX_BYTES = 2 * 1024 * 1024;
const DAILY_RATE_LIMIT = 5;

exports.submitImportIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }
  const userEmail = context.auth.token.email || 'unknown';
  const userId = context.auth.uid;

  const {
    fileName, fileMime, fileBase64,
    bankType, parserUsed, detectedHeaders,
    errorMessage, userNote, userName, clientId
  } = data || {};

  if (!fileName || !fileBase64 || !bankType || !clientId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  const buf = Buffer.from(fileBase64, 'base64');
  if (buf.length > MAX_BYTES) {
    throw new functions.https.HttpsError('invalid-argument', 'File too large (max 2MB)');
  }

  const today = new Date().toISOString().split('T')[0];
  const rlRef = db.collection('importIssueRateLimits').doc(`${userId}_${today}`);
  const rlSnap = await rlRef.get();
  const used = rlSnap.exists ? (rlSnap.data().count || 0) : 0;
  if (used >= DAILY_RATE_LIMIT) {
    throw new functions.https.HttpsError('resource-exhausted', 'Daily report limit reached');
  }

  const issueRef = db.collection('importIssues').doc();
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const storagePath = `importIssues/${issueRef.id}/${safeName}`;

  await storage.bucket().file(storagePath).save(buf, {
    contentType: fileMime || 'application/octet-stream',
    resumable: false,
  });

  await issueRef.set({
    ts: admin.firestore.FieldValue.serverTimestamp(),
    clientId,
    userEmail,
    userName: userName || '',
    bankType,
    parserUsed: parserUsed || 'unknown',
    detectedHeaders: Array.isArray(detectedHeaders) ? detectedHeaders.slice(0, 50) : [],
    fileName: safeName,
    fileMime: fileMime || 'application/octet-stream',
    fileSizeBytes: buf.length,
    storagePath,
    errorMessage: errorMessage || null,
    userNote: userNote || null,
    status: 'open',
    internalNotes: [],
  });

  await rlRef.set({ count: used + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  return { ok: true, issueId: issueRef.id };
});
```

- [ ] **Step 2: Export from functions/index.js**

Append to `functions/index.js`:

```javascript
exports.submitImportIssue = require('./submitImportIssue').submitImportIssue;
```

- [ ] **Step 3: Verify syntax**

Run: `node --check functions/submitImportIssue.js`. Expected: no output (success).

- [ ] **Step 4: Commit**

Run: `git add functions/submitImportIssue.js functions/index.js` then `git commit -m "feat(functions): add submitImportIssue callable for failed-import reports"`.

---

## Task 10: Cloud Function — sendImportIssueEmail

**Files:**
- Create: `functions/sendImportIssueEmail.js`
- Modify: `functions/index.js`

- [ ] **Step 1: Create the function**

Create `functions/sendImportIssueEmail.js`:

```javascript
const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const emailUserSecret = defineSecret('EMAIL_USER');
const emailPasswordSecret = defineSecret('EMAIL_PASSWORD');

const ADMIN_EMAIL = 'jonathalimax@gmail.com';
const APP_BASE_URL = 'https://app.realwise.com.br';

exports.sendImportIssueEmail = functions
  .runWith({ secrets: [emailUserSecret, emailPasswordSecret], memory: '512MB' })
  .firestore.document('importIssues/{issueId}')
  .onCreate(async (snap, context) => {
    const issue = snap.data();
    const issueId = context.params.issueId;

    const fileBuf = (await admin.storage().bucket().file(issue.storagePath).download())[0];

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUserSecret.value(), pass: emailPasswordSecret.value() },
    });

    const lines = [
      `Cliente: ${issue.clientId}`,
      `Usuário: ${issue.userName || '(sem nome)'} <${issue.userEmail}>`,
      `Banco escolhido: ${issue.bankType}`,
      `Parser usado: ${issue.parserUsed}`,
      `Headers detectados: ${(issue.detectedHeaders || []).join(' | ') || '(nenhum)'}`,
      `Erro: ${issue.errorMessage || '(nenhum)'}`,
      ``,
      `Nota do usuário:`,
      issue.userNote || '(sem nota)',
      ``,
      `Abrir no admin: ${APP_BASE_URL}/admin/import-issues/${issueId}`,
    ];

    await transporter.sendMail({
      from: emailUserSecret.value(),
      to: ADMIN_EMAIL,
      subject: `[Realwise] Import failed — ${issue.bankType} — ${issue.clientId}`,
      text: lines.join('\n'),
      attachments: [{ filename: issue.fileName, content: fileBuf, contentType: issue.fileMime }],
    });
  });
```

- [ ] **Step 2: Export from functions/index.js**

Append:

```javascript
exports.sendImportIssueEmail = require('./sendImportIssueEmail').sendImportIssueEmail;
```

- [ ] **Step 3: Verify syntax**

Run: `node --check functions/sendImportIssueEmail.js`. Expected: no output.

- [ ] **Step 4: Commit**

Run: `git add functions/sendImportIssueEmail.js functions/index.js` then `git commit -m "feat(functions): email admin with attachment when importIssue is created"`.

---

## Task 11: Storage rules for importIssues

**Files:** Modify `storage.rules` (or create if absent).

- [ ] **Step 1: Inspect current rules**

Run: `cat storage.rules` (if it errors, the file does not exist).

- [ ] **Step 2: Add deny-all for `importIssues/`**

If `storage.rules` exists, add inside `service firebase.storage { match /b/{bucket}/o { ... } }`:

```
match /importIssues/{allPaths=**} {
  allow read: if false;
  allow write: if false;
}
```

If it does not exist, create `storage.rules` with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /importIssues/{allPaths=**} {
      allow read: if false;
      allow write: if false;
    }
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

(Writes happen via the Cloud Function which uses admin SDK and bypasses rules. Reads happen via signed URLs.)

- [ ] **Step 3: Commit**

Run: `git add storage.rules` then `git commit -m "chore(storage): deny client access to importIssues path"`.

---

## Task 12: Frontend — importIssueService

**Files:** Create `src/services/importIssueService.js`.

- [ ] **Step 1: Implement the service**

Create `src/services/importIssueService.js`:

```javascript
// Sends a failed import to the SHARED Firebase project for admin review.
// Initializes a separate Firebase app named "shared" pointing at app.json (same config the admin uses).

import { initializeApp, getApps } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInAnonymously } from 'firebase/auth';

let sharedApp = null;
async function getSharedApp() {
  if (sharedApp) return sharedApp;
  const res = await fetch('/clients/app.json');
  const config = await res.json();
  sharedApp = getApps().find(a => a.name === 'shared') ?? initializeApp(config.firebase, 'shared');
  const auth = getAuth(sharedApp);
  if (!auth.currentUser) await signInAnonymously(auth);
  return sharedApp;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function submitImportIssue({
  file, bankType, parserUsed, detectedHeaders,
  errorMessage, userNote, userName, userEmail, clientId,
}) {
  if (!file) throw new Error('Missing file');
  if (file.size > 2 * 1024 * 1024) throw new Error('Arquivo maior que 2MB');

  const fileBase64 = await fileToBase64(file);
  const app = await getSharedApp();
  const fns = getFunctions(app);
  const call = httpsCallable(fns, 'submitImportIssue');
  const res = await call({
    fileName: file.name,
    fileMime: file.type || 'application/octet-stream',
    fileBase64,
    bankType, parserUsed, detectedHeaders,
    errorMessage, userNote, userName, userEmail, clientId,
  });
  return res.data;
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check src/services/importIssueService.js` (this will error on `import`; instead use `node -e "import('./src/services/importIssueService.js').then(m => console.log(Object.keys(m)))"` from project root). Expected: prints `[ 'submitImportIssue' ]`.

- [ ] **Step 3: Commit**

Run: `git add src/services/importIssueService.js` then `git commit -m "feat(import): add importIssueService to send failed imports to shared backend"`.

---

## Task 13: Frontend — ImportIssueReport component

**Files:** Create `src/components/ImportIssueReport.jsx`.

- [ ] **Step 1: Implement the component**

Create `src/components/ImportIssueReport.jsx`:

```jsx
import { useState } from 'react';
import { submitImportIssue } from '../services/importIssueService';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { useAccess } from '../contexts/AccessContext';

export default function ImportIssueReport({ file, bankType, parserUsed, detectedHeaders, errorMessage, onDone }) {
  const { clientId } = useClientConfig();
  const { user } = useAccess();
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true); setError('');
    try {
      await submitImportIssue({
        file, bankType, parserUsed, detectedHeaders,
        errorMessage, userNote: note,
        userName: user?.displayName || '',
        userEmail: user?.email || '',
        clientId,
      });
      onDone?.({ ok: true });
    } catch (e) {
      setError(e?.message || 'Falha ao enviar');
      onDone?.({ ok: false, error: e });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
      <h3 className="font-semibold mb-2">Não conseguimos ler esse arquivo</h3>
      <p className="text-gray-700 dark:text-gray-300 mb-3">
        Quer enviar pra gente dar uma olhada? Vamos receber:
      </p>
      <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-5 mb-3">
        <li>O arquivo <code>{file?.name}</code> ({Math.round((file?.size || 0)/1024)} KB)</li>
        <li>Seu nome, email e o banco escolhido</li>
        <li>A nota opcional abaixo</li>
      </ul>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Opcional: nos diga qual banco é, ou o que parece errado"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm mb-2"
        rows={3}
      />
      <label className="flex items-center gap-2 mb-3 text-xs">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        Estou de acordo em enviar esse arquivo para o time da Realwise
      </label>
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={!consent || busy}
          onClick={send}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
        >
          {busy ? 'Enviando...' : 'Enviar relatório'}
        </button>
        <button
          onClick={() => onDone?.({ ok: false, dismissed: true })}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

Run: `git add src/components/ImportIssueReport.jsx` then `git commit -m "feat(ui): add ImportIssueReport opt-in component for failed imports"`.

---

## Task 14: Wire ImportIssueReport into ImportModal

**Files:** Modify `src/components/ImportModal.jsx`.

- [ ] **Step 1: Inspect current ImportModal**

Run: `grep -n "parsedTransactions\|setError\|throw" src/components/ImportModal.jsx | head -20` to locate the parse-result handling.

- [ ] **Step 2: Add the import**

Near the other component imports, add: `import ImportIssueReport from './ImportIssueReport';`

- [ ] **Step 3: Add state**

Near other `useState` calls, add:

```jsx
const [showReport, setShowReport] = useState(false);
const [reportThanks, setReportThanks] = useState(false);
const [lastDetectedHeaders, setLastDetectedHeaders] = useState([]);
const [parseError, setParseError] = useState(null);
```

- [ ] **Step 4: Trigger the report banner on empty/error**

Where the parse step completes, after `parseFile()` returns (or throws), add:

```jsx
if (!parsed || parsed.length === 0) {
  setShowReport(true);
}
```

In the catch block of the parse, also call `setParseError(err); setShowReport(true);`.

- [ ] **Step 5: Render the report banner**

Inside the modal body, before the transactions table, add:

```jsx
{showReport && !reportThanks && (
  <ImportIssueReport
    file={selectedFile}
    bankType={bankType}
    parserUsed={bankType}
    detectedHeaders={lastDetectedHeaders}
    errorMessage={parseError?.message}
    onDone={(res) => {
      if (res?.ok) setReportThanks(true);
      else if (res?.dismissed) setShowReport(false);
    }}
  />
)}
{reportThanks && (
  <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
    Obrigado! Recebemos seu arquivo, vamos olhar com carinho.
  </div>
)}
```

- [ ] **Step 6: Smoke test in dev**

Run: `npm run dev`. Open `http://jonathalimax.localhost:5173/dashboard`, open the Import modal, drop a malformed CSV, verify the banner appears.

- [ ] **Step 7: Commit**

Run: `git add src/components/ImportModal.jsx` then `git commit -m "feat(ui): show report-failed-import CTA when parsing returns nothing"`.

---

## Task 15: Admin UI — ImportIssues list page

**Files:**
- Create: `src/pages/admin/ImportIssues.jsx`
- Modify: `src/pages/admin/AdminApp.jsx`

- [ ] **Step 1: Implement list page**

Create `src/pages/admin/ImportIssues.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';

export default function ImportIssues({ db }) {
  const [issues, setIssues] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'importIssues'), orderBy('ts', 'desc'), limit(200)),
      snap => setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [db]);

  const filtered = issues.filter(i => statusFilter === 'all' || i.status === statusFilter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-white">Import issues</h1>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg"
        >
          <option value="all">Todos</option>
          <option value="open">Abertos</option>
          <option value="resolved">Resolvidos</option>
          <option value="duplicate">Duplicados</option>
        </select>
      </div>
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-gray-900 text-xs uppercase text-gray-400">
            <tr>
              <th className="text-left px-3 py-2">Quando</th>
              <th className="text-left px-3 py-2">Cliente</th>
              <th className="text-left px-3 py-2">Usuário</th>
              <th className="text-left px-3 py-2">Banco</th>
              <th className="text-left px-3 py-2">Parser</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className="border-t border-gray-800 hover:bg-gray-900/50">
                <td className="px-3 py-2">{i.ts?.toDate?.().toLocaleString('pt-BR') || '—'}</td>
                <td className="px-3 py-2">{i.clientId}</td>
                <td className="px-3 py-2">
                  <Link to={`/admin/import-issues/${i.id}`} className="text-emerald-400 hover:underline">
                    {i.userEmail}
                  </Link>
                </td>
                <td className="px-3 py-2">{i.bankType}</td>
                <td className="px-3 py-2">{i.parserUsed}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    i.status === 'open' ? 'bg-amber-900 text-amber-300' :
                    i.status === 'resolved' ? 'bg-emerald-900 text-emerald-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>{i.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add lazy import + nav + routes in AdminApp.jsx**

In `src/pages/admin/AdminApp.jsx`:

(a) Add to lazy imports near the top:

```jsx
const ImportIssues = lazy(() => import('./ImportIssues'));
const ImportIssueDetail = lazy(() => import('./ImportIssueDetail'));
```

(b) Add a NavLink inside the existing nav block:

```jsx
<NavLink to="/admin/import-issues" className={navLinkClass}>Import issues</NavLink>
```

(c) Add routes inside the `<Routes>` block:

```jsx
<Route path="import-issues" element={<ImportIssues db={adminDb} />} />
<Route path="import-issues/:id" element={<ImportIssueDetail db={adminDb} />} />
```

- [ ] **Step 3: Commit**

Run: `git add src/pages/admin/ImportIssues.jsx src/pages/admin/AdminApp.jsx` then `git commit -m "feat(admin): add ImportIssues list page with status filter"`.

---

## Task 16: Admin UI — ImportIssueDetail page

**Files:** Create `src/pages/admin/ImportIssueDetail.jsx`.

- [ ] **Step 1: Implement detail page**

Create `src/pages/admin/ImportIssueDetail.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';

export default function ImportIssueDetail({ db }) {
  const { id } = useParams();
  const [issue, setIssue] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'importIssues', id), snap => {
      setIssue({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [db, id]);

  useEffect(() => {
    if (!issue?.storagePath) return;
    const storage = getStorage(db.app);
    getDownloadURL(storageRef(storage, issue.storagePath))
      .then(setDownloadUrl)
      .catch(e => console.error('download url failed', e));
  }, [issue?.storagePath, db.app]);

  async function setStatus(status) {
    setBusy(true);
    await updateDoc(doc(db, 'importIssues', id), {
      status,
      resolvedAt: status === 'resolved' ? serverTimestamp() : null,
    });
    setBusy(false);
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    await updateDoc(doc(db, 'importIssues', id), {
      internalNotes: arrayUnion({ ts: new Date().toISOString(), text: note.trim() }),
    });
    setNote('');
    setBusy(false);
  }

  if (!issue) return <div className="p-6 text-gray-400">Carregando...</div>;

  return (
    <div className="p-6 max-w-3xl text-gray-200">
      <Link to="/admin/import-issues" className="text-emerald-400 text-sm">← Voltar</Link>
      <h1 className="text-xl font-semibold mt-2 mb-4">Issue {id}</h1>

      <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm mb-6">
        <dt className="text-gray-400">Quando</dt><dd>{issue.ts?.toDate?.().toLocaleString('pt-BR')}</dd>
        <dt className="text-gray-400">Cliente</dt><dd>{issue.clientId}</dd>
        <dt className="text-gray-400">Usuário</dt><dd>{issue.userName} &lt;{issue.userEmail}&gt;</dd>
        <dt className="text-gray-400">Banco</dt><dd>{issue.bankType}</dd>
        <dt className="text-gray-400">Parser usado</dt><dd>{issue.parserUsed}</dd>
        <dt className="text-gray-400">Headers</dt><dd className="font-mono text-xs">{(issue.detectedHeaders || []).join(' | ')}</dd>
        <dt className="text-gray-400">Erro</dt><dd>{issue.errorMessage || '—'}</dd>
        <dt className="text-gray-400">Nota do usuário</dt><dd>{issue.userNote || '—'}</dd>
        <dt className="text-gray-400">Status</dt><dd>{issue.status}</dd>
      </dl>

      <div className="mb-6">
        {downloadUrl ? (
          <a href={downloadUrl} target="_blank" rel="noreferrer"
             className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm">
            Baixar arquivo ({issue.fileName})
          </a>
        ) : <p className="text-xs text-gray-500">Gerando link de download...</p>}
      </div>

      <div className="flex gap-2 mb-6">
        <button disabled={busy || issue.status === 'resolved'} onClick={() => setStatus('resolved')}
                className="bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm">
          Marcar como resolvido
        </button>
        <button disabled={busy} onClick={() => setStatus('duplicate')}
                className="bg-gray-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm">
          Marcar como duplicado
        </button>
        <button disabled={busy} onClick={() => setStatus('open')}
                className="bg-gray-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm">
          Reabrir
        </button>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Notas internas</h3>
        <ul className="text-sm space-y-1 mb-2">
          {(issue.internalNotes || []).map((n, i) => (
            <li key={i}><span className="text-gray-500 text-xs">{n.ts}</span> — {n.text}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={note} onChange={e => setNote(e.target.value)}
                 className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm" />
          <button disabled={busy || !note.trim()} onClick={addNote}
                  className="bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm">
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

Run: `git add src/pages/admin/ImportIssueDetail.jsx` then `git commit -m "feat(admin): add ImportIssueDetail with download, status, notes"`.

---

## Task 17: Deploy & smoke test

- [ ] **Step 1: Run all tests**

Run: `npm test`. Expected: every importer test passes.

- [ ] **Step 2: Lint**

Run: `npm run lint`. Expected: no new errors.

- [ ] **Step 3: Deploy Cloud Functions to shared project**

Run: `firebase use moneywise-ad9ec` then `firebase deploy --only functions:submitImportIssue,functions:sendImportIssueEmail`.

- [ ] **Step 4: Deploy Storage rules**

Run: `firebase deploy --only storage`.

- [ ] **Step 5: Build and deploy hosting**

Run: `npm run build` then `firebase deploy --only hosting`.

- [ ] **Step 6: End-to-end smoke test**

In a real client (e.g. `https://jonathalimax.realwise.com.br`):
1. Open Import modal → drop a deliberately broken CSV → verify the report banner shows.
2. Check the consent box, click Send → verify toast, no console errors.
3. Open `https://app.realwise.com.br/admin/import-issues` → verify the new issue appears.
4. Click into the detail → verify the file downloads.
5. Check `jonathalimax@gmail.com` for the email with attachment.
6. Mark as resolved → verify status updates live.

- [ ] **Step 7: Tag the release**

Run: `git tag importer-phase-1` then `git push --tags`.

---

## Self-Review Notes

- **Spec coverage:** Every parser in the spec → Tasks 2-7. Routing → Task 8. Frontend service + UI → Tasks 12-14. Cloud Functions → Tasks 9-10. Storage rules → Task 11. Admin UI → Tasks 15-16. Deploy → Task 17. ✅
- **Decisions baked in:** Admin email `jonathalimax@gmail.com` (Task 10), allow duplicate submissions (no dedupe in Task 9), toast-only feedback (Task 14), keep files forever (no Storage TTL in Task 11). ✅
- **Out-of-scope** (deferred to Phase 2 spec): per-user custom formats, AI auto-mapping, anonymization, global registry, format-break detection. ✅
