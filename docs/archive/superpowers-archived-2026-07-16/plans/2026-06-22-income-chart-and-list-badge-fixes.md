# Income Chart + List Badge Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify income category chart rows to show icon/name/value/% of total only; fix category badge width in the list; and move the installment counter to the bottom-left next to the bank icon.

**Architecture:** Two file changes. `SpendingChart` gains a conditional render path for `type === 'income'` that bypasses all budget/limit logic. `TransactionList` gets two small layout adjustments: the installment counter moves from the right column to the bottom-left metadata row, and the category badge wrapper gets a max-width cap so it never stretches wider than its content needs.

**Tech Stack:** React 19, Tailwind CSS v4.

## Global Constraints

- Tailwind CSS v4 — `dark:` prefix for dark mode.
- `language === 'pt'` for Portuguese strings, `'en'` for English — all copy needs both.
- No new npm packages.
- Dev server: `npm run dev` → `http://localhost:5173`.

---

## File Map

| File | Change |
|---|---|
| `src/components/charts/SpendingChart.jsx` | Add income-specific render path for category rows (no budget bars, shows % of total) |
| `src/components/TransactionList.jsx` | Move installment badge to bottom-left; cap category badge width |

---

## Task 1: Simplify income category rows in SpendingChart

**Context:** `SpendingChart` renders a 2-column grid of category cards. Each card currently shows: icon · name · value · budget progress bar · "X% de limite" text · "↓ livres / ↑ acima" pill. All of that budget machinery only makes sense for expenses. For `type === 'income'`, the card should show only: icon · name · value · "XX% do total" in small muted text below the name.

**Files:**
- Modify: `src/components/charts/SpendingChart.jsx` (the `legendData.map` block, roughly lines 190–270)

**Interfaces:**
- Consumes: existing `type` prop (added in the previous plan — defaults to `'expense'`), `total` (already computed: sum of all category values), `language` (added to `useSettings()` destructure in previous plan).
- Produces: no interface change — the `type` prop already exists.

- [ ] **Step 1: Replace the category card render with a type-conditional version**

Find the `legendData.map` block inside `{/* Category Breakdown - 2-column grid below chart */}` and replace the inner `return (...)` with a conditional:

