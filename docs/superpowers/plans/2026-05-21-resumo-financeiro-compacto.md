# Resumo Financeiro Compacto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tall stacked card layout of `IncomeVsExpensesCard` with a compact KPI-bar design (Option C) that uses ~50% less vertical space on both web and mobile.

**Architecture:** Single component rewrite — no new files, no prop changes. Add a `formatCompact` helper inline in the component file. The layout changes from `space-y-4` stacked rows to three compact sections: a 3-column KPI bar, a progress bar row, and a 2-column secondary row. All existing business logic and conditional rendering rules are preserved unchanged.

**Tech Stack:** React 19, Tailwind CSS v4, Heroicons (existing imports)

---

### Task 1: Add `formatCompact` helper and rewrite the KPI bar

**Files:**
- Modify: `src/components/IncomeVsExpensesCard.jsx`

- [ ] **Step 1: Add `formatCompact` above the component**

Open `src/components/IncomeVsExpensesCard.jsx`. After the import statements (line 5), add:

```js
function formatCompact(value) {
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k';
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
```

- [ ] **Step 2: Replace the outer wrapper and card title**

Replace the existing `return (...)` block. Start with the outer card and title — keep identical to today:

```jsx
return (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
    <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
      <span>💰</span>
      {language === 'pt' ? 'Resumo Financeiro' : 'Financial Summary'}
    </h3>

    <div className="space-y-2">
      {/* sections go here */}
    </div>
  </div>
);
```

Note: `p-6 mb-6 text-lg` reduced to `p-4 mb-3 text-sm` for compactness.

- [ ] **Step 3: Add the KPI bar (3-column grid)**

Inside `<div className="space-y-2">`, add:

```jsx
{/* KPI Bar */}
<div className="grid grid-cols-3 gap-1.5">
  {/* Receitas */}
  <button
    onClick={onIncomeClick}
    title={formatCurrency(totalIncome)}
    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-left hover:opacity-80 transition-opacity cursor-pointer"
  >
    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
      {language === 'pt' ? 'Receitas' : 'Income'}
    </p>
    <p className="text-sm font-bold text-emerald-500 tabular-nums">
      {formatCompact(totalIncome)}
    </p>
  </button>

  {/* Despesas */}
  <button
    onClick={onExpensesClick}
    title={formatCurrency(totalExpenses)}
    className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-left hover:opacity-80 transition-opacity cursor-pointer"
  >
    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
      {language === 'pt' ? 'Despesas' : 'Expenses'}
    </p>
    <p className="text-sm font-bold text-rose-500 tabular-nums">
      {formatCompact(totalExpenses)}
    </p>
  </button>

  {/* Saldo */}
  <div
    title={formatCurrency(balance)}
    className={`rounded-xl p-2.5 border ${
      isPositive
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
        : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700'
    }`}
  >
    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
      {language === 'pt' ? 'Saldo' : 'Balance'}
    </p>
    <p className={`text-sm font-bold tabular-nums ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
      {isPositive ? '+' : ''}{formatCompact(balance)}
    </p>
  </div>
</div>
```

- [ ] **Step 4: Add the progress bar row**

After the KPI bar, still inside `<div className="space-y-2">`:

```jsx
{/* Progress bar */}
{totalIncome > 0 && (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2">
    <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
      <span>{language === 'pt' ? 'Despesas / Receita' : 'Expenses / Income'}</span>
      <span>{expensesRatio.toFixed(0)}%</span>
    </div>
    <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
      <div
        className="h-full bg-rose-500 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(expensesRatio, 100)}%` }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 5: Add the secondary row (Saldo anterior + Patrimônio)**

After the progress bar:

```jsx
{/* Secondary row */}
{(carryoverSaldo !== 0 || hasInvestments) && (
  <div className="grid grid-cols-2 gap-1.5">
    {carryoverSaldo !== 0 && (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-3 py-2">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
          {language === 'pt' ? 'Saldo anterior' : 'Previous balance'}
        </p>
        <p
          title={formatCurrency(carryoverSaldo)}
          className={`text-sm font-bold tabular-nums ${carryoverSaldo >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}
        >
          {carryoverSaldo >= 0 ? '+' : ''}{formatCompact(carryoverSaldo)}
        </p>
      </div>
    )}
    {hasInvestments && (
      <button
        onClick={onInvestmentsClick}
        title={formatCurrency(portfolioValue)}
        className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 text-left hover:opacity-80 transition-opacity cursor-pointer"
      >
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">
          {language === 'pt' ? 'Patrimônio' : 'Net Worth'}
        </p>
        <p className="text-sm font-bold text-blue-500 tabular-nums">
          {formatCompact(portfolioValue)}
        </p>
      </button>
    )}
  </div>
)}
```

- [ ] **Step 6: Add the tip message**

After the secondary row, close `space-y-2` and the outer card:

```jsx
{/* Tip */}
{totalIncome > 0 && totalExpenses > 0 && (
  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg py-1.5 px-3 text-[10px] text-gray-600 dark:text-gray-400 text-center">
    {isPositive
      ? (language === 'pt' ? '🎉 Excelente! Você está gastando menos do que ganha.' : '🎉 Great! You are spending less than you earn.')
      : (language === 'pt' ? '⚠️ Atenção! Suas despesas superam sua receita.' : '⚠️ Warning! Your expenses exceed your income.')
    }
  </div>
)}
```

- [ ] **Step 7: Remove unused Heroicons imports**

The old layout used `ArrowTrendingUpIcon` and `ArrowTrendingDownIcon`. After the rewrite, check if they are still referenced. If not, remove line 4:

```js
// DELETE this line if no longer used:
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
```

- [ ] **Step 8: Verify in dev server**

```bash
npm run dev
```

Open `http://localhost:5173/app/dashboard`. Verify:
- Card is visibly shorter than before
- Receitas and Despesas values are abbreviated (e.g. `37,5k`)
- Clicking Receitas, Despesas, Patrimônio opens respective panels
- Hovering a KPI shows full value in browser tooltip
- Saldo border is green when positive, red when negative
- Progress bar still appears
- Tip message still appears

- [ ] **Step 9: Commit**

```bash
git add src/components/IncomeVsExpensesCard.jsx
git commit -m "feat: compact Resumo Financeiro with KPI bar layout and Patrimônio rename"
```
