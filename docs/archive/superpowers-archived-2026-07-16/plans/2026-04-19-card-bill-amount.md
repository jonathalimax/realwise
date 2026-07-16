# Card Bill Amount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-compute and display the correct invoice total for credit card bills by summing credit transactions belonging to that bill's billing period.

**Architecture:** A new `useCardBillAmounts(bills, selectedMonth)` hook subscribes to Firestore transactions for linked card banks, uses `getPaymentMonthKey` from `CardsContext` to assign transactions to billing months, and returns a `Map<billId, amount>`. `BillsList` calls this hook and uses the map when rendering amounts and computing summary totals.

**Tech Stack:** React hooks, Firebase Firestore (`onSnapshot`, `query`, `where`, `collection`), existing `useAccess` + `useCards` contexts.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/hooks/useCardBillAmounts.js` | **Create** | Firestore subscription + amount computation |
| `src/components/BillsList.jsx` | **Modify** | Call hook, display amounts, fix summary totals |

---

## Task 1: Create `useCardBillAmounts` hook

**Files:**
- Create: `src/hooks/useCardBillAmounts.js`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/useCardBillAmounts.js` with this full implementation:

```js
import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';

/**
 * Computes invoice totals for credit card bills by summing credit transactions
 * that belong to each bill's billing period.
 *
 * @param {Array} bills - Full bills array from useBills()
 * @param {string} selectedMonth - 'YYYY-MM' format
 * @returns {Map<string, number>} Map of billId → computed invoice amount
 */
export default function useCardBillAmounts(bills, selectedMonth) {
  const { ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const [amounts, setAmounts] = useState(new Map());

  // Identify card bills and their linked bank IDs
  const cardBills = useMemo(
    () => bills.filter(b => b.linkedBankId && b.category === 'credit_card'),
    [bills]
  );

  const linkedBankIds = useMemo(
    () => [...new Set(cardBills.map(b => b.linkedBankId))],
    [cardBills]
  );

  useEffect(() => {
    if (!ownerId || !selectedMonth || linkedBankIds.length === 0) {
      setAmounts(new Map());
      return;
    }

    // Firestore 'in' queries support max 30 values — batch if needed
    const batches = [];
    for (let i = 0; i < linkedBankIds.length; i += 30) {
      batches.push(linkedBankIds.slice(i, i + 30));
    }

    const unsubscribes = batches.map(batch => {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', ownerId),
        where('bankId', 'in', batch),
        where('type', '==', 'expense')
      );

      return onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter to credit-only (or legacy undefined paymentMethod)
        const creditTxs = txs.filter(
          tx => !tx.paymentMethod || tx.paymentMethod === 'credit'
        );

        // Sum per (bankId, paymentMonthKey)
        const sumByBankMonth = new Map(); // key: `${bankId}::${monthKey}`
        for (const tx of creditTxs) {
          const monthKey = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
          const key = `${tx.bankId}::${monthKey}`;
          sumByBankMonth.set(key, (sumByBankMonth.get(key) ?? 0) + Math.abs(tx.amount));
        }

        // Map bill IDs to their computed amount for selectedMonth
        setAmounts(prev => {
          const next = new Map(prev);
          for (const bill of cardBills) {
            const key = `${bill.linkedBankId}::${selectedMonth}`;
            next.set(bill.id, sumByBankMonth.get(key) ?? 0);
          }
          return next;
        });
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [ownerId, selectedMonth, linkedBankIds, cardBills, getPaymentMonthKey]);

  return amounts;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useCardBillAmounts.js
git commit -m "feat: add useCardBillAmounts hook for credit card invoice totals"
```

---

## Task 2: Display amounts in BillsList

**Files:**
- Modify: `src/components/BillsList.jsx`

- [ ] **Step 1: Import the hook**

At the top of `src/components/BillsList.jsx`, add the import after the existing imports:

```js
import useCardBillAmounts from '../hooks/useCardBillAmounts';
```

- [ ] **Step 2: Call the hook inside the component**

Inside `BillsList`, after the existing hook calls (after `const [confirmPayBillId, setConfirmPayBillId] = useState(null);`), add:

```js
const cardAmounts = useCardBillAmounts(bills, selectedMonth);
```

- [ ] **Step 3: Update summary total calculations**

In `BillsList`, the full view has four summary cards that each call `.reduce((s, b) => s + (b.amount || 0), 0)`. Replace all four of those reducers with a helper that prefers the computed card amount:

Add this helper right after the `cardAmounts` call:

```js
const getBillAmount = (bill) => cardAmounts.get(bill.id) ?? bill.amount ?? 0;
```

Then update every `.reduce` in the summary cards section. In the full view (around line 516–537 in `BillsList.jsx`), change each occurrence of:
```js
formatCurrency(overdueBills.reduce((s, b) => s + (b.amount || 0), 0))
formatCurrency(upcomingBills.reduce((s, b) => s + (b.amount || 0), 0))
formatCurrency(otherPendingBills.reduce((s, b) => s + (b.amount || 0), 0))
formatCurrency(paidBills.reduce((s, b) => s + (b.amount || 0), 0))
```
to:
```js
formatCurrency(overdueBills.reduce((s, b) => s + getBillAmount(b), 0))
formatCurrency(upcomingBills.reduce((s, b) => s + getBillAmount(b), 0))
formatCurrency(otherPendingBills.reduce((s, b) => s + getBillAmount(b), 0))
formatCurrency(paidBills.reduce((s, b) => s + getBillAmount(b), 0))
```

- [ ] **Step 4: Show amount in BillItem**

Inside the `BillItem` component (defined inside `BillsList`), in the `<div className="flex-1 min-w-0">` section, add the amount display after the due date line.

Find the closing `</div>` of the `flex-1 min-w-0` div (after the status + date row) and add before it:

```jsx
{getBillAmount(bill) > 0 && (
  <p className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200 mt-0.5">
    {formatCurrency(getBillAmount(bill))}
  </p>
)}
```

Note: `formatCurrency` is already in scope from `useSettings()` at the top of `BillsList`.

- [ ] **Step 5: Verify the compact view summary also uses getBillAmount**

The compact view does not show currency totals in summary cards, so no changes needed there. Confirm by checking that the compact view section (the `if (compact)` block) only counts bills — it does not call `.reduce` on amounts. No changes required.

- [ ] **Step 6: Commit**

```bash
git add src/components/BillsList.jsx
git commit -m "feat: display computed card invoice amount in BillsList"
```

---

## Task 3: Manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173/{clientId}/dashboard`.

- [ ] **Step 2: Verify card bill shows invoice amount**

1. Navigate to the Bills section (compact widget on Dashboard or the full Bills page)
2. Find a credit card bill (name starts with "Fatura …")
3. Confirm a non-zero amount appears below the due date if there are credit transactions for that card in the current month
4. Confirm the amount is zero or hidden if there are no credit transactions

- [ ] **Step 3: Verify summary totals include card amounts**

On the full Bills page, check that the summary cards (Vencidas / Próximas / Pendentes / Pagas) show correct currency totals that include the computed card amounts.

- [ ] **Step 4: Verify non-card bills are unaffected**

Non-card bills (no `linkedBankId`) should show their existing `bill.amount` or nothing — not zero from the card hook.