```jsx
{legendData.map((item) => {
  const isDimmed = !item.hasSpending && !item.hasLimit;
  const color = COLORS[legendData.indexOf(item) % COLORS.length];

  if (type === 'income') {
    // Income: icon + name + value + % of total. No budget bars.
    return (
      <button
        key={item.label}
        onClick={() => goToCategory(item.label)}
        className={`w-full group text-left ${!item.hasSpending ? 'opacity-40' : ''}`}
      >
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/70 transition-all duration-200">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
              border: `1px solid ${color.main}30`,
            }}
          >
            {getIcon(item.label)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                {item.label}
              </span>
              <span className="font-bold text-gray-900 dark:text-white text-sm tabular-nums ml-2 shrink-0">
                {formatCurrency(item.value)}
              </span>
            </div>
            {item.hasSpending && total > 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {((item.value / total) * 100).toFixed(0)}% {language === 'pt' ? 'do total' : 'of total'}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  // Expense: full budget/limit rendering (unchanged)
  const hasLimit = item.hasLimit;
  const hasSpending = item.hasSpending;
  const pct = hasLimit
    ? (item.value / item.limit) * 100
    : (total > 0 ? (item.value / total) * 100 : 0);
  const isOver = hasLimit && pct > 100;
  const barWidth = Math.min(pct, 100);
  const remaining = item.limit - item.value;

  return (
    <button
      key={item.label}
      onClick={() => goToCategory(item.label)}
      className={`w-full group text-left ${isDimmed ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/70 transition-all duration-200">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
            border: `1px solid ${color.main}30`,
          }}
        >
          {getIcon(item.label)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
              {item.label}
            </span>
            <span className="font-bold text-gray-900 dark:text-white text-sm tabular-nums ml-2 shrink-0">
              {formatCurrency(item.value)}
            </span>
          </div>
          {(hasSpending || hasLimit) && (
            <>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-600/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: isOver ? '#EF4444' : color.main,
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-1">
                {hasLimit ? (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                    {pct.toFixed(0)}% de {formatCurrency(item.limit)}
                  </span>
                ) : <span />}
                {hasLimit && hasSpending && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                    isOver
                      ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                  }`}>
                    {isOver
                      ? `↑ ${formatCurrency(Math.abs(remaining))} acima`
                      : `↓ ${formatCurrency(remaining)} livres`}
                  </span>
                )}
                {hasLimit && !hasSpending && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
                    {formatCurrency(item.limit)} disponíveis
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  );
})}
```

Note: the `legendData` computation above the map block is unchanged — it still builds `hasSpending`, `hasLimit`, `value`, `limit`, `label`. For income these values just won't be used (since we branch early).

- [ ] **Step 2: Verify in dev — income chart**

```bash
npm run dev
```

Navigate to `http://localhost:5173/app/income`, switch to Charts. Confirm:
- Each category row shows: emoji icon · category name · currency value · "XX% do total" (e.g. "85% do total")
- No progress bar visible anywhere.
- No "↓ livres" / "↑ acima" / budget pills.
- Categories with zero income are dimmed (opacity-40).
- Clicking a category row still filters to list view for that category.

Navigate to `http://localhost:5173/app/expenses`, Charts view. Confirm:
- Expense chart is completely unchanged — progress bars, limit text, remaining pills all present.

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/charts/SpendingChart.jsx
rtk git commit -m "feat: income chart shows % of total only — no budget bars or limit UI"
```

---

## Task 2: Fix category badge width + move installment badge to bottom-left in TransactionList

**Context:** After the previous plan's execution, `TransactionList` renders a bottom row with bank icon (left) and category badge (right). Two issues remain:

1. The category badge's `inline-grid` wrapper has no max-width — on short category names it's fine, but the select element has a browser-default minimum width that can make it appear wider than needed on narrow screens.
2. The installment counter (`1 de 3`) currently lives below the amount in the right column. It should move to the left side of the bottom row, sitting next to the bank icon.

**Target bottom-row layout:**
```
[🏦] [1 de 3]                    [CATEGORIA]
```

**Files:**
- Modify: `src/components/TransactionList.jsx`

**Interfaces:**
- No prop changes.

- [ ] **Step 1: Remove the installment counter from the right column**

Find the right-column `div` (inside the top row of each transaction item) that renders the amount and installment:

```jsx
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
```

Replace it with (removing the installment block):

```jsx
<div className="text-right flex-shrink-0">
  <p className={`font-bold text-sm ${transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
  </p>
</div>
```

- [ ] **Step 2: Add installment badge to bottom-left row + cap category badge width**

Find the bottom row (the `{/* Bottom row: bank icon (left) + category badge (right) */}` div). Replace it with:

```jsx
{/* Bottom row: bank + installment (left) · category badge (right) */}
<div className="flex items-center justify-between mt-1 gap-2">
  {/* Left: bank icon + installment counter */}
  <div className="flex items-center gap-1.5">
    {transaction.bankId && (
      <span className="text-xs" title={userBank ? getBankDisplayName(userBank) : (bankInfo?.name || '')}>
        {bankInfo?.icon || '🏦'}
      </span>
    )}
    {transaction.isInstallment && (
      <span className="text-[10px] font-bold text-violet-500 dark:text-violet-400 tabular-nums">
        {transaction.installmentCurrent}/{transaction.installmentTotal}
      </span>
    )}
  </div>

  {/* Right: category badge — max-w caps it so it never stretches on short names */}
  <div
    className="relative inline-grid text-[10px] font-bold rounded-full max-w-[8rem]"
    onClick={e => e.stopPropagation()}
  >
    <span
      className={`invisible pl-2 pr-5 py-0.5 whitespace-nowrap pointer-events-none uppercase tracking-tight rounded-full truncate ${
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
```

Key changes vs the previous version:
- Installment renders as `1/3` (slash notation, more compact than `1 de 3`) next to the bank icon on the left.
- The category badge wrapper `div` gains `max-w-[8rem]` — the browser's select minimum width is overridden by the grid container being capped.
- Mirror `<span>` gains `truncate` so long category names clip within the cap rather than overflow.

- [ ] **Step 3: Verify in dev — list view**

```bash
npm run dev
```

Navigate to `/app/expenses` in List mode. Confirm:
- Installment transactions show `1/3` (or whatever fraction) in small violet text next to the bank icon on the bottom-left.
- Non-installment transactions show just the bank icon (or nothing if no bank).
- Category badge stays right-aligned and is no wider than its text content (test with a short category like "PIX" and a long one like "Assinaturas").
- Clicking the category badge still opens the dropdown.

Navigate to `/app/income` in List mode. Confirm the same badge and installment behavior.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/TransactionList.jsx
rtk git commit -m "fix: move installment badge to bottom-left; cap category badge width in list view"
```

---

## Self-Review

**1. Spec coverage:**
- Income chart: icon + name + value + % of total only → Task 1 ✓
- No goal/limit progress bars in income → Task 1 (early return for `type === 'income'`) ✓
- Category badge auto-width, right-aligned → Task 2 (`max-w-[8rem]` + `truncate`) ✓
- Installment badge moves to bottom-left next to bank icon → Task 2 ✓

**2. Placeholder scan:** None found.

**3. Type consistency:**
- `type` prop on SpendingChart: was added in previous plan, defaulting to `'expense'` — expense path in Task 1 is unchanged ✓
- `transaction.isInstallment`, `transaction.installmentCurrent`, `transaction.installmentTotal` — same field names as the previous plan used in the right column ✓
- `UNCATEGORIZED_CATEGORY`, `categories`, `language` — all already imported/destructured in `TransactionList` from the previous plan ✓
