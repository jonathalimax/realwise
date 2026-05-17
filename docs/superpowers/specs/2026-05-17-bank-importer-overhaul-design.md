# Bank Importer Overhaul — Design Specification

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

Four targeted improvements to the bank import pipeline:

1. **Deduplication hash overhaul** — exclude description/name/type; use date + amount + bankType + originalId.
2. **Auto-detect UX** — file-first flow; bank selector becomes optional; format selector removed.
3. **Import issue email fix** — route to `support@realwise.com.br`, not `jonathalimax@gmail.com`.
4. **Dark mode audit** — every element in `ImportModal.jsx` and `ImportIssueReport.jsx`.

Parser status (from existing spec + codebase audit) is documented for completeness but most parsers are already implemented.

---

## 1. Deduplication Hash Overhaul

### Problem

The current `generateTransactionHash` (in `src/services/installments.js`) likely includes `description` or `name` in its input, causing false "new" transactions when the same bank renames a transaction across export files.

### New Hash Formula

```
hash = SHA-256(
  date (YYYY-MM-DD) +
  "|" + amount (absolute, toFixed(2)) +
  "|" + bankType +
  "|" + (originalId || "") +
  "|" + positionalIndex
)
```

**Fields:**
- `date`: `transaction.date` normalized to `YYYY-MM-DD`. Strip any time component.
- `amount`: `Math.abs(transaction.amount).toFixed(2)` — always positive. The sign (income/expense) is excluded because some banks reclassify the same transaction between exports.
- `bankType`: the parser identifier string (e.g., `"bradesco"`, `"inter"`, `"nubank"`, `"unknown"`). Prevents cross-bank hash collisions.
- `originalId`: the bank's own transaction identifier when present (`Docto.` field in Bradesco CSV, `FITID` in OFX files). Empty string when absent.
- `positionalIndex`: per-group sequential index within same-date + same-amount + no-originalId transactions **in the current import file**. Computed in the import pre-processing step (see below). Default `0` when `originalId` is present.

**Positional index algorithm:**

```
Group transactions by (date, amount) where originalId is absent.
Within each group, assign index = position in that group (0, 1, 2, …).
```

Same file → same order → same hashes → no re-import duplicates. Different file with additional transactions → new positional index for the extras → correctly added.

### Firestore

Add `dedupHash` field to every new transaction document. The duplicate check before save becomes:

```js
// Before saving a batch of transactions:
const newHashes = transactions.map(t => t.dedupHash);
// Query existing docs with matching hashes:
const existing = await getDocs(query(
  collection(db, 'transactions'),
  where('userId', '==', userId),
  where('dedupHash', 'in', newHashes.slice(0, 30)) // Firestore 'in' limit = 30
));
// Filter out already-present hashes
```

For batches > 30 transactions, chunk the `in` query.

### Migration

Existing transactions without `dedupHash` are not backfilled automatically. A one-time script (`scripts/backfill-dedup-hash.js`) computes the hash from stored `date`, `amount`, `bankType` (use `"unknown"` if absent), `originalId` (empty if absent), positionalIndex `0`. The script is a standalone Node.js file that targets a specific client's Firestore; it is not part of the app deploy. Run it per client on demand.

### Where to Implement

- `src/services/installments.js` — update `generateTransactionHash` signature and implementation.
- `src/services/importers/index.js` — in `categorizeParsedTransactions`, compute positional indices before calling `generateTransactionHash`, then run the dedup check before the confirmation modal.

---

## 2. Auto-Detect UX — File-First Import Flow

### Problem

Current `ImportModal.jsx` forces the user to select a bank AND a format before uploading. This is redundant since the parsers can detect the bank from file content.

### New Flow

```
Step 1: User drops / selects a file → system auto-detects bank
Step 2 (optional override): User can select a bank manually to override detection
Step 3 (mismatch warning): If manual selection contradicts file content, show warning
```

**No format selector.** File extension determines parsing path:
- `.csv` / `.xlsx` → CSV/Excel parsers
- `.ofx` → OFX parser
- `.pdf` → PDF parsers

### Component Changes — `ImportModal.jsx`

1. **Bank selector becomes optional.** Default value: `"auto"` (label: "Detectar automaticamente").
2. **Remove the format selector entirely.** Delete the `<select>` for CSV/OFX/PDF.
3. **File picker is the primary action.** On file selection, immediately run `detectBankFromFile(file)` (new utility function — see below) and update a read-only "Banco detectado" badge showing the result.
4. **Mismatch warning:** If the user has manually selected a bank (not "auto") AND `detectBankFromFile` returns a different bank, show an inline warning:
   > "Este arquivo parece ser do **{detectedBank}**, não do **{selectedBank}**. Deseja usar o parser do {detectedBank}?"
   with "Sim, usar {detectedBank}" and "Manter {selectedBank}" buttons.

### `detectBankFromFile(file)` Utility

New pure function in `src/services/importers/index.js`:

