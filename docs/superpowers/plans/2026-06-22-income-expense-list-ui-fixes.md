# Income/Expense List UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 UI issues: income chart showing expense categories, duplicate "Total no período" label, category badge position and style in TransactionList, date grouping in TransactionList, and category position in ImportModal card.

**Architecture:** Pure UI changes — no new data fetching, no new context, no new routes. All changes are contained to 4 existing component files. `SpendingChart` receives a new optional `type` prop. `TransactionList` groups its already-sorted list by date before rendering. `IncomeChartsView` and `ExpensesChartsView` lose their summary strip. `ImportModal`'s `ImportTransactionCard` inner function gets its category row repositioned.

**Tech Stack:** React 19, Tailwind CSS v4, @mui/x-charts (PieChart), existing contexts (SettingsContext, MonthContext, BudgetContext).

## Global Constraints

- Tailwind CSS v4 — use `dark:` prefix for dark mode, no `darkMode` config needed.
- Language toggle: `language === 'pt'` for Portuguese, `'en'` for English. All strings must have both.
- No new npm packages.
- `npx vitest run src/` for unit tests (pure functions only — no React, no Firebase).
- Dev server: `npm run dev` → `http://localhost:5173`.
- All Firestore queries are scoped by `userId`; never remove that filter.

---

## File Map

| File | Change |
|---|---|
| `src/components/charts/SpendingChart.jsx` | Add `type` prop (default `'expense'`); filter by it; use `categories[type]` for legend |
| `src/components/income/IncomeChartsView.jsx` | Remove summary strip; pass `type="income"` to SpendingChart |
| `src/components/expenses/ExpensesChartsView.jsx` | Remove summary strip |
| `src/components/TransactionList.jsx` | Group by date; move category badge below amount; use import-card badge style |
| `src/components/ImportModal.jsx` | Move category row to sit below value (right-aligned under amount) |

---

## Task 1: Fix SpendingChart to support income transaction types

**Root cause:** `SpendingChart.jsx:88` hardcodes `t.type === 'expense'` when aggregating category totals, and line 100 pulls from `categories?.expense` for the full legend. When `IncomeChartsView` passes income transactions, all are filtered out so the chart appears empty or shows nothing meaningful.

**Files:**
- Modify: `src/components/charts/SpendingChart.jsx`

**Interfaces:**
- Consumes: `transactions` prop (unchanged), new optional `type` prop (`'expense' | 'income'`, default `'expense'`)
- Produces: `<SpendingChart type="income" ... />` renders income category breakdown

- [ ] **Step 1: Add `type` prop with default and update the category totals filter**

In `src/components/charts/SpendingChart.jsx`, change the component signature and the `categoryTotals` reduce:

```jsx
// Before (line 44):
export default function SpendingChart({ transactions, onCategoryClick, selectedMonth }) {

// After:
export default function SpendingChart({ transactions, onCategoryClick, selectedMonth, type = 'expense' }) {
```

Then update the category totals (line 87–92):

```jsx
// Before:
const categoryTotals = transactions
  .filter(t => t.type === 'expense' && !t.ignored)
  .reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

// After:
const categoryTotals = transactions
  .filter(t => t.type === type && !t.ignored)
  .reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
  return acc;
  }, {});
```

- [ ] **Step 2: Update the `allCats` line to use the dynamic type**

In `SpendingChart.jsx`, update the legend category source (line 97–100):

```jsx
// Before:
const allCats = Array.from(new Set([
  ...(categories?.expense ?? []),
  ...Object.keys(categoryTotals),
]));

// After:
const allCats = Array.from(new Set([
  ...(categories?.[type] ?? []),
  ...Object.keys(categoryTotals),
]));
```

- [ ] **Step 3: Update the empty-state text to be type-aware**

In `SpendingChart.jsx`, update the empty state (lines 129–136):

```jsx
// Before:
<p className="font-medium text-gray-500 dark:text-gray-400">{t('charts.noExpenses')}</p>
<p className="text-sm mt-1 text-gray-400 dark:text-gray-500">{t('charts.addExpenseToSee')}</p>

// After:
<p className="font-medium text-gray-500 dark:text-gray-400">
  {type === 'income'
    ? (language === 'pt' ? 'Sem entradas para exibir.' : 'No income to display.')
    : t('charts.noExpenses')}
</p>
<p className="text-sm mt-1 text-gray-400 dark:text-gray-500">
  {type === 'income'
    ? (language === 'pt' ? 'Adicione uma entrada para ver o gráfico.' : 'Add income to see the chart.')
    : t('charts.addExpenseToSee')}
</p>
```

Note: `language` is already destructured from `useSettings()` on line 45.

- [ ] **Step 4: Update `IncomeChartsView` to pass `type="income"`**

In `src/components/income/IncomeChartsView.jsx`, update the SpendingChart usage:

