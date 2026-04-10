# Planner Mobile Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the planner usable on mobile by adding a compact header, a fixed bottom tab bar, and fixing cramped category rows — all without touching the desktop layout.

**Architecture:** Two files change. `PlannerPage.jsx` gains controlled tab state (lifted from Radix internals to `useState`) so both the desktop top bar and the new mobile bottom bar can drive the same active tab. `AllocationTab.jsx` gets the Limite category row restructured from one overflowing flex row into two clean sub-rows. All mobile additions are gated behind `sm:hidden`; desktop is untouched.

**Tech Stack:** React 19, Tailwind CSS v4, Radix UI Tabs (`@/components/ui/tabs`)

---

## Files

| File | What changes |
|------|-------------|
| `src/pages/planner/PlannerPage.jsx` | Controlled tab state · compact mobile header · gear settings sheet · fixed bottom nav |
| `src/pages/planner/AllocationTab.jsx` | Category row Row 2 split into 2 sub-rows to prevent overflow |

---

## Task 1 — Lift Tab State & Add Icons to TABS

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx:1-61`

- [ ] **Step 1: Add `useState` import and `icon` field to TABS**

Replace the top of `PlannerPage.jsx` (lines 1-61):

```jsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shimmer } from '@/components/ui/shimmer';
import usePlannerState from './usePlannerState';
import SistemaTab from './SistemaTab';
import CarteiraTab from './carteira';
import DashboardTab from './DashboardTab';
import AllocationTab from './AllocationTab';
```

Replace the TABS constant:

```jsx
const TABS = [
  { value: 'sistema',    label: 'Sistema',   icon: '🧭' },
  { value: 'carteira',   label: 'Carteira',  icon: '💼' },
  { value: 'dashboard',  label: 'Dashboard', icon: '📊' },
  { value: 'allocation', label: 'Alocação',  icon: '📐' },
];
```

- [ ] **Step 2: Add `activeTab` state inside `PlannerPage` and wire `<Tabs>` as controlled**

Inside `PlannerPage()`, directly after the `usePlannerState()` destructure, add:

```jsx
const [activeTab, setActiveTab] = useState('sistema');
```

Then change the `<Tabs>` element (currently line 131) from:

```jsx
<Tabs defaultValue="sistema">
```

to:

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
```

- [ ] **Step 3: Build to verify no regressions**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "refactor: lift planner tab state to useState, add icons to TABS"
```

---

## Task 2 — Compact Mobile Header + Gear Settings Sheet

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx:78-128`

- [ ] **Step 1: Add `showSettings` state inside `PlannerPage`**

Directly after `const [activeTab, setActiveTab] = useState('sistema');` add:

```jsx
const [showSettings, setShowSettings] = useState(false);
```

- [ ] **Step 2: Replace the page header block**

Replace the current header `<div>` (lines 102–128, the block starting with `{/* Page header */}`) with the following, which renders a compact single-row header on mobile and the original multi-row header on desktop:

```jsx
{/* ── Mobile header (hidden on sm+) ────────────────────────── */}
<div className="flex items-center gap-2 sm:hidden">
  <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-white truncate">
    Planejador
  </h1>
  <MonthNav
    value={state.selectedPlannerMonth}
    onChange={m => update('selectedPlannerMonth', m)}
  />
  <button
    onClick={() => setShowSettings(true)}
    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-base"
    aria-label="Configurações do plano"
  >
    ⚙️
  </button>
</div>

{/* ── Desktop header (hidden on mobile) ──────────────────────── */}
<div className="hidden sm:flex flex-col sm:flex-row sm:items-end gap-3">
  <div className="flex-1">
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planejador Financeiro</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
      Planejamento pessoal PJ — modele sua renda, investimentos e metas de médio prazo.
    </p>
  </div>
  <div className="flex flex-col gap-0.5">
    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Início do plano</label>
    <input
      type="month"
      value={state.plannerStartDate}
      onChange={e => update('plannerStartDate', e.target.value)}
      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
    />
  </div>
  <div className="flex flex-col gap-0.5">
    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Mês selecionado</label>
    <div className="flex items-center h-[34px]">
      <MonthNav
        value={state.selectedPlannerMonth}
        onChange={m => update('selectedPlannerMonth', m)}
      />
    </div>
  </div>
</div>

{/* ── Settings bottom sheet (mobile only) ────────────────────── */}
{showSettings && (
  <div
    className="fixed inset-0 z-50 flex items-end sm:hidden"
    onClick={() => setShowSettings(false)}
  >
    <div
      className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-6 shadow-2xl border-t border-gray-200 dark:border-gray-700"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Configurações</h2>
        <button
          onClick={() => setShowSettings(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
        >
          ×
        </button>
      </div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        Início do plano
      </label>
      <input
        type="month"
        value={state.plannerStartDate}
        onChange={e => update('plannerStartDate', e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: add compact mobile header with gear settings sheet"
```

