# Despesas — All Categories Budget Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every enabled expense category in the Despesas card and Gráficos chart — including zero-spend ones — with pill chips showing how much budget remains or was exceeded.

**Architecture:** Both `ExpensesByCategoryCard` and `SpendingChart` share the same pattern: pull all enabled categories from `useSettings().categories.expense`, merge with actual spending, resolve budget limits from the planner/template, and sort by spend desc → unspent-with-limit → unspent-no-limit. The legend and row chips replace the current small `pct% de limit` text. The pie/donut data array stays spending-only (zero slices are invisible); the legend below shows all categories.

**Tech Stack:** React 19, Tailwind CSS v4, `useSettings` (categories), `useBudget` (templateBudget), `usePlannerState` (categoryBudgetsPct)

---

### Task 1: Delete dead code — ExpensesPieChart.jsx

**Files:**
- Delete: `src/components/charts/ExpensesPieChart.jsx`

- [ ] **Step 1: Confirm nothing imports it**

```bash
grep -r "ExpensesPieChart" src/
```

Expected output: only the file definition itself (no imports from other files).

- [ ] **Step 2: Delete the file**

```bash
rm src/components/charts/ExpensesPieChart.jsx
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: delete unused ExpensesPieChart component"
```

---

### Task 2: Update ExpensesByCategoryCard — show all categories with pill chips

**Files:**
- Modify: `src/components/ExpensesByCategoryCard.jsx`

#### Context

The current `rows` useMemo (line 68) only iterates over categories that appear in `transactions`. We need to merge in the full list from `useSettings().categories.expense`.

The current row render (lines 128–154) shows `pct% de R$ limit` as small text. We replace this with:
- A bar (only when `amount > 0` or `hasLimit`)
- A pill chip below the bar showing remaining / over / available

#### New `rows` logic

Three groups, sorted as:
1. Categories with `amount > 0` — descending by amount
2. Categories with `amount === 0` and `hasLimit` — alphabetical
3. Categories with `amount === 0` and `!hasLimit` — alphabetical, rendered dimmed

- [ ] **Step 1: Add `categories` to the `useSettings()` destructure (line 44)**

Replace:
```jsx
const { language, formatCurrency } = useSettings();
```
With:
```jsx
const { language, formatCurrency, categories } = useSettings();
```

- [ ] **Step 2: Replace the `rows` useMemo (lines 68–93) with the new all-categories version**

Replace the entire `const { rows, total } = useMemo(...)` block with:

```jsx
const { rows, total } = useMemo(() => {
  const spending = {};
  transactions
    .filter(tx => tx.type === 'expense' && !tx.ignored)
    .forEach(tx => {
      spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
    });

  const total = Object.values(spending).reduce((s, v) => s + v, 0);

  // Union of enabled categories and any categories found in actual spending
  const allCats = Array.from(new Set([
    ...(categories?.expense ?? []),
    ...Object.keys(spending),
  ]));

  const rows = allCats.map(cat => {
    const amount = spending[cat] ?? 0;
    const pctValue = categoryPct[cat] ?? 0;
    const pctLimit = pctValue > 0 ? liquidezFinal * (pctValue / 100) : 0;
    const templateLimit = categoryBudgets[cat] ?? 0;
    const limit = pctLimit > 0 ? pctLimit : templateLimit;
    const hasLimit = limit > 0;
    const hasSpending = amount > 0;
    const pct = hasLimit
      ? (amount / limit) * 100
      : (total > 0 ? (amount / total) * 100 : 0);
    return {
      category: cat,
      amount,
      pct,
      hasLimit,
      hasSpending,
      limit,
      icon: CATEGORY_ICONS[cat] || '💰',
    };
  });

  // Sort: spending desc → unspent with limit → unspent no limit
  rows.sort((a, b) => {
    if (a.hasSpending !== b.hasSpending) return b.hasSpending ? 1 : -1;
    if (a.amount !== b.amount) return b.amount - a.amount;
    if (a.hasLimit !== b.hasLimit) return b.hasLimit ? 1 : -1;
    return a.category.localeCompare(b.category);
  });

  return { rows, total };
}, [transactions, categories, categoryPct, categoryBudgets, liquidezFinal]);
```

