# Investments Goals Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename user-visible "Camadas/Sublayers" to "Metas/Produtos", fix the investment list showing only one item, rename subtabs to "Metas/Ativos", and improve investment card UX with current value + goal badge.

**Architecture:** Three independent changes: (1) string-only renames in existing components, (2) move `InvestmentItem` outside the render function in `Investments.jsx`, (3) enhance investment cards with projected value and goal badge from `calculateProjectedValue` and `usePlannerState`.

**Tech Stack:** React 19, existing `InvestmentContext.calculateProjectedValue`, `usePlannerState`, Firestore indexes.

---

### Task 1: Rename user-visible strings — Camadas → Metas, Sublayers → Produtos

**Files:**
- Modify: `src/pages/planner/carteira/WalletLayerSection.jsx`
- Modify: `src/pages/planner/carteira/LayerModal.jsx` (if exists)
- Modify: `src/pages/planner/carteira/SublayerModal.jsx` (if exists)
- Modify: `src/pages/planner/carteira/index.jsx` (`LayerAllocationEditor` label)
- Modify: `src/pages/Investments.jsx` (PageHelp text)

- [ ] **Step 1: Find all user-visible "Camada"/"Sublayer" strings**

```bash
grep -rn "Camada\|Sublayer\|sublayer\|Adicionar Camada\|Nova Camada" src/pages/planner/carteira/ src/pages/Investments.jsx
```

Expected output: strings in `WalletLayerSection.jsx`, modal files, `index.jsx`, and `Investments.jsx` PageHelp.

- [ ] **Step 2: Update `WalletLayerSection.jsx` string references**

Open `src/pages/planner/carteira/WalletLayerSection.jsx`. Change:
- Any button/heading that says "Adicionar Sublayer" → "Adicionar Produto"
- Any label that says "Sublayer" → "Produto" / "Sublayers" → "Produtos"
- `layer.label` display is user-defined — do NOT change

- [ ] **Step 3: Update `LayerModal.jsx` title and labels**

Open `src/pages/planner/carteira/LayerModal.jsx` (or wherever the layer creation modal is defined).

Change:
- Modal title "Camada" or "Adicionar Camada" → "Meta de Investimento"
- Button "Adicionar Camada" / "Nova Camada" → "Nova Meta"

- [ ] **Step 4: Update `SublayerModal.jsx` title**

Open `src/pages/planner/carteira/SublayerModal.jsx`.

Change:
- Modal title → "Produto"

- [ ] **Step 5: Update `LayerAllocationEditor` label in `carteira/index.jsx`**

In `src/pages/planner/carteira/index.jsx`, find the `LayerAllocationEditor` section heading:

```jsx
// Before: "Suas Camadas" or similar
// After: "Suas Metas"
```

- [ ] **Step 6: Update PageHelp in `Investments.jsx`**

Line 359 in `src/pages/Investments.jsx`:

```jsx
// Before:
text="Organize seus investimentos em Camadas e Sublayers. Camada = objetivo (ex: Proteção, Crescimento). Sublayer = produto real (ex: CDB, Tesouro Selic). Defina o % de cada camada no Plano e adicione os ativos reais na Lista."

// After:
text="Organize seus investimentos em Metas e Produtos. Meta = objetivo (ex: Emergência, Aposentadoria). Produto = ativo real (ex: CDB, Tesouro Selic). Defina o % de cada meta no Plano e adicione os ativos na aba Ativos."
```

- [ ] **Step 7: Verify strings in browser**

```bash
npm run dev
```

Navigate to `/app/planner?tab=carteira`. Confirm buttons say "Nova Meta" and "Adicionar Produto". No "Camada" or "Sublayer" visible anywhere.

- [ ] **Step 8: Commit**

```bash
git add src/pages/planner/carteira/ src/pages/Investments.jsx
git commit -m "feat: rename Camadas/Sublayers to Metas/Produtos in UI strings"
```

---

### Task 2: Fix investment list — move InvestmentItem outside render function

**Files:**
- Modify: `src/pages/Investments.jsx`

- [ ] **Step 1: Understand the bug**

`InvestmentItem` is currently defined at line 110, inside `InvestmentsPage()`. React treats it as a new component type on every render, causing every list item to unmount and remount. This causes only the last item to remain visible after rapid re-renders during loading.

- [ ] **Step 2: Extract `InvestmentItem` to module level**

