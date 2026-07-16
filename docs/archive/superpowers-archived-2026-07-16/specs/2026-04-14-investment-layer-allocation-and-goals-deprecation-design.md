# Investment Layer Allocation & Goals Deprecation Design

**Date:** 2026-04-14  
**Status:** Approved

---

## Problem Statement

Three issues need to be addressed:

1. **Withdrawal shows false loss ("prejuízo"):** Withdrawing from an investment (e.g. emergency fund) reduces `currentAmount` but `getTotalInvested()` still counts the original `initialAmount`, making the portfolio display a loss when there is none.

2. **Investments not counting toward layer allocation:** `addInvestment()` does not save `plannerGoalId` to Firestore. `getSubBalance()` queries by `inv.plannerGoalId`, so newly added investments never appear in the Carteira layer progress — only edited investments (where `updateInvestment` spreads all fields) work correctly.

3. **Goals vs Layer allocation confusion:** The Goals page and Carteira sublayers serve overlapping purposes. Goals are being phased out in favor of Carteira layers as the primary financial planning surface.

---

## Decisions

- **Option A: Fix bugs + soft-deprecate Goals.** Goals page hidden from nav, deprecation banner added, no data deleted.
- Sublayer picker on investments stays at the sublayer level (not layer level) for finer control.
- `getTotalInvested()` accounts for withdrawals so portfolio P&L is accurate.

---

## Section 1: Bug Fixes

### Bug 1 — `getTotalInvested()` (`src/contexts/InvestmentContext.jsx:301`)

**Current:**
```js
return investments.reduce((sum, inv) => sum + (inv.initialAmount || 0), 0);
```

**Fix:**
```js
return investments.reduce((sum, inv) => {
  const net = (inv.initialAmount || 0) - (inv.totalWithdrawn || 0);
  return sum + Math.max(0, net);
}, 0);
```

**Effect:** R$10k invested, R$3k withdrawn → R$7k "total invested", R$7k current value = 0% loss. `getGrowthPercentage` and `getTotalGrowth` already handle `totalWithdrawn` correctly and are unchanged.

### Bug 2 — `addInvestment()` (`src/contexts/InvestmentContext.jsx:384`)

**Current `newInvestment` object:** does not include `plannerGoalId`.

**Fix:** Add to `newInvestment`:
```js
plannerGoalId: investmentData.plannerGoalId || null,
```

**Effect:** Newly added investments with a sublayer selected are saved with `plannerGoalId`. `getSubBalance()` in `walletVersion.js` already queries by `inv.plannerGoalId === sublayer.id`, so layer progress bars update immediately after the fix.

---

## Section 2: Investment → Sublayer Picker

The investment form (`src/pages/InvestmentForm.jsx`) already:
- Has `plannerGoalId` in `formData`
- Uses `usePlannerGoals()` to populate a dropdown
- Passes `plannerGoalId` through `investmentData` to `addInvestment` / `updateInvestment`

With Bug 2 fixed, the picker works end-to-end on both add and edit. No UI changes are needed.

The picker displays sublayers as a flat list with their parent layer label for context (e.g. "Emergência — Proteção"), which is already the correct shape from `usePlannerGoals()`.

---

## Section 3: Goals Soft-Deprecation

### Conceptual separation (post-deprecation)

| Concept | Purpose | Where |
|---|---|---|
| Carteira sublayer | Where money is allocated and growing | `/planning` → Carteira tab |
| Goals page | Legacy — being phased out | `/goals` (hidden from nav) |

### Changes

1. **Remove Goals from main nav** — hide the nav link. The route `/goals` still works.
2. **Add deprecation banner on `/goals`** — non-blocking notice: informs the user that goals have moved to Carteira layers and links to `/planning`.
3. **No data deletion** — `goals` Firestore collection, `GoalsContext`, and all investment `goalId` references remain intact.

### What stays the same

- `/goals` route accessible by direct URL
- Investments with `goalId` still display correctly on the Goals page
- No Firestore migration

---

## Files Changed

| File | Change |
|---|---|
| `src/contexts/InvestmentContext.jsx` | Fix `getTotalInvested()` and `addInvestment()` |
| `src/pages/Goals.jsx` | Add deprecation banner |
| `src/components/Sidebar.jsx` | Hide Goals nav link |

---

## Out of Scope

- Hard deletion of Goals page or Firestore collection
- Migration of existing goal data into planner sublayers
- Changes to `getGrowthPercentage`, `getTotalGrowth`, or withdrawal flow logic