---

## Task 3 — Fixed Bottom Nav Bar (Mobile)

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx:99-201`

- [ ] **Step 1: Add `pb-20 sm:pb-0` to the content area and the bottom nav**

The outer wrapper div (line 100) currently reads:
```jsx
<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
```

Change it to (adds bottom padding on mobile so content doesn't hide behind the fixed nav):
```jsx
<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 pb-24 sm:pb-6">
```

- [ ] **Step 2: Add the fixed bottom nav just before the closing `</div>` of the outer wrapper**

The file currently ends with (lines 198–202):
```jsx
        </Tabs>
      </div>
    </div>
  );
}
```

Change to:
```jsx
        </Tabs>
      </div>

      {/* ── Mobile bottom nav (hidden on sm+) ──────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex safe-area-inset-bottom">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              activeTab === tab.value
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Also hide the desktop tab list on mobile**

The `<TabsList>` wrapper currently reads (around line 132):
```jsx
<div className="overflow-x-auto pb-2">
  <TabsList className="w-max">
```

Change to:
```jsx
<div className="hidden sm:block overflow-x-auto pb-2">
  <TabsList className="w-max">
```

- [ ] **Step 4: Build to verify**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: add fixed bottom nav bar for mobile planner"
```

---

## Task 4 — Fix Limite Category Rows (2-sub-row layout)

**Files:**
- Modify: `src/pages/planner/AllocationTab.jsx:292-341`

The current Row 2 is a single `flex` line that overflows on narrow screens. Split it into two sub-rows.

- [ ] **Step 1: Replace the Row 2 block inside the category map**

Find the `{/* Row 2: % input + R$ limit + spent + progress */}` block (lines 312–340) and replace with:

```jsx
{/* Row 2a: % input + computed R$ */}
<div className="flex items-center gap-2 mt-1">
  <NumericFormat
    value={pct === 0 ? '' : pct}
    onValueChange={vals => updateCategoryBudgetPct(category, vals.floatValue ?? 0)}
    decimalSeparator="," suffix=" %" decimalScale={1} allowNegative={false} placeholder="0 %"
    className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-violet-500"
  />
  {pct > 0 && (
    <span className="text-xs text-gray-400 tabular-nums">
      = {formatBRL.format(limit)}
    </span>
  )}
</div>

{/* Row 2b: spent + progress bar + % used */}
{pct > 0 && (
  <div className="flex items-center gap-2 mt-1.5">
    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
      {formatBRL.format(spent)} gasto
    </span>
    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${barColor}`}
        style={{ width: `${Math.min(pctUsed, 100)}%` }}
      />
    </div>
    <span className={`text-xs font-semibold tabular-nums w-8 text-right shrink-0 ${textColor}`}>
      {pctUsed.toFixed(0)}%
    </span>
  </div>
)}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/AllocationTab.jsx
git commit -m "fix: split Limite category rows into 2 sub-rows for mobile"
```

---

## Task 5 — Deploy

- [ ] **Step 1: Final build + deploy**

```bash
npm run build 2>&1 | tail -8 && firebase deploy --only hosting 2>&1 | tail -8
```

Expected: `✓ built in` and `✔  Deploy complete!`

- [ ] **Step 2: Commit anything uncommitted, then final commit**

```bash
git add .firebase/hosting.ZGlzdA.cache
git commit -m "chore: deploy planner mobile improvements"
```

---

## Self-Review

**Spec coverage:**
- ✅ Compact mobile header (single row) — Task 2
- ✅ Gear icon → settings sheet with "Início do plano" — Task 2
- ✅ Desktop header unchanged (wrapped in `hidden sm:flex`) — Task 2
- ✅ Bottom tab bar with icons, `sm:hidden` — Task 3
- ✅ Desktop tab bar hidden on mobile (`hidden sm:block`) — Task 3
- ✅ Content `pb-24` so nothing hides behind nav — Task 3
- ✅ Tab state lifted to `useState` driving both navs — Task 1
- ✅ 2-line category rows — Task 4
- ✅ Deploy — Task 5

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:** `activeTab` / `setActiveTab` used consistently in Tasks 1, 2, 3. `showSettings` / `setShowSettings` consistent in Task 2. `TABS[].icon` added in Task 1 and consumed in Task 3.