```jsx
// Before (line 48):
<SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} />

// After:
<SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} type="income" />
```

- [ ] **Step 5: Verify manually in dev**

```bash
npm run dev
```

Navigate to `http://localhost:5173/app/income` → switch to Charts view → confirm the pie chart and legend show income categories (e.g. Salário, Freelance), not expense categories.

Navigate to `http://localhost:5173/app/expenses` → Charts view → confirm expenses chart is unchanged.

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/charts/SpendingChart.jsx src/components/income/IncomeChartsView.jsx
rtk git commit -m "fix: SpendingChart respects transaction type — income chart now shows income categories"
```

---

## Task 2: Remove duplicate "Total no período" from both chart views

**Root cause:** `IncomeChartsView` and `ExpensesChartsView` each render a summary strip showing "Total no período" + the period total. The parent pages (`Income.jsx`, `Expenses.jsx`) already display this in a large gradient card above the container. The strip is pure duplication.

**Files:**
- Modify: `src/components/income/IncomeChartsView.jsx`
- Modify: `src/components/expenses/ExpensesChartsView.jsx`

- [ ] **Step 1: Remove summary strip from `IncomeChartsView`**

In `src/components/income/IncomeChartsView.jsx`:

Remove the `totalIncome` useMemo (it's only used by the strip):

```jsx
// DELETE these lines (18–21):
const totalIncome = useMemo(
  () => transactions.filter(t => !t.ignored).reduce((s, t) => s + t.amount, 0),
  [transactions]
);
```

Remove the useMemo import if it becomes unused — check if `useMemo` is used elsewhere in the file. It is only used for `totalIncome`, so remove it from the import:

```jsx
// Before (line 1):
import { useMemo } from 'react';

// After:
// (delete the import entirely — the component has no other hooks)
```

Remove the summary strip JSX (lines 37–44 in the original; shift down after removing useMemo):

```jsx
// DELETE this block:
{/* Summary strip */}
<div className="flex items-center justify-between px-1">
  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
    {language === 'pt' ? 'Total no período' : 'Period total'}
  </p>
  <p className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
    {formatCurrency(totalIncome)}
  </p>
</div>
```

The final `IncomeChartsView.jsx` should look like:

```jsx
import SpendingChart from '@/components/charts/SpendingChart';

