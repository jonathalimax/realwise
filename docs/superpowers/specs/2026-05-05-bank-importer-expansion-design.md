# Bank Statement Importer Expansion

**Date:** 2026-05-05
**Status:** Draft

## Goal

Make Realwise's bank statement import reliable across the long tail of Brazilian banks by:

1. **Fixing and adding parsers** for confirmed-format banks (Bradesco, Inter, Itaú PDF, Mercado Pago PDF, OFX).
2. **Capturing failed imports as actionable bug reports** — when a user's import doesn't work, ask them if they want to notify the team, then forward the file + error to the admin (UI list + email with attachment).
3. **Deferring AI-assisted format learning and a shared format registry to Phase 2.** This keeps the first ship lean and proves the pipeline before adding intelligence.

## Non-Goals (this spec)

- Re-implementing existing working parsers (Nubank, Mercado Pago CSV).
- AI column auto-mapping (deferred to Phase 2).
- Per-user custom format storage (deferred to Phase 2).
- Cross-client global format registry (deferred to Phase 2).
- Anonymization pipelines (deferred — for now, the user explicitly consents to send their file).

---

## Context — What's Confirmed From Real Files

| Bank | Format | Real-file confirmed | Existing parser status |
|---|---|---|---|
| Nubank conta + cartão | CSV | ✅ (prior) | ✅ Working |
| Mercado Pago | CSV | ✅ (prior) | ✅ Working |
| Mercado Pago | PDF | — | ❌ Stub returns `[]` |
| Bradesco | CSV | ✅ This spec | ❌ **Broken** — column names don't match |
| Bradesco | PDF | ✅ This spec | ❌ Missing |
| Inter | CSV | ✅ This spec | ❌ Missing |
| Inter | OFX | ✅ This spec | ❌ Missing |
| Itaú | PDF | ✅ This spec | ❌ Missing (only PJ-CSV parser exists) |
| Caixa, Banco do Brasil, Santander, C6, others | — | ❌ no files | Generic fallback only |

**Confirmed Bradesco bug:** real headers are `Crédito (R$)` / `Débito (R$)` with the `(R$)` suffix. Existing `bradesco.js` `detectBradesco()` checks for `credito`/`debito` (without suffix) and `parseBradescoStatement()` reads `row['Credito']` — both fail silently. The Bradesco CSV also has a one-line preamble (`Extrato de: Ag: …`) and a footer section (`Últimos Lancamentos`) with a duplicate header row that must be handled.

**Confirmed Inter CSV format** (from real export):
```
 Extrato Conta Corrente
Conta ;288190408
Período ;05/02/2026 a 05/05/2026
Saldo ;3,19
                                                    ← blank line
Data Lançamento;Histórico;Descrição;Valor;Saldo
04/05/2026;Pagamento efetuado;Pagamento Fatura - …;-374,95;3,19
```

**Confirmed Itaú PDF format** (from real export):
```
data   lançamentos   valor (R$)   saldo (R$)
02/12/2025   PIX TRANSF JONATHA02/12   15.000,00
02/12/2025   PIX TRANSF HERALDO02/12   -15.000,00
02/12/2025   SALDO DO DIA   2,60
```

---

## Architecture — Phase 1 (this spec)

### Parser resolution

```
File uploaded
   │
   ▼
parseFile() tries built-in parsers (auto-detect by extension + headers):
   nubank → bradesco (fixed) → inter → mercadopago → itau (PJ CSV)
   → ofx (by .ofx extension)
   → PDF parsers: itauPdf, bradescoPdf, mercadopagoPdf
   │
   ▼
   match? ───── yes ──→ categorize → confirmation modal → save
   │
   no
   │
   ▼
Generic fallback parser
   │
   ▼
   transactions.length > 0? ── yes ──→ proceed (existing behavior)
   │
   no (or user notices wrong data on confirmation modal)
   │
   ▼
"Import didn't work" CTA shown
   │
   ▼
User clicks "Notify the team to fix this"
   │
   ▼
File uploaded to Firebase Storage on the SHARED project
+ entry created in `importIssues` collection
+ Cloud Function emails the admin with the file attached
   │
   ▼
Admin reviews, fixes parser in code, deploys
```

### Multi-tenant boundary

The shared **`moneywise-ad9ec`** Firebase project hosts admin, leads, purchases, onboarding, and now `importIssues`. Failed-import reports leave the per-client project and land on the shared project so you can see them in one place regardless of which client they came from.

```
Client A Firebase ────┐
Client B Firebase ────┼──→ submitImportIssue() Cloud Function
Client C Firebase ────┘            │
                                   ▼
                        SHARED FIREBASE (moneywise-ad9ec)
                        ┌─────────────────────────────────┐
                        │ importIssues/{id}               │
                        │ Storage: importIssues/{id}/file │
                        └─────────────────────────────────┘
                                   │
                                   ├──→ Email to admin (Gmail/Nodemailer, with attachment)
                                   │
                                   └──→ /admin/import-issues page
```

---

## Components — Phase 1

### 1. Parsers (frontend)

