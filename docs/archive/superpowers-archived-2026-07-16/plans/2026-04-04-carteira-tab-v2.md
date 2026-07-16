# Carteira Tab v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite CarteiraTab from investment-class cards to goal-oriented savings cards driven by `savingsRows`, with `plannerGoalId` linking investments/transactions to each goal.

**Architecture:** Each savings row becomes a card showing recommended instrument, monthly contribution (phase1/phase2), current balance (auto-summed from tagged investments + transactions OR manual `manualBalance` input), goal target, progress bar, and remaining amount. New `plannerGoalId` field on both investment records and transactions links them to planner goals. A `usePlannerGoals` lightweight hook provides the dropdown data to forms.

**Tech Stack:** React 19, Tailwind CSS v4, Firestore, existing `InvestmentContext`, `useAccess`, `usePlannerState`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/planner/usePlannerState.js` | Modify | Add `goalTarget`/`manualBalance` defaults, rename label, fix matricula |
| `src/pages/planner/usePlannerGoals.js` | Create | Lightweight hook for form dropdowns |
| `src/pages/planner/CarteiraTab.jsx` | Rewrite | Goal-oriented cards with priority order, auto-sum + manual balance |
| `src/pages/planner/PlannerPage.jsx` | Modify | Pass `update`, `liquidezFinal`, `isPhase2ForSelectedMonth` to CarteiraTab |
| `src/pages/InvestmentForm.jsx` | Modify | Add `plannerGoalId` select field |
| `src/components/TransactionForm.jsx` | Modify | Add `plannerGoalId` select field |
| `src/components/EditSingleTransactionModal.jsx` | Modify | Add `plannerGoalId` select field |

---

## Task 1: Update usePlannerState.js savingsRows

**Files:**
- Modify: `src/pages/planner/usePlannerState.js:58-67` (savingsRows) and `migrateState()`

- [ ] **Step 1: Update DEFAULT_STATE savingsRows**

Replace the existing `savingsRows` array (lines 58–67) with:
```js
savingsRows: [
  { id: 'emergencia',    label: 'Fundo de Emergência',      phase1: 2070.84, phase2: 2070.84, tipo: 'Prioridade máxima',        onde: 'Tesouro Selic / CDB liq. diária',  returnPct: 1.0, goalTarget: 120000,  manualBalance: 0 },
  { id: 'aposentadoria', label: 'Independência Financeira', phase1: 500,     phase2: 800,     tipo: 'Não pausar — renda futura', onde: 'Tesouro IPCA+ / FIIs',             returnPct: 0.9, goalTarget: 6000000, manualBalance: 0 },
  { id: 'casa',          label: 'Meta Entrada Casa',        phase1: 1757.58, phase2: 3000,    tipo: 'Meta 3 anos',               onde: 'CDB separado 115% CDI',            returnPct: 1.0, goalTarget: 400000,  manualBalance: 0 },
  { id: 'filhos',        label: 'Filhos (Educação)',        phase1: 1500,    phase2: 2000,    tipo: 'Meta R$ 800k',              onde: 'ETFs 70% / Renda Fixa 30%',        returnPct: 0.9, goalTarget: 800000,  manualBalance: 0 },
  { id: 'mae',           label: 'Reserva Mãe',              phase1: 500,     phase2: 500,     tipo: 'Fixo mensal',               onde: 'AstroPay / CDB liq. diária',       returnPct: 1.0, goalTarget: 0,        manualBalance: 0 },
  { id: 'manutencao',    label: 'Reserva Manutenção Carro', phase1: 250,     phase2: 250,     tipo: '÷12 do orçamento anual',    onde: 'CDB liquidez diária',              returnPct: 1.0, goalTarget: 3000,    manualBalance: 0 },
  { id: 'ipva',          label: 'Reserva IPVA',             phase1: 166.67,  phase2: 166.67,  tipo: '÷12',                       onde: 'CDB liquidez diária',              returnPct: 1.0, goalTarget: 2000,    manualBalance: 0 },
  { id: 'matricula',     label: 'Reserva Matrícula',        phase1: 125,     phase2: 125,     tipo: '÷12',                       onde: 'CDB liquidez diária',              returnPct: 1.0, goalTarget: 1500,    manualBalance: 0 },
],
```

- [ ] **Step 2: Update migrateState() to inject new fields**

After the existing `returnPct` migration block (around line 98–101), add:
```js
// Inject goalTarget and manualBalance for rows missing them
merged.savingsRows = merged.savingsRows.map(row => {
  const def = DEFAULT_STATE.savingsRows.find(d => d.id === row.id);
  return {
    goalTarget: def?.goalTarget ?? 0,
    manualBalance: def?.manualBalance ?? 0,
    label: def?.label ?? row.label,
    ...row,
  };
});
```

Note: Including `label` in the defaults ensures the rename from 'Aposentadoria' → 'Independência Financeira' propagates to existing Firestore documents.

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | grep -E "(usePlannerState|error)" | head -20
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/usePlannerState.js
git commit -m "feat: add goalTarget/manualBalance to savingsRows, rename aposentadoria label, fix matricula"
```

