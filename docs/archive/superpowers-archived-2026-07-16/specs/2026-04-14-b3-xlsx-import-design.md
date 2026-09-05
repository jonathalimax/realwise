# B3 XLSX Multi-Sheet Import — Design Spec
**Date:** 2026-04-14

## Overview

The B3 "Posição Consolidada" export comes as an `.xlsx` file with two sheets. The current `processB3Positions` function calls `parseCSVFromBuffer` unconditionally, so XLSX files are never parsed. This spec covers extending the B3 import pipeline to support XLSX files and all sheets within them.

---

## XLSX File Structure

B3 exports the XLSX with exactly two sheets:

### Sheet 1 — Equities
Columns used:
- `Código de Negociação` → ticker (e.g. `ITUB4`, `MXRF11`)
- `Tipo` → abbreviated type code (see TYPE_MAP below)
- `Quantidade` → quantity (JS number in XLSX, formatted string in CSV)
- `Valor Atualizado` → current market value (JS number in XLSX)
- `Instituição` → broker name

### Sheet 2 — Fixed Income (Tesouro Direto)
Columns used:
- `Produto` → investment name (e.g. "Tesouro Prefixado 2029")
- `Código ISIN` → used as ticker (e.g. `BRSTNCLTN806`)
- `Quantidade` → quantity held
- `Valor Atualizado` → current value
- `Valor Aplicado` → original invested amount (initialAmount)
- `Vencimento` → maturity date (DD/MM/YYYY)
- `Instituição` → broker name

Sheet 2 positions get `source: "b3"` like equities. Brapi sync will attempt price lookup on the ISIN and skip silently when not found — no error.

---

## Type Mapping

The CSV format uses long-form Tipo strings. The XLSX uses abbreviated codes. Both must be handled:

| XLSX code | CSV long form | Investment type |
|---|---|---|
| `ON` | Ação Ordinária | `stocks` |
| `PN` | Ação Preferencial | `stocks` |
| `BDR` | BDR | `stocks` |
| `UNT` | Units | `stocks` |
| `DR1`, `DR3` | — | `stocks` |
| `ETF` | ETF / Fundo de Índice | `funds` |
| `CI` | Cotas de Índice | `funds` |
| `FII` | Fundo de Investimento Imobiliário | `fii` |
| (Sheet 2 rows) | — | `fixed_income` |

---

## Architecture

```
XLSX file uploaded to Firebase Storage /imports/{userId}/b3/
       │
       ▼
processB3Positions — detects .xlsx extension
       │
       ▼
parseB3XlsxPositions(workbook)        ← new function in b3Parser.js
  Sheet 1 → parseB3EquitySheet(ws)   ← refactored from parseB3Positions
  Sheet 2 → parseB3FixedIncomeSheet(ws)
       │
       ▼
Combined positions array (same shape as CSV path output)
       │
       ▼
Existing Firestore upsert logic (unchanged)
```

---

## Components

### 1. `functions/parsers/b3Parser.js` (updated)

**`parseBRNumber(str)`** — already handles `"1.234,56"` strings. Extend to also accept JS `number` type (XLSX delivers actual numbers):
```js
if (typeof str === 'number') return str;
```

**TYPE_MAP** — add short-code entries alongside existing long-form entries:
```js
'on': 'stocks', 'pn': 'stocks', 'bdr': 'stocks',
'unt': 'stocks', 'dr1': 'stocks', 'dr3': 'stocks',
'etf': 'funds', 'ci': 'funds',
'fii': 'fii',
```

**`parseB3EquitySheet(rows)`** — extracted from current `parseB3Positions`. Same logic, same output shape. Replaces `parseB3Positions` internally; `parseB3Positions` becomes a thin wrapper calling this.

**`parseB3FixedIncomeSheet(rows)`** — new. Processes Sheet 2 rows:
- Skip rows where `Produto` is blank or `Quantidade` is 0
- Return `{ ticker: codigoIsin, name: produto, quantity, currentValue: valorAtualizado, initialAmount: valorAplicado, maturityDate: vencimento (ISO string), type: 'fixed_income', broker: instituicao }`

**`parseB3XlsxPositions(workbook)`** — new export. Iterates `workbook.SheetNames`, routes each sheet by its index (0 = equities, 1 = fixed income), combines results into one array.

### 2. `functions/importProcessor.js` (updated)

`processB3Positions` — add extension detection before parsing:

```js
const fileExtension = fileName.split('.').pop().toLowerCase();
let positions;
if (['xlsx', 'xls'].includes(fileExtension)) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  positions = parseB3XlsxPositions(workbook);
} else {
  const data = parseCSVFromBuffer(fileBuffer);
  positions = parseB3Positions(data);
}
```

Requires adding `const XLSX = require('xlsx')` and `const { parseB3XlsxPositions } = require('./parsers/b3Parser')` imports.

### 3. `functions/parsers/b3Parser.test.js` (updated)

Add tests for:
- `parseBRNumber` accepts JS number directly
- `parseB3XlsxPositions` with a mock workbook containing equity and fixed-income sheets
- `parseB3FixedIncomeSheet` maps Tesouro Direto row to `fixed_income` type
- Short-code TYPE_MAP: `PN` → `stocks`, `FII` → `fii`, `CI` → `funds`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| XLSX sheet has no data rows | Skip that sheet, log warning |
| Row with zero quantity | Skip silently (existing behavior) |
| Unknown `Tipo` code | Default to `stocks`, log warning |
| `Código ISIN` blank on Sheet 2 | Skip that row |
| Brapi sync on ISIN ticker | No match found → skip silently (existing behavior) |

---

## Out of Scope

- Parsing sheets beyond index 0 and 1 (B3 only exports two)
- Modifying the Brapi sync to handle fixed-income ISINs specially
- Historical transaction import from XLSX
