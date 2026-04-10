# Saldo Carryover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the cumulative saldo of all previous months forward into the current month's financial summary, so users see their real accumulated balance instead of a monthly-only view.

**Architecture:** A new `useCarryoverSaldo` hook centralizes the accumulation logic and returns `carryoverSaldo` (number) and `cumulativeByMonth` (map). Both dashboard parents call the hook and pass results as props to `BalanceSummary`, `IncomeVsExpensesCard`, and `TrendChart`.

**Tech Stack:** React 19, Vite 7, `@mui/x-charts` v8 (composition API for mixed bar/line chart), Vitest for unit testing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/hooks/useCarryoverSaldo.js` | **Create** | Pure computation + hook wrapper |
| `src/hooks/useCarryoverSaldo.test.js` | **Create** | Unit tests for `computeCarryoverSaldo` |
| `vite.config.js` | Modify | Add vitest `test` config block |
| `package.json` | Modify | Add `test` + `test:watch` scripts, vitest devDep |
| `src/pages/Dashboard.jsx` | Modify | Call hook, pass props to IncomeVsExpensesCard + TrendChart |
| `src/components/Dashboard.jsx` | Modify | Call hook, pass props to BalanceSummary (×3) + TrendChart |
| `src/components/IncomeVsExpensesCard.jsx` | Modify | Accept `carryoverSaldo`, update balance, add "Saldo anterior" row |
| `src/components/BalanceSummary.jsx` | Modify | Accept `carryoverSaldo`, update balance, desktop subtitle |
| `src/components/charts/TrendChart.jsx` | Modify | Accept `cumulativeByMonth`, add running balance line via composition API |
| `src/locales/pt.js` | Modify | Add `balance.previousBalance` |
| `src/locales/en.js` | Modify | Add `balance.previousBalance` |

---

## Task 1: Set Up Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Expected: vitest appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block, add two entries:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Full scripts block after change:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Add test config to `vite.config.js`**

Inside the object returned by the `defineConfig` callback, add a `test` key after the `resolve` block:

```js
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@landing': path.resolve(__dirname, './landing_page'),
      },
    },
    test: {
      environment: 'node',
    },
```

- [ ] **Step 4: Verify setup works**

```bash
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected output: vitest starts and reports "No test files found" (no failures, no errors).

---

## Task 2: `useCarryoverSaldo` Hook (TDD)

