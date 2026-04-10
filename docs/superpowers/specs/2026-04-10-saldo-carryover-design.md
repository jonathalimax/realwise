# Saldo Carryover Design

**Date:** 2026-04-10
**Status:** Approved

## Problem

The financial summary on the home dashboard (income, expenses, saldo) computes balance as `income - expenses` for the selected month only. Unused balance from prior months is not reflected — each month starts at zero regardless of what was saved or overspent before.

## Goal

Carry the cumulative saldo of all previous months forward into the current month's financial summary, making the displayed balance reflect the user's real accumulated position.

## Decisions

| Question | Answer |
|---|---|
| Carryover scope | Cascading — cumulative balance of ALL months before selected month |
| Display style | Explicit — a labeled "Saldo anterior" line in the summary |
| TrendChart | Show a running cumulative balance line overlay |
| Backend changes | None — all computation is client-side |
| Context changes | None — new custom hook only |

---

## Architecture

All transactions are already fetched client-side in both dashboard parents. A new `useCarryoverSaldo` hook centralizes the accumulation logic and returns two values consumed by display components.

```
All Transactions (full list)
        │
        ▼
useCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey)
        │
        ├─► carryoverSaldo       → number
        └─► cumulativeByMonth    → { 'YYYY-MM': number }
                │
                ├─► BalanceSummary         (prop: carryoverSaldo)
                ├─► IncomeVsExpensesCard   (prop: carryoverSaldo)
                └─► TrendChart             (prop: cumulativeByMonth)
```

---

## `useCarryoverSaldo` Hook

**Location:** `src/hooks/useCarryoverSaldo.js`

**Signature:**
```js
useCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey)
// Returns: { carryoverSaldo: number, cumulativeByMonth: { [monthKey: string]: number } }
```

**Algorithm:**
1. Group all non-ignored transactions by effective month key, applying the same `viewMode` + `getPaymentMonthKey` logic the dashboards already use:
   - `viewMode === 'purchase'`: use transaction date for all
   - `viewMode === 'payment'`: income uses transaction date; expenses use `getPaymentMonthKey(date, bankId, paymentMethod)`
2. Sort resulting month keys chronologically
3. Walk all months in order, accumulating `income - expenses` into a running total
4. Build `cumulativeByMonth` — the running total after each month
5. `carryoverSaldo` = cumulative total of all months **strictly before** `selectedMonth`

**Return shape:**
```js
{
  carryoverSaldo: 300,           // sum of all months before selectedMonth
  cumulativeByMonth: {
    '2026-01': 500,              // running balance after Jan
    '2026-02': 300,              // running balance after Jan+Feb
    '2026-03': 750,              // running balance after Jan+Feb+Mar
  }
}
```

**Edge cases:**
- No prior months with transactions → `carryoverSaldo = 0`
- Ignored transactions (`trans.ignored === true`) → excluded
- Negative carryover (overspent history) → valid, displayed in red

---

## UI Changes

### `IncomeVsExpensesCard` (`src/components/IncomeVsExpensesCard.jsx`)

New optional prop: `carryoverSaldo` (default `0`).

- Total balance: `income - expenses + carryoverSaldo`
- A "Saldo anterior" row appears **only when `carryoverSaldo !== 0`**, between expenses and total:

```
┌─────────────────────────────────┐
│ Receitas           R$ 5.000     │
│ Despesas          -R$ 3.200     │
│ Saldo anterior    +R$   500     │  ← conditional row
├─────────────────────────────────┤
│ Saldo total        R$ 2.300     │
└─────────────────────────────────┘
```

Color: green if positive, red if negative.

### `BalanceSummary` (`src/components/BalanceSummary.jsx`)

New optional prop: `carryoverSaldo` (default `0`).

- Balance calculation: `income - expenses + carryoverSaldo`
- **Mobile view**: total balance number reflects carryover silently (compact layout, no extra row)
- **Desktop view**: subtitle `"+ saldo anterior: R$ X"` appears under the Total Balance card value when `carryoverSaldo !== 0`

### `TrendChart` (`src/components/charts/TrendChart.jsx`)

New optional prop: `cumulativeByMonth` (default `{}`).

- Overlay a **running balance line** on the existing income/expense bar chart
- Uses MUI X Charts line series alongside the existing bar series
- Line data points: for each month in the 12-month range, look up `cumulativeByMonth[monthKey]` (fall back to `0` or omit if no data)
- Line ends at the last month that has transaction data — no extrapolation into future months
- Legend gains a third item: "Saldo acumulado" (indigo/blue)
- If `cumulativeByMonth` is empty, line series is not rendered — chart unchanged

---

## Parent Dashboard Wiring

### `src/pages/Dashboard.jsx`

```js
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';

const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
  transactions, selectedMonth, viewMode, getPaymentMonthKey
);
// Pass carryoverSaldo → IncomeVsExpensesCard
// Pass cumulativeByMonth → TrendChart
```

### `src/components/Dashboard.jsx`

```js
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';

const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
  transactions, selectedMonth, viewMode, getPaymentMonthKey
);
// Pass carryoverSaldo → BalanceSummary
// Pass cumulativeByMonth → TrendChart
```

---

## Files Changed

| File | Type | Change |
|---|---|---|
| `src/hooks/useCarryoverSaldo.js` | **New** | Core accumulation logic |
| `src/pages/Dashboard.jsx` | Modified | Call hook, pass props |
| `src/components/Dashboard.jsx` | Modified | Call hook, pass props |
| `src/components/IncomeVsExpensesCard.jsx` | Modified | "Saldo anterior" row + updated total |
| `src/components/BalanceSummary.jsx` | Modified | Carryover in balance + desktop subtitle |
| `src/components/charts/TrendChart.jsx` | Modified | Cumulative balance line series |

**No Firestore changes. No context changes. No new routes.**

---

## Out of Scope

- Planning page (`src/pages/Planning.jsx`) — budget comparison is plan-vs-actual, not a running balance
- Planner wallet tab — separate system, uses investment positions not transaction saldo
- `Budget.jsx` — budget tracking is category-based, not impacted by carryover saldo