export default function IncomeChartsView({ transactions, formatCurrency, language, onCategoryClick }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <span className="text-4xl mb-3">📊</span>
        <p className="text-sm font-medium">
          {language === 'pt' ? 'Sem entradas para exibir no gráfico.' : 'No income to display in the chart.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} type="income" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove summary strip from `ExpensesChartsView`**

In `src/components/expenses/ExpensesChartsView.jsx`, apply the same treatment:

```jsx
// DELETE: totalExpenses useMemo (lines 20-23)
// DELETE: useMemo import (line 1 — replace with nothing)
// DELETE: Summary strip JSX (the flex div with "Total no período")
```

The final `ExpensesChartsView.jsx`:

```jsx
import SpendingChart from '@/components/charts/SpendingChart';

export default function ExpensesChartsView({ transactions, formatCurrency, language, onCategoryClick }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <span className="text-4xl mb-3">📊</span>
        <p className="text-sm font-medium">
          {language === 'pt' ? 'Sem gastos para exibir no gráfico.' : 'No expenses to display in the chart.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
        <SpendingChart transactions={transactions} onCategoryClick={onCategoryClick} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually in dev**

Navigate to both `/app/income` and `/app/expenses` in Charts mode. Confirm:
- The "Total no período" row is gone from the chart section.
- The big gradient card at the top still shows the total correctly.
- The chart itself still renders correctly.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/income/IncomeChartsView.jsx src/components/expenses/ExpensesChartsView.jsx
rtk git commit -m "fix: remove duplicate 'Total no período' from income and expense chart views"
```

---

## Task 3: Add date grouping and move category badge in `TransactionList`

**Current layout (list item):**
```
[icon] [description]                  [+amount]
       [date • category-badge • bank]
```

**Desired layout:**
```
── 15 jan ──────────────────────────────
[icon] [description]                  [+amount]
       [date • bank]           [category-badge]
```

The category badge style should match ImportModal's import card: `text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight`.

**Files:**
- Modify: `src/components/TransactionList.jsx`

**Interfaces:**
- No prop changes. The `sortBy` / `sortOrder` props still drive sorting; date grouping is applied after sort.

- [ ] **Step 1: Add a `groupByDate` helper above the return statement**

In `TransactionList.jsx`, after the `filteredTransactions` declaration (around line 85), add a helper that groups the sorted filtered list into `[{ dateKey, dateLabel, items }]`:

```jsx
const groupedByDate = filteredTransactions.reduce((groups, transaction) => {
  const raw = new Date(transaction.date);
  const dateKey = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
  if (!groups[dateKey]) groups[dateKey] = [];
  groups[dateKey].push(transaction);
  return groups;
}, {});

const dateGroups = Object.entries(groupedByDate)
  .sort(([a], [b]) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a))
  .map(([dateKey, items]) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dateLabel = dateObj.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    return { dateKey, dateLabel, items };
  });
```

Note: `locale` is already declared earlier in the component (`const locale = language === 'pt' ? 'pt-BR' : 'en-US'`).

- [ ] **Step 2: Replace the flat `filteredTransactions.map(...)` with grouped rendering**

In `TransactionList.jsx`, find the transactions list rendering block (starting around line 189: `<div className={compact ? 'space-y-1' : 'space-y-1.5'}>`).

Replace the inner content — the `filteredTransactions.length === 0` check and the `.map(...)` — with this:

```jsx
{filteredTransactions.length === 0 ? (
  <div className="py-12 text-center">
    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
      <span className="text-3xl">🏜️</span>
    </div>
    <p className="font-medium text-slate-900 dark:text-white">{searchTerm ? t('transactionList.noResults') : t('transactionList.empty')}</p>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{searchTerm ? t('transactionList.tryDifferentSearch') : t('transactionList.emptySubtitle')}</p>
  </div>
) : (
  dateGroups.map(({ dateKey, dateLabel, items }) => (
    <div key={dateKey} className="space-y-1">
      {/* Date header */}
      {!compact && (
        <div className="flex items-center gap-2 px-1 py-1">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
            {dateLabel}
          </span>
          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
        </div>
      )}
      {/* Items for this date */}
      {items.map((transaction) => {
        const userBank = findUserBank(transaction.bankId);
        const bankInfo = userBank ? getBankInfo(userBank.bankId) : getBankInfo(transaction.bankId);
        const isSaving = savingId === transaction.id;

        return (
          <div
            key={transaction.id}
            ref={transaction.id === highlightId ? highlightRef : null}
            onClick={() => canWrite && setEditingTransaction(transaction)}
            className={`group rounded-2xl transition-all ${canWrite ? 'cursor-pointer active:scale-[0.99]' : ''}
              ${transaction.id === highlightId
                ? 'ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/20'
                : selectedIds.has(transaction.id)
                  ? 'bg-violet-50 dark:bg-violet-900/10'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }
              ${compact ? 'p-2' : 'p-3'}`}
          >
            <div className="flex items-center gap-3">
              {!compact && canWrite && !hideBulkEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelection(transaction.id); }}
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors
                    ${selectedIds.has(transaction.id)
                      ? 'bg-violet-600 border-violet-600'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                    }`}
                >
                  {selectedIds.has(transaction.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}

              <div className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center flex-shrink-0 text-lg
                ${transaction.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                {getCategoryIcon(transaction.category, transaction.type)}
              </div>

              <div className="flex-1 min-w-0">
                {/* Top row: description + amount */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 leading-snug">
                    {transaction.description?.replace(/\s*\(\d+\/\d+\)\s*$/, '')}
                  </p>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                    {transaction.isInstallment && (
                      <p className="text-[11px] font-bold text-violet-400 dark:text-violet-400 mt-0.5 tabular-nums">
                        {transaction.installmentCurrent} de {transaction.installmentTotal}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom row: bank icon (left) + category badge (right) */}
                <div className="flex items-center justify-between mt-1 gap-2">
                  {/* Left: bank icon only (date removed — shown in group header) */}
                  <div className="flex items-center gap-1.5">
                    {transaction.bankId && (
                      <span className="text-xs" title={userBank ? getBankDisplayName(userBank) : (bankInfo?.name || '')}>
                        {bankInfo?.icon || '🏦'}
                      </span>
                    )}
                  </div>

                  {/* Right: category badge — matches ImportModal style */}
                  <div
                    className="relative inline-grid text-[10px] font-bold rounded-full"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Mirror span drives min-width to match selected text */}
                    <span
                      className={`invisible pl-2 pr-5 py-0.5 whitespace-nowrap pointer-events-none uppercase tracking-tight rounded-full ${
                        transaction.category === 'Sem categoria' || !transaction.category
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                          : transaction.type === 'income'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                      }`}
                      style={{ gridArea: '1/1' }}
                      aria-hidden="true"
                    >
                      {transaction.category || (language === 'pt' ? 'Categorizar' : 'Categorize')}
                    </span>
                    <select
                      value={transaction.category || ''}
                      disabled={!canWrite || isSaving}
                      onChange={(e) => handleQuickCategoryChange(transaction, e.target.value)}
                      style={{ gridArea: '1/1' }}
                      className={`appearance-none w-full pl-2 pr-5 py-0.5 bg-transparent font-bold tracking-tight uppercase text-[10px] transition-colors cursor-pointer border-0 ring-0 focus:ring-2 focus:ring-violet-500 focus:rounded-full rounded-full ${
                        transaction.category === 'Sem categoria' || !transaction.category
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                          : transaction.type === 'income'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                      } ${isSaving ? 'opacity-50' : ''}`}
                    >
                      {(() => {
                        const uncatName = UNCATEGORIZED_CATEGORY[language] || UNCATEGORIZED_CATEGORY.pt;
                        const all = categories[transaction.type] || [];
                        const uncatEntry = all.find(c => c === uncatName);
                        const rest = all.filter(c => c !== uncatName).sort((a, b) => a.localeCompare(b));
                        return (<>
                          <option value="" disabled>{language === 'pt' ? 'Categorizar' : 'Categorize'}</option>
                          {uncatEntry && <option value={uncatEntry}>{uncatEntry}</option>}
                          {uncatEntry && <optgroup label="──────────────" />}
                          {rest.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </>);
                      })()}
                    </select>
                    <svg className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 pointer-events-none text-current opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ))
)}
```

- [ ] **Step 3: Verify manually**

```bash
npm run dev
```

Navigate to `/app/income` in List mode and `/app/expenses` in List mode. Confirm:
- Transactions are grouped under date headers (e.g., "seg., 15 jan" / "Mon, Jan 15").
- Category badge appears on the right side of the bottom row, below the amount.
- Badge style matches: `text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight`.
- Clicking the badge still opens the category dropdown.
- Compact mode (used in Dashboard) has no date headers (the `!compact &&` guard).

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/TransactionList.jsx
rtk git commit -m "feat: group transactions by date and move category badge below amount in list view"
```

---

## Task 4: Move category badge below value in ImportModal card

**Current `ImportTransactionCard` layout:**
```
[dot] [title]                 [+value]
[category-badge] [dupe] [AI]
```

**Desired layout:**
```
[dot] [title]                 [+value]
                              [category-badge]
      [dupe badge] [AI badge]
```

The category badge moves from the left of the second row to be right-aligned under the value. Duplicate and AI badges remain left-aligned in a third row (or share the second row left side).

**Files:**
- Modify: `src/components/ImportModal.jsx` — only the `ImportTransactionCard` inner function (lines 49–158)

- [ ] **Step 1: Restructure the category row in `ImportTransactionCard`**

Find the `{/* Category row */}` block (lines 124–155) and replace it with a two-part layout:

```jsx
{/* Second row: dupe/AI badges left, category badge right */}
<div className="mt-2 flex items-center justify-between gap-2">
  {/* Left: duplicate + AI badges */}
  <div className="flex items-center gap-1.5 flex-wrap">
    {trans.isDuplicate && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
        trans.isAiDuplicate
          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      }`}>
        {trans.isAiDuplicate && '🤖 '}
        {language === 'pt' ? 'DUPLICADA' : 'DUPLICATE'}
      </span>
    )}
    {trans._isGroup && (
      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
        {trans.installmentTotal}x
      </span>
    )}
    {trans.aiCategorized && (
      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded">
        🤖 AI
      </span>
    )}
  </div>

  {/* Right: category badge — below the value column */}
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight flex-shrink-0 ${
    isUncategorized
      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
      : trans.type === 'income'
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
  }`}>
    {trans.category || (language === 'pt' ? 'Sem categoria' : 'Uncategorized')}
  </span>
</div>
```

