# Despesas — Show All Categories with Budget Awareness

**Date:** 2026-05-21
**Status:** Approved

## Problem

`ExpensesByCategoryCard` (Dashboard) and `SpendingChart` (Despesas → Gráficos) only render categories that have spending in the selected month. Users cannot see how much budget they have left in categories they haven't spent in yet, making it hard to make spending decisions at a glance.

## Goal

Show every expense category the user has enabled — whether or not they've spent in it — alongside how much they've spent, what percentage of their budget that is, and how much they have left. Delete the unused `ExpensesPieChart.jsx`.

## Approved Design

### Row states (both components share this logic)

| State | Bar | Right-side label |
|---|---|---|
| Has spending + limit, under budget | Colored fill at spend% | Amount + green pill `↓ R$ X livres` |
| Has spending + limit, over budget | Full red bar | Amount + red pill `↑ R$ X acima` |
| No spending + has limit | Empty bar | `R$ 0` + green pill `R$ X disponíveis` (right-aligned) |
| No spending + no limit | No bar | `R$ 0` dimmed (opacity-40), no pill |

The pill chip replaces the current small `pct% de R$ limit` / `pct% / limit` text in both components.

### Sort order

1. Categories with spending — descending by amount
2. Categories with no spending but a limit set — alphabetical
3. Categories with no spending and no limit — alphabetical, dimmed

### Category source

Pull the full enabled expense category list from `useSettings().categories.expense`. Merge with actual spending data. Categories present in spending but absent from the settings list (e.g. custom imported categories) are still included.

### Budget limit resolution

Unchanged — same `resolveLimit` logic already in both files:
- Planner `categoryBudgetsPct` × `liquidezFinal` takes precedence
- Falls back to `templateBudget.categoryBudgets[category]`
- If neither exists, `limit = 0` → no-limit state

### SpendingChart donut

Zero-spend categories have no slice in the donut (a zero-value slice would be invisible anyway). They appear only in the legend below. The thin outer budget-limit arc per slice is **deferred** — the legend pill chips already communicate remaining budget clearly enough; the outer ring adds SVG complexity for little gain on this pass.

### Expand/collapse (ExpensesByCategoryCard)

The existing "Ver mais / Show more" button with `MAX_VISIBLE = 7` is kept. The initial visible rows should prioritise spending categories first, so the expand gate sits after the last spending row if there are more than 7 total spending categories, otherwise it gates the zero-spend rows.

## Files Changed

| File | Change |
|---|---|
| `src/components/ExpensesByCategoryCard.jsx` | Pull all categories, add pill chips, dim zero-no-limit rows |
| `src/components/charts/SpendingChart.jsx` | Same category merge, pill chips in legend grid |
| `src/components/charts/ExpensesPieChart.jsx` | **Delete** (dead code, never imported) |

## Files NOT Changed

- `BudgetContext.jsx` — no change needed
- `SettingsContext.jsx` — consumed as-is via `useSettings().categories`
- `usePlannerState.js` — consumed as-is
- `ExpensesChartsView.jsx` — passes through to SpendingChart, no change needed
