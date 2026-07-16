# Mercado Pago Credit Card PDF Import

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Add support for importing Mercado Pago credit card PDF statements (faturas) alongside the existing CSV import. PDFs are password-protected; the password is requested inline only when needed. Parsing runs entirely client-side using a lazy-loaded `pdfjs-dist`.

## Architecture & Data Flow

```
User selects .pdf file
        │
        ▼
ImportModal detects PDF extension
        │
        ▼
Lazy-load pdfjs-dist (only if not already loaded)
        │
        ▼
Attempt decrypt with no password
  ├─ success → extract text
  └─ requires password → show inline password field
                              │
                              ▼
                        User types password → decrypt → extract text
        │
        ▼
parseMercadoPagoPDF(rawText) → transactions[]
  ├─ find due date (Vence em DD/MM/YYYY) → infer year for DD/MM dates
  ├─ scan ALL pages for transaction table rows
  ├─ skip "Pagamento da fatura" rows
  └─ detect installments → pass to existing generateInstallmentTransactions()
        │
        ▼
Same categorization + AI pipeline as CSV import
```

## New Files

- `src/services/importers/pdfLoader.js` — lazy-loads `pdfjs-dist`, exposes `extractPdfText(file, password?)`
- `src/services/importers/bankParsers/mercadopagoPdf.js` — pure parser for MP credit card PDF text

## Modified Files

- `src/services/importers/index.js` — add `pdf` branch to `parseFile()`
- `src/components/ImportModal.jsx` — password field UX, accept `.pdf`

## PDF Parser Logic (`mercadopagoPdf.js`)

1. **Extract due date** — find `Vence em DD/MM/YYYY` to get the statement year
2. **Find transaction rows** — scan all pages for `DD/MM  <description>  R$ X.XXX,XX` pattern
3. **Skip non-purchases** — skip rows where description starts with `Pagamento da fatura`
4. **Parse date** — `DD/MM` + inferred year. If transaction month is ahead of due date month, subtract 1 year (prior billing cycle)
5. **Parse amount** — strip `R$`, convert Brazilian number format to float; all rows are `expense`
6. **Detect installments** — reuse existing `detectInstallment()` from `src/services/installments.js` which handles `Parcela X de Y`; pass to `generateInstallmentTransactions()` for expansion

Output shape is identical to CSV parsers so the categorization, installment expansion, and dedup hashing pipeline works unchanged.

## ImportModal UX Changes

1. **Accept PDF** — `accept=".csv,.xlsx,.xls,.pdf"`
2. **Detect encryption** — after file selection, if `.pdf`, attempt passwordless decrypt. On encryption error, set `requiresPassword = true`
3. **Inline password field** — shown conditionally below the file picker when `requiresPassword` is true; hidden otherwise
4. **Bank auto-detection** — when a PDF is selected with bank `auto`, force-set to `mercadopago`. If another bank is manually selected with a PDF, show error: "PDF import is only supported for Mercado Pago"
5. **Loading state** — show existing spinner with label "Lendo PDF..." during decrypt + extraction

## Dependencies

- `pdfjs-dist` — lazy-loaded via dynamic `import()` only when user selects a PDF file; zero bundle impact otherwise

## Out of Scope

- PDF import for other banks (Nubank, Itaú, Bradesco)
- Server-side PDF processing
- AI-based PDF parsing