**Files:**
- Create: `src/hooks/useCarryoverSaldo.js`
- Create: `src/hooks/useCarryoverSaldo.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useCarryoverSaldo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeCarryoverSaldo } from './useCarryoverSaldo';

// Converts a date string to 'YYYY-MM' using transaction date (purchase mode)
const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

describe('computeCarryoverSaldo', () => {
  it('returns zero carryover when no transactions exist', () => {
    const result = computeCarryoverSaldo([], '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(0);
    expect(result.cumulativeByMonth).toEqual({});
  });

  it('returns zero when all transactions are in the selected month', () => {
    const txs = [
      { date: '2026-04-01', type: 'income', amount: 5000 },
      { date: '2026-04-15', type: 'expense', amount: 3000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(0);
  });

  it('accumulates balance from all prior months', () => {
    const txs = [
      { date: '2026-01-01', type: 'income', amount: 5000 },
      { date: '2026-01-15', type: 'expense', amount: 4000 }, // Jan: +1000
      { date: '2026-02-01', type: 'income', amount: 5000 },
      { date: '2026-02-15', type: 'expense', amount: 4500 }, // Feb: +500, cumul: 1500
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(1500);
  });

  it('does not include the selected month in the carryover', () => {
    const txs = [
      { date: '2026-03-01', type: 'income', amount: 5000 },
      { date: '2026-03-15', type: 'expense', amount: 4000 }, // Mar: +1000
      { date: '2026-04-01', type: 'income', amount: 5000 }, // selected month — excluded
      { date: '2026-04-15', type: 'expense', amount: 3000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(1000);
  });

  it('excludes ignored transactions', () => {
    const txs = [
      { date: '2026-01-01', type: 'income', amount: 5000, ignored: true },
      { date: '2026-01-15', type: 'expense', amount: 4000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(-4000);
  });

  it('handles negative carryover when spending exceeds income', () => {
    const txs = [
      { date: '2026-01-01', type: 'income', amount: 1000 },
      { date: '2026-01-15', type: 'expense', amount: 3000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'purchase', dateKey);
    expect(result.carryoverSaldo).toBe(-2000);
  });

  it('builds cumulativeByMonth with correct running totals', () => {
    const txs = [
      { date: '2026-01-01', type: 'income', amount: 5000 },
      { date: '2026-01-15', type: 'expense', amount: 4000 },
      { date: '2026-02-01', type: 'income', amount: 5000 },
      { date: '2026-02-15', type: 'expense', amount: 4500 },
      { date: '2026-03-01', type: 'income', amount: 5000 },
      { date: '2026-03-15', type: 'expense', amount: 4000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-05', 'purchase', dateKey);
    expect(result.cumulativeByMonth).toEqual({
      '2026-01': 1000,
      '2026-02': 1500,
      '2026-03': 2500,
    });
  });

  it('in payment mode uses getPaymentMonthKey for non-income expenses', () => {
    const paymentKeyFn = (_date, _bankId, _method) => '2026-03';
    const txs = [
      { date: '2026-01-01', type: 'expense', amount: 1000, bankId: 'bank1', paymentMethod: 'credit' },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'payment', paymentKeyFn);
    expect(result.cumulativeByMonth['2026-01']).toBeUndefined();
    expect(result.cumulativeByMonth['2026-03']).toBe(-1000);
    expect(result.carryoverSaldo).toBe(-1000);
  });

  it('in payment mode income always uses the transaction date regardless of getPaymentMonthKey', () => {
    const paymentKeyFn = () => '2026-99'; // should never be called for income
    const txs = [
      { date: '2026-01-01', type: 'income', amount: 5000 },
    ];
    const result = computeCarryoverSaldo(txs, '2026-04', 'payment', paymentKeyFn);
    expect(result.cumulativeByMonth['2026-01']).toBe(5000);
    expect(result.cumulativeByMonth['2026-99']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: Tests fail with `Error: Failed to resolve import "./useCarryoverSaldo"` or similar.

- [ ] **Step 3: Implement `computeCarryoverSaldo` and the hook**

Create `src/hooks/useCarryoverSaldo.js`:

```js
import { useMemo } from 'react';

/**
 * Pure computation — exported for unit testing.
 *
 * Groups all non-ignored transactions by their effective month key,
 * accumulates a running balance across months in chronological order,
 * and returns:
 *   - carryoverSaldo: cumulative balance of all months strictly before selectedMonth
 *   - cumulativeByMonth: { 'YYYY-MM': runningBalance } for every month that has data
 *
 * Month key rules match the dashboard filter logic:
 *   viewMode='purchase' → always use transaction date
 *   viewMode='payment'  → income uses transaction date; expenses use getPaymentMonthKey()
 */
export function computeCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey) {
  const byMonth = {};

  for (const t of allTransactions) {
    if (t.ignored) continue;

    let monthKey;
    if (viewMode === 'purchase') {
      const d = new Date(t.date);
      monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // payment mode
      if (t.type === 'income' || t.investmentId) {
        const d = new Date(t.date);
        monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        monthKey = getPaymentMonthKey(t.date, t.bankId, t.paymentMethod);
      }
    }

    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    if (t.type === 'income') byMonth[monthKey].income += t.amount;
    else byMonth[monthKey].expense += t.amount;
  }

  const sortedMonths = Object.keys(byMonth).sort();
  const cumulativeByMonth = {};
  let running = 0;

  for (const month of sortedMonths) {
    running += byMonth[month].income - byMonth[month].expense;
    cumulativeByMonth[month] = running;
  }

  // carryoverSaldo = the running total after the last month strictly before selectedMonth
  let carryoverSaldo = 0;
  for (const month of sortedMonths) {
    if (month >= selectedMonth) break;
    carryoverSaldo = cumulativeByMonth[month];
  }

  return { carryoverSaldo, cumulativeByMonth };
}

/**
 * React hook — memoizes computeCarryoverSaldo so it only recomputes
 * when transactions, selectedMonth, or viewMode actually change.
 */