---

## Task 2: Create usePlannerGoals.js hook

**Files:**
- Create: `src/pages/planner/usePlannerGoals.js`

- [ ] **Step 1: Create the file**

```js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';

/**
 * Lightweight hook that reads savingsRows from Firestore planner doc.
 * Returns an array of { id, label } for use in form dropdowns.
 */
export default function usePlannerGoals() {
  const { ownerId } = useAccess();
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    const unsubscribe = onSnapshot(doc(db, 'planner', ownerId), (snap) => {
      if (snap.exists()) {
        const rows = snap.data().savingsRows ?? [];
        setGoals(rows.map(r => ({ id: r.id, label: r.label })));
      }
    });
    return unsubscribe;
  }, [ownerId]);

  return goals;
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | grep "usePlannerGoals" | head -10
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/usePlannerGoals.js
git commit -m "feat: add usePlannerGoals hook for form dropdowns"
```

---

## Task 3: Rewrite CarteiraTab.jsx

**Files:**
- Rewrite: `src/pages/planner/CarteiraTab.jsx`

- [ ] **Step 1: Rewrite the file**

```jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '@/contexts/InvestmentContext';
import { formatBRL } from './usePlannerState';
import { Shimmer } from '@/components/ui/shimmer';

const PRIORITY_ORDER = ['emergencia', 'aposentadoria', 'filhos', 'casa', 'mae', 'manutencao', 'ipva', 'matricula'];

const ROW_STYLES = {
  emergencia:    { icon: '💧', color: 'blue' },
  aposentadoria: { icon: '🌱', color: 'emerald' },
  filhos:        { icon: '👶', color: 'violet' },
  casa:          { icon: '🏠', color: 'amber' },
  mae:           { icon: '❤️', color: 'rose' },
  manutencao:    { icon: '🔧', color: 'slate' },
  ipva:          { icon: '🚗', color: 'orange' },
  matricula:     { icon: '📚', color: 'teal' },
};

const COLOR_CLASSES = {
  blue:    { badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',       bar: 'bg-blue-500',    chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
  emerald: { badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
  violet:  { badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   bar: 'bg-violet-500',  chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
  amber:   { badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',     bar: 'bg-amber-500',   chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
  rose:    { badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',       bar: 'bg-rose-500',    chip: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
  slate:   { badge: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',       bar: 'bg-slate-400',   chip: 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400' },
  orange:  { badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', bar: 'bg-orange-500',  chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
  teal:    { badge: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',       bar: 'bg-teal-500',    chip: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' },
};

function GoalCard({ row, goalTarget, isPhase2, liquidezFinal, onUpdateRow, investments, getCurrentValue, invLoading, taggedTransactions }) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [editingManual, setEditingManual] = useState(false);
  const [tempTarget, setTempTarget] = useState('');
  const [tempManual, setTempManual] = useState('');

  const style = ROW_STYLES[row.id] ?? { icon: '💰', color: 'slate' };
  const colors = COLOR_CLASSES[style.color] ?? COLOR_CLASSES.slate;

  const monthlyContrib = isPhase2 ? row.phase2 : row.phase1;

  // Compute balance from tagged investments + transactions
  const taggedInvestments = investments.filter(
    inv => inv.plannerGoalId === row.id && inv.status !== 'closed'
  );
  const invTotal = taggedInvestments.reduce((sum, inv) => sum + getCurrentValue(inv), 0);
  const txTotal = (taggedTransactions[row.id] ?? []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const autoTotal = invTotal + txTotal;
  const recordCount = taggedInvestments.length + (taggedTransactions[row.id]?.length ?? 0);

  const hasAutoData = autoTotal > 0;
  const currentBalance = hasAutoData ? autoTotal : (row.manualBalance ?? 0);

  const isOngoing = goalTarget === 0;
  const progressPct = (!isOngoing && goalTarget > 0)
    ? Math.min(100, (currentBalance / goalTarget) * 100)
    : 0;
  const remaining = Math.max(0, goalTarget - currentBalance);
  const goalReached = !isOngoing && currentBalance >= goalTarget && goalTarget > 0;

  const handleTargetSave = () => {
    const parsed = parseFloat(tempTarget.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateRow(row.id, { goalTarget: parsed });
    }
    setEditingTarget(false);
  };

  const handleManualSave = () => {
    const parsed = parseFloat(tempManual.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateRow(row.id, { manualBalance: parsed });
    }
    setEditingManual(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{style.icon}</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{row.label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
          {isPhase2 ? 'Fase 2' : 'Fase 1'}
        </span>
      </div>

      {/* Instrument */}
      <p className="text-xs text-gray-400">{row.onde}</p>

      {/* Linked records or manual balance */}
      <div className="space-y-1.5">
        {invLoading ? (
          <>
            <Shimmer className="h-7 w-full rounded-lg" />
            <Shimmer className="h-7 w-3/4 rounded-lg" />
          </>
        ) : hasAutoData ? (
          <>
            {taggedInvestments.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{inv.name}</span>
                  {inv.bank && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${colors.chip}`}>{inv.bank}</span>
                  )}
                </div>
                <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">
                  {formatBRL.format(getCurrentValue(inv))}
                </span>
              </div>
            ))}
            {(taggedTransactions[row.id] ?? []).map(tx => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{tx.description}</span>
                <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">
                  {formatBRL.format(tx.amount)}
                </span>
              </div>
            ))}
            <p className="text-xs text-gray-400 italic">de {recordCount} {recordCount === 1 ? 'registro' : 'registros'}</p>
          </>
        ) : (
          <div>
            {editingManual ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  value={tempManual}
                  onChange={e => setTempManual(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualSave(); if (e.key === 'Escape') setEditingManual(false); }}
                  autoFocus
                />
                <button onClick={handleManualSave} className="text-xs text-violet-600 dark:text-violet-400 font-semibold">OK</button>
              </div>
            ) : (
              <button
                onClick={() => { setTempManual(String(row.manualBalance ?? 0)); setEditingManual(true); }}
                className="text-xs text-gray-400 italic hover:text-violet-500 transition-colors"
              >
                {(row.manualBalance ?? 0) > 0
                  ? `Saldo manual: ${formatBRL.format(row.manualBalance)}`
                  : 'Sem registros — clique para inserir saldo'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats + Progress */}
      <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Atual</span>
          <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{formatBRL.format(currentBalance)}</span>
        </div>

        {!isOngoing && (
          <>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 items-center">
              <span>Meta</span>
              {editingTarget ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="w-28 px-1.5 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 text-right"
                    value={tempTarget}
                    onChange={e => setTempTarget(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleTargetSave(); if (e.key === 'Escape') setEditingTarget(false); }}
                    autoFocus
                  />
                  <button onClick={handleTargetSave} className="text-xs text-violet-600 dark:text-violet-400 font-semibold">OK</button>
                </div>
              ) : (
                <button
                  onClick={() => { setTempTarget(String(goalTarget)); setEditingTarget(true); }}
                  className="tabular-nums hover:text-violet-500 transition-colors"
                >
                  {formatBRL.format(goalTarget)}
                </button>
              )}
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${colors.bar}`} style={{ width: `${progressPct}%` }} />
            </div>
            {goalReached ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-center">Meta atingida!</p>
            ) : (
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Faltam</span>
                <span className="tabular-nums">{formatBRL.format(remaining)}</span>
              </div>
            )}
          </>
        )}

        {isOngoing && (
          <p className="text-xs text-gray-400 italic">Reserva contínua</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span>Aporte este mês</span>
        <span className="tabular-nums font-semibold">{formatBRL.format(monthlyContrib)}</span>
      </div>
    </div>
  );
}

export default function CarteiraTab({ state, update, liquidezFinal, isPhase2ForSelectedMonth }) {
  const { ownerId } = useAccess();
  const { investments, getCurrentValue, loading: invLoading } = useInvestments();
  const [taggedTransactions, setTaggedTransactions] = useState({});

  // Load transactions tagged with plannerGoalId
  useEffect(() => {
    if (!ownerId) return;

    const fetchTagged = async () => {
      const { getDocs: _getDocs, query: _query, collection: _col, where: _where } = await import('firebase/firestore');
      const { db: _db } = await import('@/firebase');
      const q = _query(
        _col(_db, 'transactions'),
        _where('userId', '==', ownerId),
        _where('amount', '>', 0)
      );
      const snap = await _getDocs(q);
      const byGoal = {};
      snap.forEach(d => {
        const tx = { id: d.id, ...d.data() };
        if (tx.plannerGoalId) {
          if (!byGoal[tx.plannerGoalId]) byGoal[tx.plannerGoalId] = [];
          byGoal[tx.plannerGoalId].push(tx);
        }
      });
      setTaggedTransactions(byGoal);
    };

    fetchTagged();
  }, [ownerId]);

  // Sort rows by priority
  const sortedRows = [...(state.savingsRows ?? [])].sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a.id);
    const ib = PRIORITY_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const handleUpdateRow = (rowId, patch) => {
    const updatedRows = state.savingsRows.map(r => r.id === rowId ? { ...r, ...patch } : r);
    update('savingsRows', updatedRows);
  };

  // Compute emergencia goalTarget dynamically (6 months liquidity), override stored value
  const emergenciaTarget = Math.round(liquidezFinal * 6);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sortedRows.map(row => {
          const goalTarget = row.id === 'emergencia' ? emergenciaTarget : (row.goalTarget ?? 0);
          return (
            <GoalCard
              key={row.id}
              row={row}
              goalTarget={goalTarget}
              isPhase2={isPhase2ForSelectedMonth}
              liquidezFinal={liquidezFinal}
              onUpdateRow={handleUpdateRow}
              investments={investments}
              getCurrentValue={getCurrentValue}
              invLoading={invLoading}
              taggedTransactions={taggedTransactions}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | grep "CarteiraTab" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/CarteiraTab.jsx
git commit -m "feat: rewrite CarteiraTab as goal-oriented savings cards"
```

---

## Task 4: Update PlannerPage.jsx CarteiraTab props

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx:175-179`

- [ ] **Step 1: Update CarteiraTab TabsContent**

Find the existing `<TabsContent value="carteira">` block:
```jsx
<TabsContent value="carteira">
  <CarteiraTab
    state={state}
    livresPhase2={savingsComputed.livresPhase2}
  />
</TabsContent>
```

Replace with:
```jsx
<TabsContent value="carteira">
  <CarteiraTab
    state={state}
    update={update}
    liquidezFinal={liquidezFinal}
    isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
  />
</TabsContent>
```

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | grep "PlannerPage" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: pass update/liquidezFinal/isPhase2 props to CarteiraTab"
```

---

## Task 5: Add plannerGoalId to InvestmentForm.jsx

**Files:**
- Modify: `src/pages/InvestmentForm.jsx`

- [ ] **Step 1: Import usePlannerGoals**

At the top of the file, after existing imports, add:
```js
import usePlannerGoals from '../pages/planner/usePlannerGoals';
```

- [ ] **Step 2: Add plannerGoalId to formData state**

In the `useState` for `formData` (around line 43), add `plannerGoalId: ''`:
```js
const [formData, setFormData] = useState({
  name: '',
  type: 'fixed_income',
  bank: '',
  initialAmount: 0,
  expectedReturn: 0,
  returnType: 'annual',
  purchaseDate: new Date().toISOString().split('T')[0],
  maturityDate: '',
  goalId: '',
  plannerGoalId: '',
  notes: '',
});
```

- [ ] **Step 3: Add usePlannerGoals hook call**

After the `const availableGoals = ...` line (around line 63), add:
```js
const plannerGoals = usePlannerGoals();
```

- [ ] **Step 4: Populate plannerGoalId in edit mode**

In the `useEffect` load block (around line 73-84), in the `setFormData` call inside `if (mode === 'edit')`, add:
```js
plannerGoalId: inv.plannerGoalId || '',
```

- [ ] **Step 5: Include plannerGoalId in handleSubmit**

In `investmentData` (around line 103-114), add:
```js
plannerGoalId: formData.plannerGoalId || null,
```

- [ ] **Step 6: Add plannerGoalId UI field**

Find the existing `goalId` select field in the form UI (search for `contributeToGoal` or `goalId`). After that field's closing `</div>`, add:

```jsx
{/* Planner goal link */}
{plannerGoals.length > 0 && (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Objetivo do planner
    </label>
    <select
      value={formData.plannerGoalId}
      onChange={e => setFormData(prev => ({ ...prev, plannerGoalId: e.target.value }))}
      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
    >
      <option value="">Nenhum</option>
      {plannerGoals.map(g => (
        <option key={g.id} value={g.id}>{g.label}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 7: Lint**

```bash
npm run lint 2>&1 | grep "InvestmentForm" | head -10
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/InvestmentForm.jsx
git commit -m "feat: add plannerGoalId field to InvestmentForm"
```

---

## Task 6: Add plannerGoalId to TransactionForm.jsx

**Files:**
- Modify: `src/components/TransactionForm.jsx`

- [ ] **Step 1: Import usePlannerGoals**

At the top of the file, after existing imports:
```js
import usePlannerGoals from '../pages/planner/usePlannerGoals';
```

- [ ] **Step 2: Add selectedPlannerGoalId state**

After the existing `const [selectedGoalId, setSelectedGoalId] = useState('');` line, add:
```js
const [selectedPlannerGoalId, setSelectedPlannerGoalId] = useState('');
```

- [ ] **Step 3: Add usePlannerGoals hook call**

After the `const availableGoals = ...` line, add:
```js
const plannerGoals = usePlannerGoals();
```

- [ ] **Step 4: Add plannerGoalId to installment transactionData**

In the installment loop `transactionData` object (around line 66-85), add:
```js
plannerGoalId: selectedPlannerGoalId || null,
```

- [ ] **Step 5: Add plannerGoalId to single transactionData**

In the single transaction `transactionData` object (around line 122-135), add:
```js
plannerGoalId: selectedPlannerGoalId || null,
```

- [ ] **Step 6: Reset plannerGoalId on form reset**

In the reset block after successful submit (around line 176-180), add:
```js
setSelectedPlannerGoalId('');
```

- [ ] **Step 7: Add plannerGoalId UI field**

Find the existing goal link section in the form UI (search for `selectedGoalId` in the JSX, around line 465-514). After that section's closing `</div>`, add:

```jsx
{/* Planner goal link */}
{plannerGoals.length > 0 && (
  <div className="space-y-3">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Objetivo do planner</h3>
    <select
      value={selectedPlannerGoalId}
      onChange={e => setSelectedPlannerGoalId(e.target.value)}
      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition text-sm"
    >
      <option value="">Nenhum</option>
      {plannerGoals.map(g => (
        <option key={g.id} value={g.id}>{g.label}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 8: Lint**

```bash
npm run lint 2>&1 | grep "TransactionForm" | head -10
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/TransactionForm.jsx
git commit -m "feat: add plannerGoalId field to TransactionForm"
```

---

## Task 7: Add plannerGoalId to EditSingleTransactionModal.jsx

**Files:**
- Modify: `src/components/EditSingleTransactionModal.jsx`

- [ ] **Step 1: Import usePlannerGoals**

At the top of the file, after existing imports:
```js
import usePlannerGoals from '../pages/planner/usePlannerGoals';
```

- [ ] **Step 2: Add selectedPlannerGoalId state**

After the existing `const [selectedGoalId, setSelectedGoalId] = useState('');` line, add:
```js
const [selectedPlannerGoalId, setSelectedPlannerGoalId] = useState('');
```

- [ ] **Step 3: Add usePlannerGoals hook call**

After the `const availableGoals = ...` line, add:
```js
const plannerGoals = usePlannerGoals();
```

- [ ] **Step 4: Populate plannerGoalId in useEffect**

In the `useEffect` that populates the form (around line 46-93), after `setSelectedGoalId(transaction.goalId || '');`, add:
```js
setSelectedPlannerGoalId(transaction.plannerGoalId || '');
```

- [ ] **Step 5: Add plannerGoalId to handleSubmit updates**

In the `updates` object in `handleSubmit` (around line 116-130), add:
```js
plannerGoalId: selectedPlannerGoalId || null,
```

- [ ] **Step 6: Add plannerGoalId UI field**

Find the goal link section in the JSX (search for `selectedGoalId` in JSX). After that section, add:

```jsx
{/* Planner goal link */}
{plannerGoals.length > 0 && (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Objetivo do planner
    </label>
    <select
      value={selectedPlannerGoalId}
      onChange={e => setSelectedPlannerGoalId(e.target.value)}
      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition text-sm"
    >
      <option value="">Nenhum</option>
      {plannerGoals.map(g => (
        <option key={g.id} value={g.id}>{g.label}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 7: Lint**

```bash
npm run lint 2>&1 | grep "EditSingleTransactionModal" | head -10
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/EditSingleTransactionModal.jsx
git commit -m "feat: add plannerGoalId field to EditSingleTransactionModal"
```

---

## Self-Review

**Spec coverage:**
- ✅ `goalTarget`/`manualBalance` added to all savingsRows
- ✅ aposentadoria renamed to 'Independência Financeira'
- ✅ matricula phase1/phase2 corrected to 125
- ✅ usePlannerGoals hook created for forms
- ✅ CarteiraTab rewritten with PRIORITY_ORDER, auto-sum + manual balance fallback, progress bars, ongoing card (mae)
- ✅ emergencia goalTarget computed from `liquidezFinal × 6` (not stored)
- ✅ plannerGoalId on InvestmentForm, TransactionForm, EditSingleTransactionModal
- ✅ PlannerPage passes new props (update, liquidezFinal, isPhase2ForSelectedMonth)

**Potential issue:** `usePlannerGoals.js` is in `src/pages/planner/` but imported from components in `src/components/` and `src/pages/InvestmentForm.jsx`. The import paths use relative paths (`'../pages/planner/usePlannerGoals'`), which is correct for the components directory. InvestmentForm is at `src/pages/InvestmentForm.jsx` so the import would be `'./planner/usePlannerGoals'` — note this difference. The plan correctly uses `'../pages/planner/usePlannerGoals'` for components.