- [ ] **Step 3: Remove the early-return guard that hides the card when rows is empty (line 95)**

The old guard was `if (rows.length === 0) return null;`. Replace it with a guard that only hides when there are truly no categories configured at all:

```jsx
if (rows.length === 0) return null;
```

This line stays — it just now only triggers when `categories.expense` is empty, which is a valid edge case.

- [ ] **Step 4: Replace the row render inside the `.map()` (lines 118–154) with the new pill-chip version**

Replace the entire `<button key={row.category} ...>` block with:

```jsx
{visibleRows.map((row) => {
  const color = COLORS[rows.indexOf(row) % COLORS.length];
  const barWidth = Math.min(row.pct, 100);
  const isOver = row.hasLimit && row.pct > 100;
  const isDimmed = !row.hasSpending && !row.hasLimit;
  const remaining = row.limit - row.amount;

  return (
    <button
      key={row.category}
      onClick={() => handleCategoryClick(row.category)}
      className={`w-full text-left rounded-xl p-2 -m-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-[0.99] transition-all group ${isDimmed ? 'opacity-40' : ''}`}
    >
      <div className="flex justify-between mb-1.5 items-center">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex items-center gap-1.5">
          <span className="text-base leading-none">{row.icon}</span>
          {row.category}
        </span>
        <span className="text-xs font-bold text-gray-900 dark:text-white tabular-nums ml-2 shrink-0">
          {formatCurrency(row.amount)}
        </span>
      </div>

      {(row.hasSpending || row.hasLimit) && (
        <>
          <div className="h-2 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${barWidth}%`,
                backgroundColor: isOver ? '#EF4444' : color,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            {row.hasLimit && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                {row.pct.toFixed(0)}% de {formatCurrency(row.limit)}
              </span>
            )}
            {!row.hasLimit && <span />}
            {row.hasLimit && row.hasSpending && (
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
            {row.hasLimit && !row.hasSpending && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
                {formatCurrency(row.limit)} disponíveis
              </span>
            )}
          </div>
        </>
      )}
    </button>
  );
})}
```

- [ ] **Step 5: Verify the app renders correctly**

```bash
npm run dev
```

Open `http://localhost:5173/app/dashboard` (or your local client path). The Gastos card should now show all categories. Verify:
- Categories with spending show the colored bar + pill chip
- Over-budget categories show red bar + red pill
- Categories with a limit but no spending show empty bar + green "disponíveis" pill
- Categories with no limit and no spending appear dimmed with just "R$ 0"

- [ ] **Step 6: Commit**

```bash
git add src/components/ExpensesByCategoryCard.jsx
git commit -m "feat: show all categories in dashboard Gastos card with budget pill chips"
```

---

### Task 3: Update SpendingChart — all categories in legend with pill chips

**Files:**
- Modify: `src/components/charts/SpendingChart.jsx`

#### Context

`SpendingChart` renders the donut chart + 2-column legend grid in the Despesas → Gráficos tab. The donut's `PieChart` series must only receive categories with `value > 0` (MUI ignores zero-value slices but may produce layout artifacts). The legend grid shows all categories.

We split `categoryTotals` into:
- `pieData` — spending categories only (for the donut)
- `legendData` — all categories (for the grid below)

- [ ] **Step 1: Add `categories` to the `useSettings()` destructure (line 44)**

Replace:
```jsx
const { formatCurrency, t } = useSettings();
```
With:
```jsx
const { formatCurrency, t, categories } = useSettings();
```

- [ ] **Step 2: Replace the `categoryTotals` + `data` block (lines 84–99) with split pieData/legendData**