- [ ] **Step 2: Verify manually**

```bash
npm run dev
```

Navigate to the Import screen (the import button in the nav) and open an import. Confirm:
- Each import card shows the category badge right-aligned under the value.
- Duplicate and AI badges appear on the left of that same row.
- Cards with no dupe/AI badges still show category right-aligned (the left div is empty but the flex justify-between pushes category right).
- Uncategorized cards still highlight amber.
- Tapping the card still opens the swipe edit sheet.

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/ImportModal.jsx
rtk git commit -m "feat: move import card category badge below value, right-aligned"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Income chart shows expense categories → Task 1 ✓
  - Remove duplicate "Total no período" → Task 2 ✓
  - Category below value in income/expenses list → Task 3 ✓
  - Group by date in list view → Task 3 ✓
  - Import card category below value → Task 4 ✓
  - Import category badge size/style used in income/expenses → Task 3 (uses same `text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight`) ✓

- [x] **Placeholder scan:** No TBDs, no TODOs, all code blocks complete.

- [x] **Type consistency:**
  - `type` prop in SpendingChart defaults to `'expense'` — ExpensesChartsView doesn't need to pass it (backward compat) ✓
  - `dateGroups` computed in Task 3 uses `locale` which is already declared in TransactionList ✓
  - `UNCATEGORIZED_CATEGORY` is already imported in TransactionList (line 4) ✓
  - `categories` already destructured from `useSettings()` in TransactionList (line 37) ✓