| File | Status | Purpose |
|---|---|---|
| `src/services/importers/bankParsers/inter.js` | **new** | Strip 4-line preamble, parse 5-column CSV (`Data Lançamento;Histórico;Descrição;Valor;Saldo`) |
| `src/services/importers/bankParsers/itauPdf.js` | **new** | Parse Itaú PF PDF text stream; filter "SALDO DO DIA"; sign convention from value |
| `src/services/importers/bankParsers/bradesco.js` | **fix** | Real column names (`Crédito (R$)`, `Débito (R$)`), preamble row, footer section |
| `src/services/importers/bankParsers/bradescoPdf.js` | **new** | Parse Bradesco PDF (richer descriptions than CSV) |
| `src/services/importers/bankParsers/mercadopagoPdf.js` | **fix** | Implement the stub per existing 2026-04-24 spec |
| `src/services/importers/bankParsers/ofx.js` | **new** | Generic OFX parser (regex-based tag extraction); covers any bank that exports OFX |

Routing in `src/services/importers/index.js`:
- Add `.ofx` extension branch.
- Auto-detect order updated: nubank → bradesco (fixed) → inter → mercadopago → itau-CSV → generic.
- `BANK_OPTIONS` extended with `inter`, `itauPdf`, `bradescoPdf`, `ofx`.

### 2. Failed-import reporting (frontend)

- `src/services/importIssueService.js` — uploads the original file to shared Firebase Storage and creates an `importIssues` doc via callable Cloud Function. The user's name + email + selected bank type + parser used + detected headers + (optional) user note are included.
- `src/components/ImportIssueReport.jsx` — modal/section attached to the `ImportModal`. Triggered when:
  - The generic fallback returns 0 transactions, OR
  - The user clicks "This import didn't work" on the confirmation modal.
  - User sees a clear "**We'll receive your file and the error so we can fix this**" disclosure with a small consent checkbox + optional note field, then clicks **Send report**.
- The button is purposely opt-in. Nothing leaves the client without an explicit click.

### 3. Cloud Functions (in `/functions`, run on shared project)

- `submitImportIssue` (callable) — accepts:
  ```
  { fileName, fileMime, fileBase64 (≤2MB), bankType, parserUsed,
    detectedHeaders, errorMessage?, userNote?, userEmail, userName, clientId }
  ```
  Writes file to `gs://<bucket>/importIssues/{issueId}/{fileName}`. Creates `importIssues/{issueId}` doc with metadata + Storage path. Then triggers the email.
- `sendImportIssueEmail` (Firestore trigger on `importIssues/{id}` create) — uses the existing Gmail/Nodemailer infrastructure (`EMAIL_USER`/`EMAIL_PASSWORD` secrets used by `scheduledBillReminders`). Sends an email to the configured admin address (`jonathalimax@gmail.com`) with:
  - Subject: `[Realwise] Import failed — {bankType} — {clientId}`
  - Body: user info, parser used, detected headers, error message, user note, deep link to the `/admin/import-issues/{issueId}` page.
  - Attachment: the original file (downloaded from Storage).

### 4. Admin UI (extends existing `/admin`)

- `src/pages/admin/ImportIssues.jsx` — list view, paginated. Columns: date, client, user, bank type, parser used, status (`open` / `resolved`). Click → detail page.
- `src/pages/admin/ImportIssueDetail.jsx` — shows user info, file download link (signed URL from Storage), parsed headers, sample preview (first 10 lines of the file rendered safely), error message, user note. Actions: **Mark resolved**, **Add internal note**.
- New nav entry in the existing admin sidebar: "Import issues" with an unread count badge.

---

## Data Models — Phase 1

### Shared Firestore (`moneywise-ad9ec`)

```
importIssues/{issueId}
  ts                     timestamp
  clientId               string             (e.g. "jonathalimax")
  userEmail              string
  userName               string
  bankType               string             ("auto" | "bradesco" | ...)
  parserUsed             string             ("generic" | "bradesco" | "none")
  fileName               string
  fileMime               string
  fileSizeBytes          number
  storagePath            string             ("importIssues/{id}/{name}")
  detectedHeaders        string[]
  errorMessage           string?
  userNote               string?
  status                 "open" | "resolved" | "duplicate"
  resolvedAt             timestamp?
  resolvedBy             string?            (admin email)
  internalNotes          { ts, by, text }[]
```

### Shared Storage (`moneywise-ad9ec`)

```
importIssues/{issueId}/{originalFileName}     ← the user's file, untouched
```

Storage rules: write only via the `submitImportIssue` Cloud Function (denied for client SDK); read only via signed URLs generated for admin.

---

## Flows — Phase 1

### Flow A — Successful import (no change for users)

User uploads → built-in parser matches → categorization → confirmation → save. No telemetry, no email. (Telemetry is Phase 2.)

### Flow B — Generic fallback returns 0 transactions

