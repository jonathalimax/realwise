# Planner Orçamento Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Planner's "Alocação" tab to "Orçamento" and split its two stacked sections into inner tabs "Regra" and "Categorias".

**Architecture:** `AllocationTab.jsx` already has an `InnerTabs` component defined locally. We add `useState('regra')` for the inner tab, conditionally render the master plan sliders under "Regra" and the category grid under "Categorias". `PlannerPage.jsx` gets a display-name change; the URL param `?tab=alocacao` backward-compat alias already exists.

**Tech Stack:** React 19, Tailwind CSS v4, `useState` only — no new dependencies.

---

### Task 1: Rename "Alocação" → "Orçamento" in PlannerPage

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx`

- [ ] **Step 1: Open `PlannerPage.jsx` and update `PLANNER_TITLES`**

File: `src/pages/planner/PlannerPage.jsx`

Find:
```js
const PLANNER_TITLES = {
  ...
  allocation: 'Alocação',
```

Replace with:
```js
const PLANNER_TITLES = {
  ...
  allocation: 'Orçamento',
```

- [ ] **Step 2: Update the tab nav label**

In the same file, find the tab bar buttons. The label for `allocation` tab currently reads `'Alocação'`. Change it to `'Orçamento'`.

Locate the nav section (look for the tab buttons that set `?tab=`):
```jsx
// Before
{ value: 'alocacao', label: 'Alocação' }  // or similar
// After
{ value: 'alocacao', label: 'Orçamento' }
```

The URL param value stays `alocacao` — the backward-compat alias on line 41 (`tab === 'alocacao' ? 'allocation'`) already handles both old and new URLs.

- [ ] **Step 3: Update PageHelp text for the allocation tab**

In `PlannerPage.jsx` find `PLANNER_HELP` (or the `pageHelp` prop passed when `activeTab === 'allocation'`). Update the text to describe budget planning:

```js
allocation: 'Defina sua regra de distribuição (70/20/10) e os limites por categoria para controlar seu orçamento mensal.',
```

- [ ] **Step 4: Verify the app renders "Orçamento" in the tab bar**

```bash
npm run dev
```

Open `http://localhost:5173/app/planner?tab=alocacao` and confirm the tab label shows "Orçamento". Also open `?tab=orcamento` — it should 404 gracefully (falls through to default tab); that's acceptable since we're not adding a new alias.

- [ ] **Step 5: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: rename planner Alocação tab to Orçamento"
```

---

### Task 2: Add inner tabs to AllocationTab

**Files:**
- Modify: `src/pages/planner/AllocationTab.jsx`

- [ ] **Step 1: Add inner tab state and tab definitions**

In `AllocationTab.jsx`, after the existing state declarations (around line 59), add:

```jsx
const INNER_TABS = [
  { value: 'regra',      label: '⚖️ Regra' },
  { value: 'categorias', label: '📂 Categorias' },
];
const [innerTab, setInnerTab] = useState('regra');
```

`InnerTabs` component is already defined at the top of this file (lines 19–37) — reuse it directly.

- [ ] **Step 2: Wrap the "Plano Mestre" section under the "regra" inner tab**

In `AllocationTab.jsx`, the return statement currently has two main sections (after the `liquidezFinal <= 0` guard):

1. Master plan section — `{/* ── MASTER PLAN (70/20/10) ───── */}` at line 125
2. Category limits section — `{/* ── CATEGORY LIMITS ──────────── */}` at line 250

Replace the `return (...)` body with:

```jsx
return (
  <div className="space-y-6">
    <InnerTabs tabs={INNER_TABS} active={innerTab} onChange={setInnerTab} />

    {innerTab === 'regra' && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {/* Keep the buttons row (Copiar / Resetar) — remove the <h2>Plano Mestre</h2> heading */}
          <div className="flex items-center gap-2">
            {!isValid && <Badge variant="destructive">Soma: {allocationTotal}%</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Deseja copiar todos os limites e a regra do mês anterior para este mês?')) {
                  copyFromPreviousMonth();
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors shadow-sm"
            >
              📥 Copiar do mês anterior
            </button>
            <button
              onClick={() => {
                if (window.confirm('Tem certeza que deseja resetar a regra 70/20/10 e todos os limites de categorias deste mês para o padrão?')) {
                  resetMonthAllocation();
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"
            >
              🔄 Resetar
            </button>
          </div>
        </div>

        {/* 3-column slider cards — unchanged content from current "Plano Mestre" section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* ... same map over necessidades/poupanca/desejos ... */}
        </div>
      </div>
    )}

    {innerTab === 'categorias' && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {/* Remove the <h2>Limites por Categoria</h2> heading — keep the Livre/Excedido badge */}
          <div /> {/* spacer */}
          <div className="text-right">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
              remainingBudget >= 0
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {remainingBudget >= 0 ? `Livre: ${formatBRL.format(remainingBudget)}` : `Excedido: ${formatBRL.format(Math.abs(remainingBudget))}`}
            </span>
          </div>
        </div>

        {/* 2-column category grid — unchanged content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ... same allCategories.map(...) ... */}
        </div>
      </div>
    )}
  </div>
);
```

**Important:** Do NOT copy placeholder `{/* ... same ... */}` comments into the file. Copy the actual JSX from the existing sections (lines 125–248 for master plan, lines 250–344 for categories). Only remove the `<h2>` headings from each section.

- [ ] **Step 3: Verify the inner tabs work**

```bash
npm run dev
```

1. Navigate to `http://localhost:5173/app/planner?tab=alocacao`
2. The tab bar should show "⚖️ Regra" and "📂 Categorias"
3. Default is "Regra" — sliders visible, no `<h2>Plano Mestre</h2>`
4. Click "Categorias" — category grid visible, no `<h2>Limites por Categoria</h2>`, Livre/Excedido badge visible
5. Navigate away and back — inner tab resets to "Regra" (session-local state only)

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/AllocationTab.jsx
git commit -m "feat: split AllocationTab into Regra/Categorias inner tabs"
```