export default function useCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey) {
  return useMemo(
    () => computeCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey),
    [allTransactions, selectedMonth, viewMode, getPaymentMonthKey]
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1
```

Expected: All 9 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCarryoverSaldo.js src/hooks/useCarryoverSaldo.test.js vite.config.js package.json package-lock.json
git commit -m "feat: add useCarryoverSaldo hook with tests"
```

---

## Task 3: Wire `src/pages/Dashboard.jsx`

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Import the hook**

At the top of `src/pages/Dashboard.jsx`, after the existing imports, add:

```js
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';
```

- [ ] **Step 2: Call the hook**

`src/pages/Dashboard.jsx` already has `const { getPaymentMonthKey } = useCards();` at around line 48. Add the hook call immediately after it:

```js
const { getPaymentMonthKey } = useCards();
const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
  transactions, selectedMonth, viewMode, getPaymentMonthKey
);
```

- [ ] **Step 3: Pass props to `IncomeVsExpensesCard`**

Find the existing `IncomeVsExpensesCard` usage (around line 177):

```jsx
<IncomeVsExpensesCard
  transactions={monthlyTransactions}
  onInvestmentsClick={handleOpenInvestmentsList}
/>
```

Replace with:

```jsx
<IncomeVsExpensesCard
  transactions={monthlyTransactions}
  onInvestmentsClick={handleOpenInvestmentsList}
  carryoverSaldo={carryoverSaldo}
/>
```

- [ ] **Step 4: Pass props to `TrendChart`**

Find the existing `TrendChart` usage (around line 188):

```jsx
<TrendChart transactions={transactions} selectedMonth={selectedMonth} viewMode={viewMode} />
```

Replace with:

```jsx
<TrendChart
  transactions={transactions}
  selectedMonth={selectedMonth}
  viewMode={viewMode}
  cumulativeByMonth={cumulativeByMonth}
/>
```

- [ ] **Step 5: Verify no console errors**

Run `npm run dev` and open the app. Check browser console for errors. The UI should look exactly the same as before (components not yet updated to use the new props).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: wire carryover props in pages/Dashboard"
```

---

## Task 4: Update `IncomeVsExpensesCard`

**Files:**
- Modify: `src/components/IncomeVsExpensesCard.jsx`

- [ ] **Step 1: Add `carryoverSaldo` prop and update balance**

Replace the function signature and the `useMemo` block:

Current:
```js
export default function IncomeVsExpensesCard({ transactions, onInvestmentsClick }) {
  const { language, formatCurrency } = useSettings();
  const { investments, getTotalCurrentValue, getTotalGrowth } = useInvestments();

  const { totalIncome, totalExpenses, balance, percentageDiff } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const bal = income - expenses;
    const pctDiff = income > 0 ? ((expenses / income) * 100) : 0;

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: bal,
      percentageDiff: pctDiff
    };
  }, [transactions]);
```

Replace with:
```js
export default function IncomeVsExpensesCard({ transactions, onInvestmentsClick, carryoverSaldo = 0 }) {
  const { language, formatCurrency } = useSettings();
  const { investments, getTotalCurrentValue, getTotalGrowth } = useInvestments();

  const { totalIncome, totalExpenses, balance, percentageDiff } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter(t => t.type === 'expense' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);

    const bal = income - expenses + carryoverSaldo;
    const pctDiff = income > 0 ? ((expenses / income) * 100) : 0;

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: bal,
      percentageDiff: pctDiff
    };
  }, [transactions, carryoverSaldo]);
