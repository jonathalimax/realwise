# Resumo Financeiro — Layout Compacto

**Date:** 2026-05-21  
**Status:** Approved  
**File:** `src/components/IncomeVsExpensesCard.jsx`

## Problem

The `IncomeVsExpensesCard` is too tall on both web and mobile, consuming excessive dashboard space. Each row uses large padding and oversized font sizes that don't justify the information density.

## Solution: Option C — KPI Bar Layout

Replace the tall stacked rows with three compact sections that maintain all existing data and interactivity.

## Layout Structure

### 1. KPI Bar (3-column grid)
Three equal-width cells in a row:

| Cell | Label | Value | Color | Clickable |
|------|-------|-------|-------|-----------|
| Receitas | "Receitas" | `formatCompact(totalIncome)` | `text-emerald-500` | `onIncomeClick` |
| Despesas | "Despesas" | `formatCompact(totalExpenses)` | `text-rose-500` | `onExpensesClick` |
| Saldo | "Saldo" | `formatCompact(balance)` with `+` prefix if positive | `text-emerald-500` or `text-rose-500` | — |

Saldo cell has a colored border: `border-emerald-700` (positive) or `border-rose-700` (negative), dark background.

### 2. Progress Bar
Full-width row showing `Despesas / Receita` label on left, percentage on right, thin `h-1.5` bar below. Only rendered when `totalIncome > 0`.

### 3. Secondary Row (2-column grid)
Only rendered when at least one child is present:

- **Left — Saldo anterior:** label + `formatCompact(carryoverSaldo)` in indigo. Only rendered when `carryoverSaldo !== 0`.
- **Right — Patrimônio:** label + `formatCompact(portfolioValue)` in blue, clickable via `onInvestmentsClick`. Only rendered when `hasInvestments`.

If both are absent, the secondary row does not render at all.

### 4. Tip message
Kept as-is but with reduced padding (`py-1.5 px-3`). Only rendered when `totalIncome > 0 && totalExpenses > 0`.

## `formatCompact` utility

New pure function to add alongside the component or in a shared utils file:

```js
// Abbreviates values ≥ 1000. Always uses the active locale's decimal separator.
// Examples (pt-BR): 37580.63 → "37,5k" | 4425 → "4,4k" | 850 → "850"
function formatCompact(value) {
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
```

The full `formatCurrency(value)` string is added as a `title` attribute on each KPI value element for accessibility/hover tooltip.

## Interactivity

- Receitas KPI cell → `onIncomeClick`
- Despesas KPI cell → `onExpensesClick`
- Patrimônio cell → `onInvestmentsClick`
- All three get `cursor-pointer hover:opacity-80 transition-opacity`

## Rename: Portfólio → Patrimônio

The label string changes from `'Portfólio'` / `'Portfolio'` to `'Patrimônio'` / `'Net Worth'` in both `pt` and `en` language branches within this component.

## What does NOT change

- Component props interface — no changes to `{ transactions, onInvestmentsClick, onIncomeClick, onExpensesClick, carryoverSaldo }`
- Business logic — all `useMemo` calculations, `getTotalCurrentValue`, `getTotalGrowth` remain identical
- Conditional rendering rules — `carryoverSaldo !== 0`, `hasInvestments`, `totalIncome > 0` conditions are preserved
- Dark mode support — all existing `dark:` variants are maintained

## Files to change

| File | Change |
|------|--------|
| `src/components/IncomeVsExpensesCard.jsx` | Full layout rewrite + `formatCompact` + rename |