Move the component definition **above** the `export default function InvestmentsPage()` declaration. It needs props that were previously captured via closure — pass them explicitly.

Replace the inner definition:
```jsx
// REMOVE from inside InvestmentsPage:
const InvestmentItem = ({ investment }) => { ... };
```

Add at module level (after the `BADGE_COLORS` constant, before `export default function InvestmentsPage`):

```jsx
function InvestmentItem({ investment, onNavigate, formatCurrency, t, language, getBankInfo, getInvestmentType }) {
  const typeInfo = getInvestmentType(investment.type);
  const knownBankInfo = investment.bank ? getBankInfo(investment.bank) : null;
  const isKnownBank = knownBankInfo && knownBankInfo.id !== 'other';
  const bankDisplayName = isKnownBank ? knownBankInfo.name : investment.bank;
  const bankIcon = isKnownBank ? knownBankInfo.icon : '🏦';

  const purchaseDate = investment.purchaseDate
    ? new Date(investment.purchaseDate).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <button
      onClick={() => onNavigate(investment)}
      className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0
          ${investment.type === 'fixed_income' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}
          ${investment.type === 'stocks' ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}
          ${investment.type === 'crypto' ? 'bg-orange-100 dark:bg-orange-900/40' : ''}
          ${investment.type === 'funds' ? 'bg-purple-100 dark:bg-purple-900/40' : ''}
          ${investment.type === 'real_estate' ? 'bg-amber-100 dark:bg-amber-900/40' : ''}
          ${investment.type === 'fii' ? 'bg-teal-100 dark:bg-teal-900/40' : ''}
        `}>
          {typeInfo.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-gray-900 dark:text-white text-sm truncate">{investment.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${BADGE_COLORS[investment.type] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {t(`investments.types.${investment.type}`)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              {investment.bank && (
                <div className="flex items-center gap-1 min-w-0 max-w-[100px]">
                  <span className="text-xs flex-shrink-0">{bankIcon}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{bankDisplayName}</span>
                </div>
              )}
              {purchaseDate && (
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{purchaseDate}</span>
              )}
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
              {formatCurrency(investment.initialAmount || 0)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Update the render call site**

Inside `InvestmentsPage`, update the `.map()` call (around line 341) from:

```jsx
{sortedInvestments.map((investment) => (
  <InvestmentItem key={investment.id} investment={investment} />
))}
```

To:

```jsx
{sortedInvestments.map((investment) => (
  <InvestmentItem
    key={investment.id}
    investment={investment}
    onNavigate={handleInvestmentClick}
    formatCurrency={formatCurrency}
    t={t}
    language={language}
    getBankInfo={getBankInfo}
    getInvestmentType={getInvestmentType}
  />
))}
```

- [ ] **Step 4: Verify all investments render**

```bash
npm run dev
```

Navigate to `/app/investments`, switch to "Lista" tab. All investments should appear. Add a new investment if needed to verify multiple items show.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Investments.jsx
git commit -m "fix: move InvestmentItem outside render to prevent remount on every render"
```

---

### Task 3: Check Firestore composite index for investments collection

**Files:**
- Modify: `firestore.indexes.json` (if the index is missing)

- [ ] **Step 1: Check existing indexes**

```bash
cat firestore.indexes.json | grep -A 10 '"investments"'
```

- [ ] **Step 2: Add index if missing**

If no entry exists for `investments` with `userId` + `createdAt`, add to the `indexes` array in `firestore.indexes.json`:

```json
{
  "collectionGroup": "investments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 3: Deploy the index**

```bash
firebase deploy --only firestore:indexes
```

Expected output: `✔  firestore: Deployed indexes in firestore.indexes.json successfully`

- [ ] **Step 4: Commit (only if index was added)**

```bash
git add firestore.indexes.json
git commit -m "fix: add investments userId+createdAt composite index"
```

---

### Task 4: Rename subtabs — "Plano" → "Metas", "Lista" → "Ativos"

**Files:**
- Modify: `src/pages/Investments.jsx`

- [ ] **Step 1: Update `SubTabs` component labels**

In `src/pages/Investments.jsx`, find the `SubTabs` component (lines 15–36). Change the tab definitions:

```jsx
// Before:
{ value: 'plano', label: 'Plano' },
{ value: 'lista', label: 'Lista' },

// After:
{ value: 'plano', label: 'Metas' },
{ value: 'lista', label: 'Ativos' },
```

The `value` keys remain unchanged (`'plano'` and `'lista'`) so the `activeSubTab` state logic needs no changes.

- [ ] **Step 2: Verify in browser**

The investment page should now show "Metas" and "Ativos" as subtab labels.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Investments.jsx
git commit -m "feat: rename investment subtabs Plano→Metas and Lista→Ativos"
```

---

### Task 5: Enhanced investment cards — current value + goal badge

**Files:**
- Modify: `src/pages/Investments.jsx`

- [ ] **Step 1: Import `calculateProjectedValue` and planner state**

`calculateProjectedValue` is already available via `useInvestments()` — confirm it's in the destructured values:

```jsx
const {
  investments,
  loading,
  getTotalInvested,
  getInvestmentType,
  calculateProjectedValue,  // ← add this if not already present
} = useInvestments();
```

For goal labels, import `usePlannerState` and extract layer data:

```jsx
import usePlannerState, { getActivePlannerVersion } from './planner/usePlannerState';
// Already imported at line 13 — just add getActivePlannerVersion to the import
```

After the existing `usePlannerState` call:

```jsx
const { state, update, poupancaValue, isLoading: plannerLoading } = usePlannerState();
```

Add:

```jsx
const plannerVersion = useMemo(
  () => getActivePlannerVersion(state?.plannerVersions, selectedMonth),
  [state?.plannerVersions, selectedMonth]
);
const goalLayers = useMemo(
  () => plannerVersion?.walletVersions?.find(w => w.isActive)?.layers ?? [],
  [plannerVersion]
);
const getGoalLabel = useCallback(
  (plannerGoalId) => goalLayers.find(l => l.id === plannerGoalId)?.label ?? null,
  [goalLayers]
);
```

Add `useMemo, useCallback` to the React import if not already present.

- [ ] **Step 2: Update `InvestmentItem` signature to accept new props**

Add `calculateProjectedValue` and `getGoalLabel` to the module-level `InvestmentItem` props:

```jsx
function InvestmentItem({ investment, onNavigate, formatCurrency, t, language, getBankInfo, getInvestmentType, calculateProjectedValue, getGoalLabel }) {
```

- [ ] **Step 3: Add projected value and delta to the card body**

Inside `InvestmentItem`, after the existing `purchaseDate` computation, add:

```jsx
const projectedValue = calculateProjectedValue(investment);
const initialAmount = investment.initialAmount || 0;
const delta = projectedValue - initialAmount;
const deltaPct = initialAmount > 0 ? (delta / initialAmount) * 100 : 0;
const hasGrowth = projectedValue > 0 && projectedValue !== initialAmount;

const goalLabel = getGoalLabel(investment.plannerGoalId);
```

Update the amount display row (currently just shows `initialAmount`) to show both initial and projected:

```jsx
<div className="flex items-end gap-2 flex-shrink-0">
  <div className="text-right">
    <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
      {formatCurrency(initialAmount)}
    </span>
    {hasGrowth && (
      <div className="flex items-center justify-end gap-1 mt-0.5">
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {formatCurrency(projectedValue)}
        </span>
        <span className="text-[10px] text-emerald-500 tabular-nums">
          (+{deltaPct.toFixed(2)}%)
        </span>
      </div>
    )}
  </div>
</div>
```

Add the goal badge below the bank/date row:

```jsx
{goalLabel && (
  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium flex-shrink-0 self-end">
    {goalLabel}
  </span>
)}
```

- [ ] **Step 4: Pass new props at call site**

Update the `.map()` call:

```jsx
{sortedInvestments.map((investment) => (
  <InvestmentItem
    key={investment.id}
    investment={investment}
    onNavigate={handleInvestmentClick}
    formatCurrency={formatCurrency}
    t={t}
    language={language}
    getBankInfo={getBankInfo}
    getInvestmentType={getInvestmentType}
    calculateProjectedValue={calculateProjectedValue}
    getGoalLabel={getGoalLabel}
  />
))}
```

- [ ] **Step 5: Verify cards show projected value**

```bash
npm run dev
```

Open `/app/investments` → "Ativos" tab. Cards with a rate set should show `→ R$ X.XXX,XX (+Y.YY%)`. Cards with a `plannerGoalId` matching a layer should show a violet goal badge.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Investments.jsx
git commit -m "feat: show projected value and goal badge on investment cards"
```