```

- [ ] **Step 2: Add the "Saldo anterior" row**

In the JSX, find the `{/* Balance */}` section (around line 89). Insert the new row **between** the Expenses block closing `</div>` and the `{/* Balance */}` div:

```jsx
        {/* Saldo anterior — only when there is a non-zero carryover */}
        {carryoverSaldo !== 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {language === 'pt' ? 'Saldo anterior' : 'Previous balance'}
                </span>
              </div>
              <span className={`text-xl font-bold ${carryoverSaldo >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                {carryoverSaldo >= 0 ? '+' : ''}{formatCurrency(carryoverSaldo)}
              </span>
            </div>
          </div>
        )}
```

- [ ] **Step 3: Verify in browser**

Start `npm run dev`, navigate to the main dashboard. If you have transactions from prior months:
- The "Saldo anterior" row should appear between Expenses and the Balance section
- The total "Saldo" should equal this month's `income - expenses + carryoverSaldo`

If you are viewing the earliest month with transactions, `carryoverSaldo` is 0 and the row should not appear.

- [ ] **Step 4: Commit**

```bash
git add src/components/IncomeVsExpensesCard.jsx
git commit -m "feat: add saldo anterior row to IncomeVsExpensesCard"
```

---

## Task 5: Wire `src/components/Dashboard.jsx`

**Files:**
- Modify: `src/components/Dashboard.jsx`

- [ ] **Step 1: Import the hook**

At the top of `src/components/Dashboard.jsx`, after the existing imports, add:

```js
import useCarryoverSaldo from '../hooks/useCarryoverSaldo';
```

- [ ] **Step 2: Call the hook**

`src/components/Dashboard.jsx` has `const { ..., getPaymentMonthKey } = useCards();`. Add the hook call immediately after it:

```js
const { carryoverSaldo, cumulativeByMonth } = useCarryoverSaldo(
  transactions, selectedMonth, viewMode, getPaymentMonthKey
);
```

- [ ] **Step 3: Update all three `BalanceSummary` usages**

There are 3 instances of `BalanceSummary` in this file (lines ~536, ~568, ~599). Update **all three** from:

```jsx
<BalanceSummary transactions={monthlyTransactions} onInvestmentsClick={handleOpenInvestmentsList} />
```

to:

```jsx
<BalanceSummary
  transactions={monthlyTransactions}
  onInvestmentsClick={handleOpenInvestmentsList}
  carryoverSaldo={carryoverSaldo}
/>
```

- [ ] **Step 4: Update the `TrendChart` usage**

Find the `TrendChart` usage (around line 589):

```jsx
<TrendChart transactions={transactions} selectedMonth={selectedMonth} viewMode={viewMode} />
```

Replace with:

```jsx
<TrendChart
  transactions={transactions}
  selectedMonth={selectedMonth}
  viewMode={viewMode}
  cumulativeByMonth={cumulativeByMonth}
/>
```

- [ ] **Step 5: Verify no console errors**

Run `npm run dev` and open the old dashboard view. No console errors expected.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: wire carryover props in components/Dashboard"
```

---

## Task 6: Update `BalanceSummary`

**Files:**
- Modify: `src/components/BalanceSummary.jsx`
- Modify: `src/locales/pt.js`
- Modify: `src/locales/en.js`

- [ ] **Step 1: Add locale keys**

In `src/locales/pt.js`, find the `balance` object and add `previousBalance`:

```js
  balance: {
    totalBalance: 'Saldo Total',
    income: 'Entrada',
    expenses: 'Saída',
    previousBalance: 'Saldo anterior',
  },
```

In `src/locales/en.js`, same location:

```js
  balance: {
    totalBalance: 'Total Balance',
    income: 'Income',
    expenses: 'Expenses',
    previousBalance: 'Previous balance',
  },
```

- [ ] **Step 2: Add `carryoverSaldo` prop and update `summary.balance`**

Replace the function signature and the `useMemo` block in `src/components/BalanceSummary.jsx`:

Current:
```js
export default function BalanceSummary({ transactions = [], onInvestmentsClick }) {
  const { formatCurrency, t } = useSettings();
  const { investments, getTotalCurrentValue, getTotalGrowth } = useInvestments();

      const summary = useMemo(() => {
      let income = 0;
      let expenses = 0;
  
      transactions.forEach((trans) => {
        // Skip ignored transactions
        if (trans.ignored) return;
  
        if (trans.type === 'income') {
          income += trans.amount;
        } else {
          expenses += trans.amount;
        }
      });
  
      console.log('BalanceSummary - transactions:', transactions);
      console.log('BalanceSummary - Calculated Income:', income, 'Expenses:', expenses);
  
      return {
        totalIncome: income,
        totalExpenses: expenses,
        balance: income - expenses
      };
    }, [transactions]);
```

Replace with:
```js
export default function BalanceSummary({ transactions = [], onInvestmentsClick, carryoverSaldo = 0 }) {
  const { formatCurrency, t } = useSettings();
  const { investments, getTotalCurrentValue, getTotalGrowth } = useInvestments();

  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;

    transactions.forEach((trans) => {
      if (trans.ignored) return;
      if (trans.type === 'income') {
        income += trans.amount;
      } else {
        expenses += trans.amount;
      }
    });

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses + carryoverSaldo,
    };
  }, [transactions, carryoverSaldo]);
```

Note: the two `console.log` debug lines are intentionally removed.

- [ ] **Step 3: Add desktop subtitle to the Total Balance card**

Find the `cards` array definition. The first card is the Total Balance card. Update it to add `subtitle` and `subtitleColor` fields:

Current:
```js
  const cards = [
    {
      title: t('balance.totalBalance'),
      value: summary.balance,
      icon: (
        <svg ...>...</svg>
      ),
      color: summary.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600',
      bgColor: 'bg-gray-50 dark:bg-gray-700',
      borderColor: 'border-gray-100 dark:border-gray-700'
    },
```

Replace with:
```js
  const cards = [
    {
      title: t('balance.totalBalance'),
      value: summary.balance,
      subtitle: carryoverSaldo !== 0
        ? `${carryoverSaldo > 0 ? '+' : ''}${formatCurrency(carryoverSaldo)} ${t('balance.previousBalance')}`
        : undefined,
      subtitleColor: carryoverSaldo >= 0 ? 'text-indigo-500' : 'text-rose-500',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: summary.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600',
      bgColor: 'bg-gray-50 dark:bg-gray-700',
      borderColor: 'border-gray-100 dark:border-gray-700'
    },
```

- [ ] **Step 4: Verify in browser**

Open the old dashboard (mobile/desktop). Check:
- Desktop: Total Balance card shows a subtitle like `+R$ 1.500,00 Saldo anterior` when there is a prior-month saldo
- Mobile: The total balance number is correct (silently includes carryover)
- When viewing the earliest month with data, no subtitle appears

- [ ] **Step 5: Commit**

```bash
git add src/components/BalanceSummary.jsx src/locales/pt.js src/locales/en.js
git commit -m "feat: add carryover balance and previous balance label to BalanceSummary"
```

---

## Task 7: Update `TrendChart` with Running Balance Line

**Files:**
- Modify: `src/components/charts/TrendChart.jsx`

- [ ] **Step 1: Update imports**

Replace the current import:
```js
import { BarChart } from '@mui/x-charts/BarChart';
```

With the composition API imports:
```js
import {
  ResponsiveChartContainer,
  BarPlot,
  LinePlot,
  ChartsXAxis,
  ChartsYAxis,
  ChartsTooltip,
} from '@mui/x-charts';
```

- [ ] **Step 2: Add `cumulativeByMonth` prop**

Update the function signature from:
```js
export default function TrendChart({ transactions, selectedMonth, viewMode }) {
```

To:
```js
export default function TrendChart({ transactions, selectedMonth, viewMode, cumulativeByMonth = {} }) {
```

- [ ] **Step 3: Compute `balanceData` for the line series**

After the existing `const monthsRange = getMonthsRange();` line, add:

```js
  // Compute running balance data points for the line series.
  // Uses null for months beyond the last month with transaction data (no extrapolation).
  const lastDataMonth = Object.keys(cumulativeByMonth).sort().at(-1) ?? null;
  const balanceData = lastDataMonth
    ? (() => {
        let last = null;
        return monthsRange.map(({ key }) => {
          if (cumulativeByMonth[key] !== undefined) last = cumulativeByMonth[key];
          return key > lastDataMonth ? null : last;
        });
      })()
    : null;
```

- [ ] **Step 4: Build the `series` array**

After the existing `const expenseData = ...` line, add:

```js
  const series = [
    {
      type: 'bar',
      data: incomeData,
      color: '#10B981',
      valueFormatter: (value) => formatCurrency(value),
      id: 'income',
    },
    {
      type: 'bar',
      data: expenseData,
      color: '#EF4444',
      valueFormatter: (value) => formatCurrency(value),
      id: 'expenses',
    },
    ...(balanceData ? [{
      type: 'line',
      data: balanceData,
      color: '#6366f1',
      valueFormatter: (value) => value !== null ? formatCurrency(value) : '',
      id: 'balance',
      showMark: false,
    }] : []),
  ];
```

- [ ] **Step 5: Update the legend**

Find the custom legend section in the JSX:

```jsx
      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('balance.income')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('balance.expenses')}</span>
        </div>
      </div>
```

Replace with:
```jsx
      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('balance.income')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">{t('balance.expenses')}</span>
        </div>
        {balanceData && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-indigo-500 rounded-full" />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {language === 'pt' ? 'Saldo acumulado' : 'Cumulative balance'}
            </span>
          </div>
        )}
      </div>
```

- [ ] **Step 6: Replace `BarChart` with `ResponsiveChartContainer` composition**

Find the chart JSX block:

```jsx
        <div className="min-w-[800px] w-full h-full">
          <BarChart
            xAxis={[{
              scaleType: 'band',
              data: monthLabels,
              tickLabelStyle: {
                fontSize: 12,
                fill: textColor,
              },
            }]}
            yAxis={[{
              tickLabelStyle: {
                fontSize: 12,
                fill: textColor,
              },
              valueFormatter: formatCompactValue,
            }]}
            series={[
              {
                data: incomeData,
                color: '#10B981',
                valueFormatter: (value) => formatCurrency(value),
              },
              {
                data: expenseData,
                color: '#EF4444',
                valueFormatter: (value) => formatCurrency(value),
              },
            ]}
            slotProps={{
              legend: {
                hidden: true,
              },
            }}
            sx={{
              '& .MuiChartsAxis-tickLabel': {
                fill: textColor,
              },
              '& .MuiChartsAxis-line': {
                stroke: textColor,
              },
              '& .MuiChartsAxis-tick': {
                stroke: textColor,
              },
            }}
            margin={{ top: 10, right: 20, bottom: 30, left: 50 }}
          />
        </div>
```

Replace with:
```jsx
        <div className="min-w-[800px] w-full h-full">
          <ResponsiveChartContainer
            series={series}
            xAxis={[{
              scaleType: 'band',
              data: monthLabels,
              id: 'x',
              tickLabelStyle: { fontSize: 12, fill: textColor },
            }]}
            yAxis={[{
              id: 'y',
              tickLabelStyle: { fontSize: 12, fill: textColor },
              valueFormatter: formatCompactValue,
            }]}
            sx={{
              '& .MuiChartsAxis-tickLabel': { fill: textColor },
              '& .MuiChartsAxis-line': { stroke: textColor },
              '& .MuiChartsAxis-tick': { stroke: textColor },
            }}
            margin={{ top: 10, right: 20, bottom: 30, left: 50 }}
          >
            <BarPlot />
            <LinePlot />
            <ChartsXAxis />
            <ChartsYAxis />
            <ChartsTooltip />
          </ResponsiveChartContainer>
        </div>
```

- [ ] **Step 7: Verify in browser**

Open the dashboard and navigate to a month that has prior months with transactions. Confirm:
- Income and expense bars render exactly as before
- An indigo line appears showing the running cumulative balance
- The legend shows the third "Saldo acumulado" item
- When viewing the first month (no prior data), the line does not appear and the legend item is hidden
- Hovering bars/line shows a tooltip with formatted currency values
- Mobile scroll behavior still works

- [ ] **Step 8: Commit**

```bash
git add src/components/charts/TrendChart.jsx
git commit -m "feat: add cumulative balance line to TrendChart"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 6 spec sections covered — hook, IncomeVsExpensesCard, BalanceSummary, TrendChart, pages/Dashboard wiring, components/Dashboard wiring
- [x] **Placeholder scan:** No TBDs, all code blocks are complete
- [x] **Type consistency:** `carryoverSaldo` (number, default 0) and `cumulativeByMonth` (`{ [string]: number }`, default `{}`) are consistent across all 7 tasks
- [x] **Edge cases covered:** zero carryover → row hidden; negative carryover → red color; no prior transaction data → line not rendered
- [x] **Console.log removal:** Two debug `console.log` lines in `BalanceSummary` removed in Task 6 Step 2