Replace from `const categoryTotals = ...` through `const total = ...` with:

```jsx
const categoryTotals = transactions
  .filter(t => t.type === 'expense' && !t.ignored)
  .reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

const total = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

// All categories: union of enabled list + any from actual spending
const allCats = Array.from(new Set([
  ...(categories?.expense ?? []),
  ...Object.keys(categoryTotals),
]));

// Full legend data — all categories, sorted: spending desc → unspent with limit → unspent no limit
const legendData = allCats
  .map((name, index) => {
    const value = categoryTotals[name] ?? 0;
    const limit = resolveLimit(name);
    return {
      id: index,
      value,
      label: name,
      color: COLORS[index % COLORS.length].main,
      limit,
      hasSpending: value > 0,
      hasLimit: limit > 0,
    };
  })
  .sort((a, b) => {
    if (a.hasSpending !== b.hasSpending) return b.hasSpending ? 1 : -1;
    if (a.value !== b.value) return b.value - a.value;
    if (a.hasLimit !== b.hasLimit) return b.hasLimit ? 1 : -1;
    return a.label.localeCompare(b.label);
  });

// Pie chart only gets categories with actual spending (zero slices cause MUI artifacts)
const pieData = legendData.filter(d => d.value > 0);
```

- [ ] **Step 3: Update the empty state guard (line 103) to check `pieData` instead of `data`**

Replace:
```jsx
if (data.length === 0) {
```
With:
```jsx
if (pieData.length === 0 && legendData.length === 0) {
```

- [ ] **Step 4: Update the `<PieChart>` to use `pieData` instead of `data` (line 131)**

Replace:
```jsx
series={[{
  data,
```
With:
```jsx
series={[{
  data: pieData,
```

- [ ] **Step 5: Update `handleItemClick` to index into `pieData` instead of `data` (line 120)**

Replace:
```jsx
const clickedItem = data[itemIdentifier.dataIndex];
```
With:
```jsx
const clickedItem = pieData[itemIdentifier.dataIndex];
```

- [ ] **Step 6: Replace the legend grid render (lines 157–212) with the new all-categories pill-chip version**

Replace the entire `{/* Category Breakdown */}` section with:

```jsx
{/* Category Breakdown - 2-column grid below chart */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  {legendData.map((item) => {
    const hasLimit = item.hasLimit;
    const hasSpending = item.hasSpending;
    const pct = hasLimit
      ? (item.value / item.limit) * 100
      : (total > 0 ? (item.value / total) * 100 : 0);
    const isOver = hasLimit && pct > 100;
    const barWidth = Math.min(pct, 100);
    const remaining = item.limit - item.value;
    const isDimmed = !hasSpending && !hasLimit;
    const color = COLORS[legendData.indexOf(item) % COLORS.length];

    return (
      <button
        key={item.label}
        onClick={() => goToCategory(item.label)}
        className={`w-full group text-left ${isDimmed ? 'opacity-40' : ''}`}
      >
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-700/70 transition-all duration-200">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${color.light}20, ${color.main}30)`,
              border: `1px solid ${color.main}30`,
            }}
          >
            {getIcon(item.label)}
          </div>

          {/* Category Info */}
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
</div>
```

- [ ] **Step 7: Verify in the browser**

```bash
npm run dev
```

Navigate to Despesas → toggle to "Gráficos". Verify:
- Donut still shows only spending categories (no empty slices)
- Legend grid shows ALL categories
- Under-budget: colored bar + green pill `↓ R$ X livres`
- Over-budget: red bar + red pill `↑ R$ X acima`
- No-spending with limit: empty bar + green `R$ X disponíveis`
- No-spending no limit: dimmed row, amount only, no bar

- [ ] **Step 8: Commit**

```bash
git add src/components/charts/SpendingChart.jsx
git commit -m "feat: show all categories in SpendingChart legend with budget pill chips"
```
