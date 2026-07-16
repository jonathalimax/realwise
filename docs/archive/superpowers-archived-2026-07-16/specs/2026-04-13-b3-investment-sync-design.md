# B3 Investment Sync — Design Spec
**Date:** 2026-04-13

## Overview

Integrate B3 data into the investments system using a free hybrid approach:
- **Positions** sourced from a B3 CSV export (Canal do Investidor) imported via the existing Import page
- **Prices + dividends** automatically synced 3x/month via a Firebase scheduled function using the Brapi.dev free API
- Manual sync trigger available immediately after import

Existing manual investments (fixed income, crypto, real estate, etc.) are unaffected.

---

## Architecture

```
B3 CSV Export (user downloads from Canal do Investidor)
       │
       ▼
Import Page (/import) — B3 Positions format added
  - File uploaded to Firebase Storage
       │
       ▼
processImport (existing Storage trigger) — routes to b3Parser
  - Matches existing investments by `ticker` field
  - Merges: updates quantity/avgPrice, sets source:"b3"
  - Keeps: notes, goalId, broker/type, color
  - Creates new investment if no ticker match found
       │
       ▼
InvestmentForm — new optional `ticker` field
  (one-time setup: user adds tickers to existing investments before first import)

─────────────────────────────────────

syncB3Investments (pubsub cron: 1st, 10th, 20th of each month, 8AM BRT)
       +
syncB3Investments (HTTP callable: manual trigger from app)
       │
       ▼
Brapi.dev free API
  GET /api/quote/{tickers}            → current prices
  GET /api/quote/{ticker}?dividends=true → dividend history
       │
       ▼
Firestore writes
  investments.currentAmount  ← price × quantity
  investments.lastSyncedAt   ← timestamp
  transactions (income)      ← new dividends not yet logged
  investment_dividends       ← dedup log per ticker+paymentDate
```

---

## Components

### 1. `functions/parsers/b3Parser.js` (new)

Parses the B3 "Posição Consolidada" CSV export format. Fields used:
- `Produto` → ticker (e.g. `ITSA4`, `MXRF11`)
- `Quantidade` → quantity (float)
- `Preço Médio` → avgPrice (float, BRL)
- `Tipo` → maps to investment type: `Ações` → `stocks`, `FII` → `fii`, `ETF` → `funds`
- `Instituição` → broker name

Merge strategy per row:
1. Query `investments` where `userId == ownerId AND ticker == row.ticker`
2. **Match found:** `updateDoc` — set `quantity`, `avgPrice`, `source: "b3"`, `broker` (if blank), keep all other fields
3. **No match:** `addDoc` — create new investment with `source: "b3"`, `ticker`, `quantity`, `avgPrice`, `type`, `broker`, `initialAmount: avgPrice × quantity`

No purchase transaction is created for CSV imports (positions were bought via broker, not tracked here).

### 2. `functions/index.js` — `syncB3Investments` (new)

**Scheduled:** `pubsub.schedule('0 8 1,10,20 * *').timeZone('America/Sao_Paulo')`

**Callable:** `functions.https.onCall` — requires authenticated user, accepts optional `userId` override

Both paths share a `runSync(userId)` helper:

```
1. Fetch all investments where userId == uid AND source == "b3" AND status != "closed"
2. Collect unique tickers
3. Call Brapi.dev GET /api/quote/{tickers joined by comma}
4. For each investment:
   a. Update currentAmount = price × quantity
   b. Update lastSyncedAt = now
5. Call Brapi.dev GET /api/quote/{ticker}?dividends=true for each ticker
6. For each dividend event where paymentDate <= today:
   a. Check investment_dividends/{userId}_{ticker}_{paymentDate} — skip if exists
   b. Calculate amount = dividendPerShare × quantity
   c. Write income transaction: { userId, type:"income", description:"Dividendo: TICKER",
      amount, category:"Investimentos", investmentId, isDividend:true, date:paymentDate }
   d. Write dedup doc to investment_dividends
7. Log sync summary
```

Rate limit: Brapi.dev free tier allows 15 req/min. For users with many tickers, batch into comma-separated requests (Brapi supports multiple tickers per request).

### 3. `functions/parsers/bankParsers.js` — format detection (updated)

Add B3 detection: if CSV headers contain `Produto` and `Quantidade` and `Preço Médio` → route to `b3Parser`.

### 4. `src/pages/Import.jsx` — B3 format option (updated)

- Add "B3 Posições" as a selectable format alongside Nubank, Itaú, Bradesco
- Show helper text: "Exporte seu extrato de posição consolidada do Canal do Investidor (b3.com.br)"
- After successful import, show a "Sincronizar agora" button that calls the `syncB3Investments` callable

### 5. `src/pages/InvestmentForm.jsx` — `ticker` field (updated)

- Add optional text input `ticker` (uppercase, max 6 chars) shown when `type` is `stocks`, `fii`, or `funds`
- Displayed with helper: "Ex: ITSA4, MXRF11 — necessário para sincronização B3"
- Saved to Firestore `investments` document

### 6. `src/contexts/InvestmentContext.jsx` — `calculateProjectedValue` (updated)

For investments with `source: "b3"`, skip the projected value calculation — `getCurrentValue` returns `currentAmount` directly (set by cron). This prevents double-calculation.

---

## Firestore

### `investments` document (additions)
```
ticker:        string | null    // "ITSA4", "MXRF11"
quantity:      number | null    // shares held
avgPrice:      number | null    // average cost per share (BRL)
source:        "b3" | null      // null = manual entry
lastSyncedAt:  timestamp | null // last successful Brapi sync
```

### `investment_dividends` collection (new)
```
{userId}_{ticker}_{paymentDate}  // document ID (dedup key)
  userId:       string
  ticker:       string
  paymentDate:  string           // YYYY-MM-DD
  amount:       number
  transactionId: string          // ref to transactions doc
  createdAt:    timestamp
```

### `transactions` document (additions)
```
isDividend:    boolean | null    // true for cron-generated dividend income
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Brapi.dev returns 429 (rate limit) | Retry after 60s delay, max 3 attempts; log warning if all fail |
| Brapi.dev ticker not found | Skip that investment, log warning with ticker name |
| B3 CSV format unrecognized | Import page shows error: "Formato não reconhecido. Verifique se é o extrato de posição consolidada." |
| CSV row ticker has no match and no type | Default to `stocks` |
| Duplicate dividend (dedup doc exists) | Skip silently |
| Manual sync called while cron is running | Idempotent — dedup doc prevents double transactions |

---

## Out of Scope

- Fetching positions directly from B3/broker APIs (requires paid aggregator)
- Stock purchase/sale transaction tracking from broker history
- Intraday price updates
- Historical performance charts per ticker

---

## Implementation Phases

1. **InvestmentForm `ticker` field** — small change, enables user prep
2. **b3Parser + processImport routing** — CSV import in existing pipeline
3. **Import page B3 format + "Sync now" button** — frontend wiring
4. **`syncB3Investments` function** — cron + callable, Brapi.dev integration
5. **InvestmentContext bypass for `source:"b3"`** — prevents projection override