```js
export async function detectBankFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'ofx') return 'ofx';
  if (ext === 'pdf') {
    const { text } = await extractPdfText(file);
    if (detectItauPdf(text)) return 'itauPdf';
    if (detectBradescoPdf(text)) return 'bradescoPdf';
    if (detectInterFaturaPdf(text)) return 'interFaturaPdf';
    if (detectInterPdf(text)) return 'interPdf';
    if (detectMercadoPagoPdf(text)) return 'mercadopagoPdf';
    return 'unknown';
  }
  // CSV / Excel
  const data = await parseCSV(file);
  if (detectNubank(data)) return 'nubank';
  if (detectBradesco(data)) return 'bradesco';
  if (detectInter(data)) return 'inter';
  if (detectMercadopago(data)) return 'mercadopago';
  if (detectItau(data)) return 'itau';
  return 'generic';
}
```

This is called on file selection (before the user clicks "Import"). It runs the same detection chain as `parseFile` but returns the bank name instead of transactions, so the UI can show the detected bank immediately.

### BANK_OPTIONS Label Map

Add a human-readable label map for the bank names shown in the "detected" badge and mismatch warning:

```js
const BANK_LABELS = {
  nubank: 'Nubank', bradesco: 'Bradesco', inter: 'Inter',
  mercadopago: 'Mercado Pago', itau: 'Itaú', itauPdf: 'Itaú (PDF)',
  bradescoPdf: 'Bradesco (PDF)', interPdf: 'Inter (PDF)',
  interFaturaPdf: 'Inter Fatura (PDF)', mercadopagoPdf: 'Mercado Pago (PDF)',
  ofx: 'OFX', generic: 'Formato genérico', unknown: 'Banco desconhecido'
};
```

---

## 3. Import Issue Email Fix

The existing spec (`2026-05-05-bank-importer-expansion-design.md`) hardcoded `jonathalimax@gmail.com` as the admin email recipient. This spec supersedes that decision:

- `sendImportIssueEmail` Cloud Function must send to **`support@realwise.com.br`**.
- Change the `to:` field in the Nodemailer call inside `sendImportIssueEmail` from the hardcoded personal email to `support@realwise.com.br`.
- No other changes to the Cloud Function.

---

## 4. Dark Mode Audit — ImportModal & ImportIssueReport

### Approach

Audit every element in `src/components/ImportModal.jsx` and `src/components/ImportIssueReport.jsx` (or wherever these files live) for missing `dark:` Tailwind classes. The standard Realwise dark mode pattern is `dark:` prefix classes alongside the light variants.

**Elements to audit:**
- Text colors (any `text-gray-*`, `text-black` without `dark:` variant)
- Backgrounds (`bg-white`, `bg-gray-50` → `dark:bg-gray-900` / `dark:bg-gray-800`)
- Borders (`border-gray-200` → `dark:border-gray-700`)
- Inputs and selects (background, text, border)
- File drop zone (background, border, hover state)
- Confirmation table (header background, row backgrounds, text)
- Transaction preview rows (alternating row colors)
- Error/success banners (colored backgrounds with text)
- Buttons (primary, secondary, destructive)
- Modal overlay and panel background
- Badges and status chips

### Fix Standard

For each hardcoded light color, add the corresponding `dark:` class. Follow the existing pattern from other modals in the codebase (e.g., `DiscountModal.jsx`, `EmailModal.jsx`) as the reference.

---

## Parser Audit Summary

| Parser | File | Expected Status | Action |
|---|---|---|---|
| Nubank CSV | `nubank.js` | ✅ Working | Verify in smoke test |
| Mercado Pago CSV | `mercadopago.js` | ✅ Working | Verify in smoke test |
| Bradesco CSV | `bradesco.js` | May be fixed already | Run unit test with real headers |
| Bradesco PDF | `bradescoPdf.js` | Implemented per prior spec | Run unit test |
| Inter CSV | `inter.js` | Implemented per prior spec | Run unit test |
| Inter OFX | `ofx.js` | Generic OFX handles this | Confirm with real file |
| Inter PDF | `interPdf.js` | Implemented | Run unit test |
| Inter Fatura PDF | `interFaturaPdf.js` | Implemented | Run unit test |
| Itaú PDF | `itauPdf.js` | Implemented per prior spec | Run unit test |
| Mercado Pago PDF | `mercadopagoPdf.js` | Implemented per prior spec | Run unit test |
| Generic OFX | `ofx.js` | Implemented per prior spec | Run unit test |

**If any unit test reveals a broken parser**, fix it as part of this spec's implementation. The unit test fixtures from `src/services/importers/bankParsers/__tests__/fixtures/` should be used.

---

## Testing

### Unit Tests (Vitest)

- `generateTransactionHash` — test same file produces same hashes; test different description same date/amount produces same hash; test two same-date-same-amount transactions get distinct hashes via positional index.
- `detectBankFromFile` — test each bank's real file returns correct bank name.

### Manual Smoke Tests

- Import each bank's sample file in dev → verify correct bank detected, transactions parsed, no duplicates on re-import.
- Toggle bank selector to "manual override" with wrong bank → verify mismatch warning appears.
- Set `useAICategorization: false` (default) → verify no Gemini API calls in network tab.

---

## Out of Scope

- Adding new parsers beyond what's already implemented.
- Per-user custom import format storage (Phase 2).
- Admin parser management UI.
