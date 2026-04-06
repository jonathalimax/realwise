# Carteira Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Carteira" tab to PlannerPage that shows per-class investment progress driven by real Firestore investment data, and hide the standalone Investimentos page from the sidebar.

**Architecture:** `CarteiraTab` reads `state.investmentClasses` and `livresPhase2` from `usePlannerState` plus `investments` and `getCurrentValue` from the existing `InvestmentContext`. A module-level `CLASS_TYPE_MAP` bridges planner class names to InvestmentContext types. Goals are computed as 20-year FV per class. No new Firestore reads.

**Tech Stack:** React 19, Tailwind CSS v4, existing `InvestmentContext`, existing `usePlannerState` outputs.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/planner/CarteiraTab.jsx` | Create | Per-class investment cards with real progress |
| `src/pages/planner/PlannerPage.jsx` | Modify | Add Carteira tab between Sistema and Dashboard |
| `src/components/Sidebar.jsx` | Modify | Remove Investimentos from navItems and ROOT_ROUTES |

---

## Task 1: Hide Investimentos from sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx:39` (navItems) and `src/components/Sidebar.jsx:57` (ROOT_ROUTES)

- [ ] **Step 1: Remove investments from navItems**

In `src/components/Sidebar.jsx`, find `navItems` (starts at line 30). Remove this line:
```js
{ path: '/investments', icon: ChartBarIcon, labelKey: 'investments' },
```

- [ ] **Step 2: Remove investments from ROOT_ROUTES**

In the same file, find `ROOT_ROUTES` (line 50). Remove this entry:
```js
'/investments',
```

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | grep -E "(Sidebar|error)" | head -20
```
Expected: no new errors in Sidebar.jsx.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: hide Investimentos from sidebar nav"
```

---

## Task 2: Create CarteiraTab component

**Files:**
- Create: `src/pages/planner/CarteiraTab.jsx`

- [ ] **Step 1: Create the file**

Create `src/pages/planner/CarteiraTab.jsx` with:

```jsx
import { useInvestments } from '@/contexts/InvestmentContext';
import { formatBRL } from './usePlannerState';
import { Shimmer } from '@/components/ui/shimmer';

// Maps each planner class name to InvestmentContext type(s)
const CLASS_TYPE_MAP = {
  'Renda Fixa (CDB/Tesouro)': ['fixed_income'],
  'Exterior ETFs':            ['funds'],
  'FIIs':                     ['fii'],
  'Ações Dividendos':         ['stocks'],
  'Cripto':                   ['crypto'],
};

const CLASS_STYLES = {
  'Renda Fixa (CDB/Tesouro)': {
    icon: '📈',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    bar: 'bg-blue-500',
    chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  },
  'Exterior ETFs': {
    icon: '🌍',
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
  },
  'FIIs': {
    icon: '🏢',
    badge: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    bar: 'bg-teal-500',
    chip: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  },
  'Ações Dividendos': {
    icon: '📊',
    badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  },
  'Cripto': {
    icon: '₿',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    bar: 'bg-orange-500',
    chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  },
};

const DEFAULT_STYLE = {
  icon: '💰',
  badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  bar: 'bg-gray-400',
  chip: 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400',
};

function computeGoal(cls, livresPhase2) {
  const PMT = Math.max(0, livresPhase2 * cls.pct / 100);
  const r = cls.returnPct / 100;
  const n = 240; // 20 years × 12 months
  return r > 0 ? PMT * (Math.pow(1 + r, n) - 1) / r : PMT * n;
}

export default function CarteiraTab({ state, livresPhase2 }) {
  const { investments, getCurrentValue, loading } = useInvestments();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {state.investmentClasses.map((cls) => {
          const style = CLASS_STYLES[cls.name] ?? DEFAULT_STYLE;
          const types = CLASS_TYPE_MAP[cls.name] ?? [];
          const classInvestments = investments.filter(
            inv => types.includes(inv.type) && inv.status !== 'closed'
          );
          const currentValue = classInvestments.reduce(
            (sum, inv) => sum + getCurrentValue(inv), 0
          );
          const goal = computeGoal(cls, livresPhase2);
          const remaining = Math.max(0, goal - currentValue);
          const progressPct = goal > 0 ? Math.min(100, (currentValue / goal) * 100) : 0;
          const goalReached = currentValue >= goal && goal > 0;
          const monthlyPMT = Math.max(0, livresPhase2 * cls.pct / 100);

          return (
            <div
              key={cls.name}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{style.icon}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{cls.name}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                  {cls.pct}%
                </span>
              </div>

              {/* Vehicle */}
              <p className="text-xs text-gray-400">{cls.vehicle}</p>

              {/* Linked investments */}
              <div className="space-y-1.5">
                {loading ? (
                  <>
                    <Shimmer className="h-7 w-full rounded-lg" />
                    <Shimmer className="h-7 w-3/4 rounded-lg" />
                  </>
                ) : classInvestments.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum investimento registrado</p>
                ) : (
                  classInvestments.map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{inv.name}</span>
                        {inv.bank && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${style.chip}`}>
                            {inv.bank}
                          </span>
                        )}
                      </div>
                      <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">
                        {formatBRL.format(getCurrentValue(inv))}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Progress */}
              <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Atual</span>
                  <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{formatBRL.format(currentValue)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Meta (20 anos)</span>
                  <span className="tabular-nums">{formatBRL.format(goal)}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${style.bar}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {goalReached ? (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-center">Meta atingida!</p>
                ) : (
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Faltam</span>
                    <span className="tabular-nums">{formatBRL.format(remaining)}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                <span>Aporte mensal planejado</span>
                <span className="tabular-nums font-semibold">{formatBRL.format(monthlyPMT)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | grep "CarteiraTab"
```
Expected: no output (no errors in CarteiraTab).

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/CarteiraTab.jsx
git commit -m "feat: add CarteiraTab with per-class investment progress"
```

---

## Task 3: Add Carteira tab to PlannerPage

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx`

- [ ] **Step 1: Add CarteiraTab import**

At the top of `PlannerPage.jsx`, after the SistemaTab import, add:
```js
import CarteiraTab from './CarteiraTab';
```

- [ ] **Step 2: Add Carteira to TABS array**

Find the `TABS` constant and insert `carteira` between `sistema` and `dashboard`:
```js
const TABS = [
  { value: 'sistema',     label: 'Sistema' },
  { value: 'carteira',    label: 'Carteira' },
  { value: 'dashboard',   label: 'Dashboard' },
  { value: 'allocation',  label: 'Alocação' },
  { value: 'gastos',      label: 'Gastos' },
  { value: 'investments', label: 'Investimentos' },
  { value: 'simulacoes',  label: 'Simulações' },
];
```

- [ ] **Step 3: Add TabsContent for carteira**

Inside the `<>...</>` block (after the `isLoading` check), after the `sistema` TabsContent and before the `dashboard` TabsContent, add:
```jsx
<TabsContent value="carteira">
  <CarteiraTab
    state={state}
    livresPhase2={savingsComputed.livresPhase2}
  />
</TabsContent>
```

- [ ] **Step 4: Lint**

```bash
npm run lint 2>&1 | grep -E "(PlannerPage|CarteiraTab|error)" | head -20
```
Expected: no new errors in these files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: add Carteira tab to PlannerPage"
```