1. User uploads `c6.csv`.
2. No built-in parser matches; generic returns `[]`.
3. `ImportModal` shows the empty result with a banner: **"We couldn't read this file. Want to send it to us so we can add support?"**
4. User clicks **Send report**, optionally adds a note ("This is from C6 Bank checking account").
5. File is uploaded to shared Firebase Storage; `importIssues` doc is created.
6. Cloud Function emails admin with the file attached.

### Flow C — Import looks wrong on confirmation modal

1. User uploads `unknown.csv`. Some parser (often generic) returns garbled transactions.
2. User sees the confirmation modal with weird data.
3. New button on confirmation modal: **"This doesn't look right — report it"**.
4. Same flow as B from step 4.

### Flow D — Admin resolves an issue

1. Admin gets email or opens `/admin/import-issues`.
2. Reviews the file, identifies the new format.
3. Implements/fixes the parser in code, deploys.
4. Marks the issue as **Resolved**, optionally adding an internal note ("Added C6 parser in commit abc1234").
5. Optional: replies to the user via the existing admin email tooling.

---

## Security & Privacy — Phase 1

- **Explicit user consent** before any file is sent. The "Send report" button shows exactly what is being sent (the file, plus listed metadata) and requires a click.
- **File size cap** at 2 MB per upload (covers normal CSV/PDF statements; rejects misuse).
- **Storage access** restricted: writes go only via the Cloud Function with admin credentials; reads only via signed URLs the admin generates.
- **Rate limit** on `submitImportIssue` per user: 5 / day. Reuses the per-user counter pattern from `aiCategorizationService.js` (`aiQuota` collection).
- **Admin auth** for `/admin/import-issues` reuses the existing `admins/{email}` check.

---

## Implementation Phases

### Phase 1 (this spec) — Parsers + manual issue reporting

1. Fix `bradesco.js` (column names, preamble, footer).
2. Add `inter.js`, `itauPdf.js`, `bradescoPdf.js`, `ofx.js`.
3. Implement `mercadopagoPdf.js` per the existing 2026-04-24 spec.
4. Add Vitest tests with anonymized real-file fixtures.
5. Wire up `.ofx` extension routing and `BANK_OPTIONS`.
6. Build `ImportIssueReport.jsx`, `importIssueService.js`.
7. Build `submitImportIssue` and `sendImportIssueEmail` Cloud Functions on shared project.
8. Build `/admin/import-issues` list + detail pages.

### Phase 2 (future, separate spec) — Intelligent format learning

The full plan from the prior draft moves here:
- Per-user custom format storage in each client's Firebase.
- AI-assisted column mapping with Gemini 2.0 Flash Lite (reuses categorization quota).
- Anonymization pipeline for sample rows.
- Shared global format registry served via Hosting JSON.
- Admin approval queue for promoting submissions to the global registry.
- Telemetry stream + scheduled format-break detection.

Phase 1 proves the pipeline (file → admin → fix → deploy). Phase 2 makes it self-service.

---

## Testing — Phase 1

### Unit tests (Vitest)

```
src/services/importers/bankParsers/__tests__/
  fixtures/
    inter-conta.csv
    inter-conta.ofx
    itau-extrato.txt          ← extracted PDF text
    bradesco-conta.csv
    bradesco-conta.txt        ← extracted PDF text
    mercadopago-fatura.txt    ← extracted PDF text
    ofx-generic.ofx
  inter.test.js
  itauPdf.test.js
  bradesco.test.js
  bradescoPdf.test.js
  mercadopagoPdf.test.js
  ofx.test.js
```

Each test asserts: detection works on real headers; all transaction rows parsed; sign conventions correct; date parsing correct; amount parsing handles `1.234,56` and `0,01`; footer/preamble noise excluded.

### Manual smoke test

For each new parser, import a real (anonymized) sample file in dev → verify count, categorization, confirmation modal, no console errors. For the issue-reporting flow: trigger an empty import on purpose → verify file lands in shared Storage and email arrives.

---

## Risks & Mitigations — Phase 1

| Risk | Mitigation |
|---|---|
| Existing Bradesco users imported broken data | Fix only affects new imports; old imports keep their stored values. Add a release note. |
| User uploads sensitive file by mistake | Explicit opt-in; UI clearly lists what's being sent before submission. |
| Storage bucket fills with junk submissions | 2 MB cap + 5/day rate limit + admin can delete via Storage console. |
| Admin email goes to spam | Use the existing Gmail/Nodemailer setup that already delivers bill reminders successfully. |
| OFX parser too generic and conflicts with existing parsers | OFX routing is by extension only (`.ofx`), never by content sniff. |
| Per-client Firebase ↔ shared Firebase coupling makes onboarding harder | Issue submission is best-effort and never blocks import; if shared project is down, the import still works locally. |

---

## Decisions

1. **Admin email:** `jonathalimax@gmail.com`.
2. **Dedupe:** allow duplicate submissions; admin can mark dupes as `status: 'duplicate'` from the UI.
3. **User feedback after submission:** toast only ("Obrigado! Recebemos seu arquivo, vamos olhar com carinho."). No in-app inbox.
4. **File retention:** keep all submitted files in Storage indefinitely. No auto-delete.
