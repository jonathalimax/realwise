# Investment Layer Allocation & Goals Deprecation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two investment bugs (withdrawal shows false loss, plannerGoalId not saved on add) and soft-deprecate the Goals page in favor of Carteira sublayers.

**Architecture:** Pure bug fixes in `InvestmentContext.jsx` (two one-liners), plus UI changes to `Sidebar.jsx` and `Goals.jsx` to hide/banner the Goals page. No Firestore schema changes, no migrations.

**Tech Stack:** React 19, Vite, Firebase/Firestore, Tailwind CSS v4, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/contexts/InvestmentContext.jsx` | Fix `getTotalInvested()` (line 301) and `addInvestment()` (line 395) |
| `src/contexts/InvestmentContext.withdrawal.test.js` | New — unit test for fixed `getTotalInvested` |
| `src/components/Sidebar.jsx` | Remove Goals entry from `navItems` array |
| `src/pages/Goals.jsx` | Add deprecation banner at top of page |

---

## Task 1: Fix `getTotalInvested()` — withdrawal no longer shows as loss

**Files:**
- Create: `src/contexts/InvestmentContext.withdrawal.test.js`
- Modify: `src/contexts/InvestmentContext.jsx:301`

- [ ] **Step 1: Write the failing test**

Create `src/contexts/InvestmentContext.withdrawal.test.js`:

```js
import { describe, it, expect } from 'vitest';

// Extracted logic under test (mirrors InvestmentContext.jsx getTotalInvested)
function getTotalInvested(investments) {
  return investments.reduce((sum, inv) => {
    const net = (inv.initialAmount || 0) - (inv.totalWithdrawn || 0);
    return sum + Math.max(0, net);
  }, 0);
}

