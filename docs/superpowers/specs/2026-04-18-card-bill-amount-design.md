# Card Bill Amount — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Problem

Credit card bills (category `credit_card`, field `linkedBankId`) are auto-created when a user adds a credit card. They never carry an `amount` field, so bill summary totals and the bill list always show zero for card bills. The correct invoice total is derivable from the user's transactions for that card in the billing period.

## Goal

Auto-compute and display the invoice total for each card bill by summing the credit transactions belonging to that bill's billing period.

---

## Architecture

### New hook: `src/hooks/useCardBillAmounts.js`

**Signature:**
```js
useCardBillAmounts(bills, selectedMonth) → Map<billId, number>
```

**Responsibilities:**
1. Filter `bills` to only card bills: `bill.linkedBankId` is set and `bill.category === 'credit_card'`
2. Collect the unique `linkedBankId` values from those bills
3. Subscribe to Firestore `transactions` collection filtered by:
   - `userId == ownerId` (from `useAccess`)
   - `bankId in [linkedBankIds]` (Firestore `in` query, max 30 values)
   - `type == 'expense'`
4. Client-side, keep only transactions where `paymentMethod === 'credit'` or `paymentMethod` is undefined (backwards compat)
5. For each transaction, call `getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod)` from `useCards()`
6. Group by payment month key, then match to card bills by `linkedBankId` + month
7. Return `Map<billId, number>` — the summed absolute amount per bill

**Dependencies:** `useAccess`, `useCards`, Firestore `onSnapshot`

**Re-subscription triggers:** changes to the `bills` array identity or `selectedMonth`

---

### Changes to `BillsList.jsx`

- Call `useCardBillAmounts(bills, selectedMonth)` at the top of the component
- Pass `cardAmounts` map into `BillItem` (or read it in scope via closure)
- `BillItem`: render the computed amount if `cardAmounts.get(bill.id)` is defined; otherwise fall back to `bill.amount ?? null` (hide if zero/null for non-card bills without an amount)
- Summary cards (overdue/upcoming/pending/paid totals): use `cardAmounts.get(b.id) ?? b.amount ?? 0` when summing amounts

---

## Data Flow

```
Firestore transactions
        ↓  onSnapshot (filtered by userId + bankIds)
useCardBillAmounts
        ↓  Map<billId, amount>
BillsList
        ↓  prop/closure
BillItem  →  displays amount
Summary cards  →  correct totals
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No credit transactions for this card this month | Amount shows 0 |
| Card bill has no `linkedBankId` | Not processed by hook; falls back to `bill.amount` |
| More than 30 card bills (Firestore `in` limit) | Batch queries in groups of 30 |
| `selectedMonth` not provided | Hook returns empty Map |
| Transaction has `paymentMethod !== 'credit'` (debit/pix on a credit card bank) | Excluded from sum |

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useCardBillAmounts.js` | **New** — hook implementation |
| `src/components/BillsList.jsx` | Call hook, pass amounts to BillItem, update summary totals |

No Firestore schema changes required. No new indexes required (query uses existing `userId` + `bankId` fields).