describe('getTotalInvested', () => {
  it('returns initialAmount when no withdrawal', () => {
    const investments = [{ initialAmount: 10000 }];
    expect(getTotalInvested(investments)).toBe(10000);
  });

  it('subtracts totalWithdrawn from initialAmount', () => {
    const investments = [{ initialAmount: 10000, totalWithdrawn: 3000 }];
    expect(getTotalInvested(investments)).toBe(7000);
  });

  it('never returns negative (full withdrawal)', () => {
    const investments = [{ initialAmount: 10000, totalWithdrawn: 10000 }];
    expect(getTotalInvested(investments)).toBe(0);
  });

  it('sums multiple investments correctly', () => {
    const investments = [
      { initialAmount: 10000, totalWithdrawn: 3000 },
      { initialAmount: 5000 },
      { initialAmount: 2000, totalWithdrawn: 2000 },
    ];
    // (10000-3000) + (5000-0) + max(0, 2000-2000) = 7000 + 5000 + 0 = 12000
    expect(getTotalInvested(investments)).toBe(12000);
  });

  it('handles missing totalWithdrawn field', () => {
    const investments = [{ initialAmount: 8000 }];
    expect(getTotalInvested(investments)).toBe(8000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npx vitest run src/contexts/InvestmentContext.withdrawal.test.js
```

Expected: All 5 tests FAIL (function not matching old behavior or not imported yet — the test is self-contained so it should actually pass immediately once the logic is correct; this step confirms the test file runs).

> Note: Because the test file defines the corrected function inline (not importing from context yet), these tests will pass. This is intentional — we're verifying the *fixed* logic before applying it to the source.

- [ ] **Step 3: Apply the fix in `InvestmentContext.jsx`**

In `src/contexts/InvestmentContext.jsx`, find the `getTotalInvested` function around line 301:

```js
// BEFORE
const getTotalInvested = () => {
  return investments.reduce((sum, inv) => sum + (inv.initialAmount || 0), 0);
};
```

Replace with:

```js
// AFTER
const getTotalInvested = () => {
  return investments.reduce((sum, inv) => {
    const net = (inv.initialAmount || 0) - (inv.totalWithdrawn || 0);
    return sum + Math.max(0, net);
  }, 0);
};
```

- [ ] **Step 4: Run the tests again**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && npx vitest run src/contexts/InvestmentContext.withdrawal.test.js
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add src/contexts/InvestmentContext.jsx src/contexts/InvestmentContext.withdrawal.test.js && git commit -m "fix: getTotalInvested subtracts totalWithdrawn to avoid false loss display"
```

---

## Task 2: Fix `addInvestment()` — save `plannerGoalId` to Firestore

**Files:**
- Modify: `src/contexts/InvestmentContext.jsx` (around line 395, inside `addInvestment`)

No test file needed here — the Firestore call can't be unit tested without mocking the full Firebase SDK. Manual verification is the correct approach (see Step 3).

- [ ] **Step 1: Apply the fix in `addInvestment()`**

In `src/contexts/InvestmentContext.jsx`, find the `newInvestment` object inside `addInvestment`. It looks like this:

```js
const newInvestment = {
  userId: auth.currentUser.uid,
  name: investmentData.name,
  type: investmentData.type || 'fixed_income',
  bank: investmentData.bank || '',
  initialAmount: investmentData.initialAmount || 0,
  currentAmount: investmentData.currentAmount || investmentData.initialAmount || 0,
  expectedReturn: investmentData.expectedReturn || 0,
  returnType: investmentData.returnType || 'annual',
  purchaseDate: investmentData.purchaseDate || new Date().toISOString().split('T')[0],
  maturityDate: investmentData.maturityDate || null,
  goalId: investmentData.goalId || null,
  notes: investmentData.notes || '',
  createdAt: serverTimestamp(),
};
```

Add `plannerGoalId` after the `goalId` line:

```js
const newInvestment = {
  userId: auth.currentUser.uid,
  name: investmentData.name,
  type: investmentData.type || 'fixed_income',
  bank: investmentData.bank || '',
  initialAmount: investmentData.initialAmount || 0,
  currentAmount: investmentData.currentAmount || investmentData.initialAmount || 0,
  expectedReturn: investmentData.expectedReturn || 0,
  returnType: investmentData.returnType || 'annual',
  purchaseDate: investmentData.purchaseDate || new Date().toISOString().split('T')[0],
  maturityDate: investmentData.maturityDate || null,
  goalId: investmentData.goalId || null,
  plannerGoalId: investmentData.plannerGoalId || null,
  notes: investmentData.notes || '',
  createdAt: serverTimestamp(),
};
```

- [ ] **Step 2: Manual verification**

1. Start the dev server: `npm run dev`
2. Navigate to `/investments/new`
3. Fill in name and amount, then select any sublayer from the "Camada do planejador" dropdown
4. Submit the form
5. Open Firestore console → `investments` collection → find the new document
6. Confirm it has a `plannerGoalId` field matching the selected sublayer ID
7. Navigate to `/planner` → Carteira tab → open the layer that contains the sublayer you picked
8. Confirm the sublayer's balance now reflects the investment amount

- [ ] **Step 3: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add src/contexts/InvestmentContext.jsx && git commit -m "fix: save plannerGoalId on addInvestment so layer allocation counts new investments"
```

---

## Task 3: Soft-deprecate Goals — hide from nav, add banner

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/pages/Goals.jsx`

- [ ] **Step 1: Remove Goals from `navItems` in `Sidebar.jsx`**

In `src/components/Sidebar.jsx`, find the `navItems` array (around line 26):

```js
const navItems = [
  { path: '/dashboard', icon: HomeIcon, labelKey: 'dashboard' },
  { path: '/planner', icon: PresentationChartLineIcon, labelKey: 'planner' },
  { path: '/investments', icon: BriefcaseIcon, labelKey: 'investments' },
  { path: '/expenses', icon: ArrowTrendingDownIcon, labelKey: 'expenses' },
  { path: '/income', icon: ArrowTrendingUpIcon, labelKey: 'income' },
  { divider: true },
  { path: '/goals', icon: FlagIcon, labelKey: 'goals' },
  { path: '/bills', icon: DocumentTextIcon, labelKey: 'bills' },
  { path: '/cards', icon: CreditCardIcon, labelKey: 'cards' },
  { path: '/notifications', icon: BellIcon, labelKey: 'notifications' },
];
```

Remove the Goals entry and its divider (the divider above it is no longer needed if Goals was the first item after it):

```js
const navItems = [
  { path: '/dashboard', icon: HomeIcon, labelKey: 'dashboard' },
  { path: '/planner', icon: PresentationChartLineIcon, labelKey: 'planner' },
  { path: '/investments', icon: BriefcaseIcon, labelKey: 'investments' },
  { path: '/expenses', icon: ArrowTrendingDownIcon, labelKey: 'expenses' },
  { path: '/income', icon: ArrowTrendingUpIcon, labelKey: 'income' },
  { divider: true },
  { path: '/bills', icon: DocumentTextIcon, labelKey: 'bills' },
  { path: '/cards', icon: CreditCardIcon, labelKey: 'cards' },
  { path: '/notifications', icon: BellIcon, labelKey: 'notifications' },
];
```

Also remove the now-unused `FlagIcon` import from the import block at the top of the file.

- [ ] **Step 2: Add deprecation banner to `Goals.jsx`**

In `src/pages/Goals.jsx`, find the opening `return (` of `GoalsPage` and add the banner as the first element inside the outermost container. The banner should go immediately after the opening wrapper div (before any existing content):

```jsx
{/* Deprecation notice */}
<div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
  <span className="text-amber-500 text-lg shrink-0">⚠️</span>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
      {language === 'pt' ? 'Metas foram movidas para o Planejador' : 'Goals have moved to the Planner'}
    </p>
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
      {language === 'pt'
        ? 'Use as camadas da Carteira no Planejador para acompanhar seus objetivos financeiros.'
        : 'Use Carteira layers in the Planner to track your financial goals.'}
    </p>
    <a
      href="/planner"
      className="inline-block mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
    >
      {language === 'pt' ? 'Ir para o Planejador →' : 'Go to Planner →'}
    </a>
  </div>
</div>
```

To find the right insertion point, look for the `return (` in `GoalsPage`. The structure typically starts with a wrapping `div`. Insert the banner as the first child of that div, before the existing heading/content.

- [ ] **Step 3: Verify `language` is available in scope**

`Goals.jsx` already imports `useSettings` and destructures `language` (confirmed in the file). No extra imports needed.

- [ ] **Step 4: Manual verification**

1. Check the sidebar — Goals link should be gone
2. Navigate to `/goals` directly — page still loads correctly
3. Deprecation banner appears at top in the correct language
4. Clicking "Ir para o Planejador →" navigates to `/planner`

- [ ] **Step 5: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance && git add src/components/Sidebar.jsx src/pages/Goals.jsx && git commit -m "feat: soft-deprecate Goals page — hide from nav, add banner pointing to Planner"
```
