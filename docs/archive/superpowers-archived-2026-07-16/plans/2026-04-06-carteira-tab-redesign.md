# Carteira Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Carteira tab with fully dynamic layers/sublayers, explicit layer-% allocation, a versioned temporal model (changes apply from selected month forward), and a top-level AI wallet analysis feature.

**Architecture:** A new `src/pages/planner/carteira/` folder holds all sub-components. `usePlannerState` gains a `walletVersions` array as a new field alongside the existing `savingsRows`/`investmentClasses` (which are kept for backward-compat with other tabs). `getActiveVersion(walletVersions, month)` and `updateWalletForMonth(walletVersions, month, patchFn)` are pure functions in `carteira/walletVersion.js`. The Carteira tab renders: CarteiraDashboard → AnalysePanel → LayerAllocationEditor → WalletLayerSection[].

**Tech Stack:** React 19, Tailwind CSS v4, Firebase/Firestore (via existing hooks), Gemini 2.0 Flash (existing key from SettingsContext), no new npm dependencies.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/planner/carteira/walletVersion.js` | Create | Pure functions: `getActiveVersion`, `updateWalletForMonth` |
| `src/pages/planner/carteira/constants.js` | Create | Shared color maps, type options, formatBRL re-export |
| `src/pages/planner/carteira/CarteiraDashboard.jsx` | Create | Dark hero strip: patrimony, investable, emergency, focus |
| `src/pages/planner/carteira/LayerAllocationEditor.jsx` | Create | Colored % tiles per layer + stacked bar + add layer button |
| `src/pages/planner/carteira/LayerModal.jsx` | Create | Add/edit layer form (icon, label, color) |
| `src/pages/planner/carteira/SublayerModal.jsx` | Create | Add/edit sublayer form (all fields) |
| `src/pages/planner/carteira/WalletSublayerCard.jsx` | Create | Sublayer card: type, return, IRPF, goal progress, edit/delete |
| `src/pages/planner/carteira/WalletLayerSection.jsx` | Create | Layer header + sublayer grid + pesquisar button |
| `src/pages/planner/carteira/GoalPriorityModal.jsx` | Create | Drag-to-reorder priority list + context + Gemini call |
| `src/pages/planner/carteira/AnalysePanel.jsx` | Create | Purple button + suggestions list with accept/reject |
| `src/pages/planner/carteira/index.jsx` | Create | Root CarteiraTab component wiring all pieces |
| `src/pages/planner/usePlannerState.js` | Modify | Add `walletVersions` to DEFAULT_STATE + migration |
| `src/pages/planner/PlannerPage.jsx` | Modify | Update CarteiraTab import + pass `poupancaValue` |

---

## Task 1: Pure wallet version helpers

**Files:**
- Create: `src/pages/planner/carteira/walletVersion.js`

- [ ] **Step 1: Create the file with `getActiveVersion` and `updateWalletForMonth`**

```js
// src/pages/planner/carteira/walletVersion.js

/**
 * Returns the most recent WalletVersion whose `from` <= month.
 * @param {Array} walletVersions
 * @param {string} month - 'YYYY-MM'
 * @returns {object|null}
 */
export function getActiveVersion(walletVersions, month) {
  if (!walletVersions?.length) return null;
  const sorted = [...walletVersions].sort((a, b) => (a.from > b.from ? 1 : -1));
  let active = sorted[0];
  for (const v of sorted) {
    if (v.from <= month) active = v;
  }
  return active;
}

/**
 * Applies patchFn(layers) for the given month, creating a new version
 * snapshot if the active version predates the month.
 * @param {Array} walletVersions
 * @param {string} month - 'YYYY-MM'
 * @param {function} patchFn - receives current layers[], returns new layers[]
 * @returns {Array} new walletVersions array
 */
export function updateWalletForMonth(walletVersions, month, patchFn) {
  const sorted = [...walletVersions].sort((a, b) => (a.from > b.from ? 1 : -1));

  // Find index of the active version
  let activeIdx = 0;
  sorted.forEach((v, i) => { if (v.from <= month) activeIdx = i; });
  const active = sorted[activeIdx];

  if (active.from === month) {
    // Mutate the existing snapshot for this month
    return sorted.map((v, i) =>
      i === activeIdx ? { ...v, layers: patchFn(v.layers) } : v
    );
  }

  // Clone active version and insert new snapshot starting from month
  const newVersion = {
    from: month,
    layers: patchFn(JSON.parse(JSON.stringify(active.layers))),
  };
  return [...sorted, newVersion].sort((a, b) => (a.from > b.from ? 1 : -1));
}

/**
 * Computes monthly contribution amount for a sublayer.
 * @param {object} sublayer
 * @param {number} layerMonthlyAmount - the layer's share of total investable
 * @returns {number}
 */
export function sublayerMonthlyAmount(sublayer, layerMonthlyAmount) {
  if (sublayer.mode === 'value') return sublayer.value ?? 0;
  return layerMonthlyAmount * ((sublayer.pct ?? 0) / 100);
}

/**
 * Net return after IRPF.
 * @param {number} returnPct - gross monthly %
 * @param {number} taxRate - IRPF %
 * @returns {number}
 */
export function netReturn(returnPct, taxRate) {
  return returnPct * (1 - taxRate / 100);
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls src/pages/planner/carteira/walletVersion.js
```
Expected: file listed.

- [ ] **Step 3: Quick manual test — open browser console and paste**

```js
// Paste in browser console after dev server is running to verify logic:
// getActiveVersion with two versions
const versions = [
  { from: '2026-01', layers: [{ id: 'a' }] },
  { from: '2026-04', layers: [{ id: 'b' }] },
];
// Viewing 2026-03 → should return the 2026-01 version
console.assert(getActiveVersion(versions, '2026-03').layers[0].id === 'a', 'Should return Jan version for March');
// Viewing 2026-04 → should return 2026-04 version
console.assert(getActiveVersion(versions, '2026-04').layers[0].id === 'b', 'Should return April version');
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/carteira/walletVersion.js
git commit -m "feat: add walletVersion pure helpers (getActiveVersion, updateWalletForMonth)"
```

---

## Task 2: Shared constants

**Files:**
- Create: `src/pages/planner/carteira/constants.js`

- [ ] **Step 1: Create constants file**

```js
// src/pages/planner/carteira/constants.js

export { formatBRL } from '../usePlannerState';

export const LAYER_COLORS = {
  liquidez:    { header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',           title: 'text-blue-700 dark:text-blue-300',     bar: 'bg-blue-500',    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',   tile: 'bg-blue-50 dark:bg-blue-900/20',   tileBorder: 'border-blue-200 dark:border-blue-700',   tileText: 'text-blue-700 dark:text-blue-300',   input: 'border-blue-200 dark:border-blue-600' },
  crescimento: { header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', tile: 'bg-emerald-50 dark:bg-emerald-900/20', tileBorder: 'border-emerald-200 dark:border-emerald-700', tileText: 'text-emerald-700 dark:text-emerald-300', input: 'border-emerald-200 dark:border-emerald-600' },
  patrimonio:  { header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',   title: 'text-violet-700 dark:text-violet-300',   bar: 'bg-violet-500',  badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',   tile: 'bg-violet-50 dark:bg-violet-900/20',  tileBorder: 'border-violet-200 dark:border-violet-700',  tileText: 'text-violet-700 dark:text-violet-300',  input: 'border-violet-200 dark:border-violet-600' },
  legado:      { header: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',   title: 'text-orange-700 dark:text-orange-300',   bar: 'bg-orange-500',  badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',   chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',   tile: 'bg-orange-50 dark:bg-orange-900/20',  tileBorder: 'border-orange-200 dark:border-orange-700',  tileText: 'text-orange-700 dark:text-orange-300',  input: 'border-orange-200 dark:border-orange-600' },
};

// Fallback colors for user-created layers
export const LAYER_COLOR_PALETTE = [
  { key: 'blue',    bar: 'bg-blue-500',    header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',           title: 'text-blue-700 dark:text-blue-300',     tile: 'bg-blue-50 dark:bg-blue-900/20',   tileBorder: 'border-blue-200 dark:border-blue-700',   tileText: 'text-blue-700 dark:text-blue-300',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',         chip: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',   input: 'border-blue-200 dark:border-blue-600' },
  { key: 'emerald', bar: 'bg-emerald-500', header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', tile: 'bg-emerald-50 dark:bg-emerald-900/20', tileBorder: 'border-emerald-200 dark:border-emerald-700', tileText: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', chip: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400', input: 'border-emerald-200 dark:border-emerald-600' },
  { key: 'violet',  bar: 'bg-violet-500',  header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',   title: 'text-violet-700 dark:text-violet-300',   tile: 'bg-violet-50 dark:bg-violet-900/20',  tileBorder: 'border-violet-200 dark:border-violet-700',  tileText: 'text-violet-700 dark:text-violet-300',  badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',   chip: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',   input: 'border-violet-200 dark:border-violet-600' },
  { key: 'orange',  bar: 'bg-orange-500',  header: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',   title: 'text-orange-700 dark:text-orange-300',   tile: 'bg-orange-50 dark:bg-orange-900/20',  tileBorder: 'border-orange-200 dark:border-orange-700',  tileText: 'text-orange-700 dark:text-orange-300',  badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',   chip: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',   input: 'border-orange-200 dark:border-orange-600' },
  { key: 'rose',    bar: 'bg-rose-500',    header: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',           title: 'text-rose-700 dark:text-rose-300',     tile: 'bg-rose-50 dark:bg-rose-900/20',   tileBorder: 'border-rose-200 dark:border-rose-700',   tileText: 'text-rose-700 dark:text-rose-300',   badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',         chip: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',   input: 'border-rose-200 dark:border-rose-600' },
  { key: 'amber',   bar: 'bg-amber-500',   header: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',       title: 'text-amber-700 dark:text-amber-300',   tile: 'bg-amber-50 dark:bg-amber-900/20', tileBorder: 'border-amber-200 dark:border-amber-700', tileText: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',     chip: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', input: 'border-amber-200 dark:border-amber-600' },
];

export const INSTRUMENT_TYPE_COLORS = {
  'Renda Fixa': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'FII':        'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'ETF':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Ações':      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Cripto':     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
};

export const SUBLAYER_TYPE_OPTIONS = ['Renda Fixa', 'FII', 'ETF', 'Ações', 'Cripto', 'Misto', 'Outro'];

export const PRIORITY_ORDER = [
  'emergencia', 'mae', 'manutencao', 'ipva', 'matricula',
  'casa', 'carAntecipacao', 'filhos',
];

/**
 * Resolves layer color config by layerId, falling back to palette by index.
 * @param {string} layerId
 * @param {string|undefined} colorKey - stored color key for user-created layers
 * @param {number} index - layer index for palette fallback
 */
export function resolveLayerColors(layerId, colorKey, index) {
  const fixed = LAYER_COLORS[layerId];
  if (fixed) return fixed;
  const byKey = LAYER_COLOR_PALETTE.find(p => p.key === colorKey);
  if (byKey) return byKey;
  return LAYER_COLOR_PALETTE[index % LAYER_COLOR_PALETTE.length];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/constants.js
git commit -m "feat: add carteira constants and color helpers"
```

---

## Task 3: walletVersions in usePlannerState

**Files:**
- Modify: `src/pages/planner/usePlannerState.js`

The goal is to add `walletVersions` to DEFAULT_STATE and migrate existing `savingsRows` + `investmentClasses` on first load. The existing fields are kept untouched so other tabs are unaffected.

- [ ] **Step 1: Add `walletVersions` to DEFAULT_STATE**

In `usePlannerState.js`, after the `investmentClasses` array (around line 143), add:

```js
  // Wallet versions — replaces savingsRows/investmentClasses in CarteiraTab only
  // Other tabs still use savingsRows/investmentClasses for backward compat
  walletVersions: [],  // populated by migrateState on first load
```

- [ ] **Step 2: Add migration logic in `migrateState`**

Inside `migrateState(saved)`, after the existing migration code (after line ~188), add:

```js
  // Migrate savingsRows + investmentClasses → walletVersions if absent
  if (!merged.walletVersions?.length) {
    const startMonth = merged.plannerStartDate ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Group savingsRows by layer
    const byLayer = {};
    (merged.savingsRows ?? []).forEach(row => {
      const layerId = row.layer ?? 'liquidez';
      if (!byLayer[layerId]) byLayer[layerId] = [];
      byLayer[layerId].push({
        id: row.id,
        label: row.label,
        icon: (() => {
          const icons = { emergencia: '🛡️', filhos: '👶', casa: '🏠', mae: '❤️', manutencao: '🔧', ipva: '🚗', matricula: '📚', carAntecipacao: '⏭️' };
          return icons[row.id] ?? '💰';
        })(),
        type: 'Renda Fixa',
        bank: '',
        description: (row.instruments ?? []).map(i => i.name).join(' / '),
        mode: 'value',
        pct: 0,
        value: row.phase1 ?? 0,
        goalTarget: row.goalTarget ?? 0,
        manualBalance: row.manualBalance ?? 0,
        returnPct: row.returnPct ?? 1.0,
        taxRate: 15,
        instruments: row.instruments ?? [],
      });
    });

    // Build crescimento sublayers from investmentClasses
    const crescimentoSublayers = (merged.investmentClasses ?? []).map(cls => ({
      id: `cls-${cls.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: cls.name,
      icon: { 'Renda Fixa (CDB/Tesouro)': '📈', 'Exterior ETFs': '🌍', 'FIIs': '🏢', 'Ações Dividendos': '💹', 'Cripto': '₿' }[cls.name] ?? '📊',
      type: { 'Renda Fixa (CDB/Tesouro)': 'Renda Fixa', 'Exterior ETFs': 'ETF', 'FIIs': 'FII', 'Ações Dividendos': 'Ações', 'Cripto': 'Cripto' }[cls.name] ?? 'Misto',
      bank: '',
      description: cls.vehicle ?? '',
      mode: cls.mode ?? 'pct',
      pct: cls.pct ?? 0,
      value: cls.phase1 ?? 0,
      goalTarget: 0,
      manualBalance: 0,
      returnPct: cls.returnPct ?? 1.0,
      taxRate: 15,
      instruments: [],
    }));

    const LAYER_DEFS = [
      { id: 'liquidez',    label: 'Liquidez',    icon: '💧', colorKey: 'blue',    pct: 30, desc: 'Reservas líquidas e de emergência — acesso imediato.' },
      { id: 'crescimento', label: 'Crescimento', icon: '📈', colorKey: 'emerald', pct: 40, desc: 'Composição de longo prazo — consistência acima de timing.' },
      { id: 'patrimonio',  label: 'Patrimônio',  icon: '🏠', colorKey: 'violet',  pct: 20, desc: 'Ativos reais — casa e carro com apreciação de longo prazo.' },
      { id: 'legado',      label: 'Legado',      icon: '👨‍👩‍👧‍👦', colorKey: 'orange',  pct: 10, desc: 'Impacto intergeracional — educação dos filhos e holding familiar.' },
    ];

    merged.walletVersions = [{
      from: startMonth,
      layers: LAYER_DEFS.map(def => ({
        id: def.id,
        label: def.label,
        icon: def.icon,
        colorKey: def.colorKey,
        description: def.desc,
        pct: def.pct,
        sublayers: def.id === 'crescimento'
          ? crescimentoSublayers
          : (byLayer[def.id] ?? []),
      })),
    }];
  }

  return merged;
```

- [ ] **Step 3: Run the dev server and open Carteira tab to verify no crash**

```bash
npm run dev
```
Open http://localhost:5173, navigate to Planejador → Carteira. Should load without errors. The existing CarteiraTab.jsx is still in use at this point — this step just ensures the migration runs without breaking anything.

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/usePlannerState.js
git commit -m "feat: add walletVersions field with migration from savingsRows/investmentClasses"
```

---

## Task 4: CarteiraDashboard

**Files:**
- Create: `src/pages/planner/carteira/CarteiraDashboard.jsx`

The dashboard reads from the active wallet version to compute current balances. It uses `useInvestments()` for live investment values and tagged transactions passed as a prop.

- [ ] **Step 1: Create CarteiraDashboard.jsx**

```jsx
// src/pages/planner/carteira/CarteiraDashboard.jsx
import { Shimmer } from '@/components/ui/shimmer';
import { formatBRL, PRIORITY_ORDER, resolveLayerColors } from './constants';
import { getActiveVersion, sublayerMonthlyAmount } from './walletVersion';

function getSubBalance(sublayer, investments, getCurrentValue, taggedTransactions) {
  const invs = investments.filter(inv => inv.plannerGoalId === sublayer.id && inv.status !== 'closed');
  const txs = (taggedTransactions[sublayer.id] ?? []);
  const auto = invs.reduce((s, i) => s + getCurrentValue(i), 0) + txs.reduce((s, t) => s + (t.amount || 0), 0);
  return auto > 0 ? auto : (sublayer.manualBalance ?? 0);
}

export default function CarteiraDashboard({
  walletVersions,
  selectedMonth,
  poupancaValue,
  investments,
  getCurrentValue,
  invLoading,
  taggedTransactions,
}) {
  const activeVersion = getActiveVersion(walletVersions, selectedMonth);
  const layers = activeVersion?.layers ?? [];
  const allSublayers = layers.flatMap(l => l.sublayers ?? []);

  // Total patrimony: live investments + manual balances for unlInked sublayers
  const totalInvested = investments
    .filter(inv => inv.status !== 'closed')
    .reduce((s, inv) => s + getCurrentValue(inv), 0);
  const totalManualOnly = allSublayers
    .filter(sub => {
      const hasInv = investments.some(inv => inv.plannerGoalId === sub.id && inv.status !== 'closed');
      const hasTx = (taggedTransactions[sub.id] ?? []).length > 0;
      return !hasInv && !hasTx && (sub.manualBalance ?? 0) > 0;
    })
    .reduce((s, sub) => s + sub.manualBalance, 0);
  const totalPatrimonio = totalInvested + totalManualOnly;

  // Emergency fund
  const emergSub = allSublayers.find(s => s.id === 'emergencia');
  const emergBalance = emergSub ? getSubBalance(emergSub, investments, getCurrentValue, taggedTransactions) : 0;
  const emergTarget = emergSub?.goalTarget ?? 120000;
  const monthlyExpenses = emergTarget / 6;
  const mesesCobertos = monthlyExpenses > 0 ? Math.floor(emergBalance / monthlyExpenses) : 0;
  const emergPct = emergTarget > 0 ? Math.min(100, (emergBalance / emergTarget) * 100) : 0;
  const emergColor = emergPct >= 100 ? '#10b981' : emergPct >= 50 ? '#f59e0b' : '#ef4444';

  // Priority focus — first incomplete goal by PRIORITY_ORDER
  const subBalances = {};
  allSublayers.forEach(sub => {
    subBalances[sub.id] = getSubBalance(sub, investments, getCurrentValue, taggedTransactions);
  });
  const sorted = [...allSublayers].sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a.id);
    const ib = PRIORITY_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const focusSub = sorted.find(s => (s.goalTarget ?? 0) > 0 && subBalances[s.id] < s.goalTarget) ?? null;
  const focusBalance = focusSub ? subBalances[focusSub.id] : 0;
  const focusPct = focusSub ? Math.min(100, (focusBalance / focusSub.goalTarget) * 100) : 0;

  // Find which layer the focus sub belongs to
  const focusLayer = focusSub ? layers.find(l => l.sublayers.some(s => s.id === focusSub.id)) : null;
  const focusColors = focusLayer ? resolveLayerColors(focusLayer.id, focusLayer.colorKey, 0) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Patrimônio total */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-4 col-span-2 sm:col-span-1">
        <p className="text-xs text-gray-400 mb-1">Patrimônio total</p>
        {invLoading ? (
          <Shimmer className="h-7 w-3/4 rounded-lg" />
        ) : (
          <p className="text-xl font-bold text-white tabular-nums">{formatBRL.format(totalPatrimonio)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">investimentos + reservas</p>
      </div>

      {/* Disponível p/ investir */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disponível p/ investir</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{formatBRL.format(poupancaValue)}</p>
        <p className="text-xs text-gray-400 mt-1">alocação poupança</p>
      </div>

      {/* Fundo emergência */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fundo emergência</p>
        {invLoading ? (
          <Shimmer className="h-6 w-2/3 rounded" />
        ) : (
          <div className="flex items-end gap-1">
            <p className="text-lg font-bold tabular-nums" style={{ color: emergColor }}>{mesesCobertos}</p>
            <p className="text-xs text-gray-400 mb-0.5">/ 6 meses</p>
          </div>
        )}
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-2">
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${emergPct}%`, backgroundColor: emergColor }} />
        </div>
      </div>

      {/* Foco atual */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Foco atual</p>
          {focusSub && focusColors && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${focusColors.badge}`}>
              {focusSub.icon}
            </span>
          )}
        </div>
        {invLoading ? (
          <Shimmer className="h-6 w-2/3 rounded" />
        ) : focusSub ? (
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">{focusSub.label}</p>
        ) : (
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Todas as metas atingidas 🎉</p>
        )}
        {focusSub && !invLoading && (
          <>
            <p className="text-xs text-gray-400 mt-0.5 tabular-nums truncate">
              {formatBRL.format(focusBalance)} / {formatBRL.format(focusSub.goalTarget)}
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1.5">
              <div className={`h-1.5 rounded-full transition-all ${focusColors?.bar ?? 'bg-gray-400'}`} style={{ width: `${focusPct}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/CarteiraDashboard.jsx
git commit -m "feat: add CarteiraDashboard using walletVersions active version"
```

---

## Task 5: LayerModal

**Files:**
- Create: `src/pages/planner/carteira/LayerModal.jsx`

- [ ] **Step 1: Create LayerModal.jsx**

```jsx
// src/pages/planner/carteira/LayerModal.jsx
import { useState, useEffect } from 'react';
import { LAYER_COLOR_PALETTE } from './constants';

export default function LayerModal({ layer, onSave, onDelete, onClose }) {
  const isNew = !layer;
  const [icon, setIcon] = useState(layer?.icon ?? '📁');
  const [label, setLabel] = useState(layer?.label ?? '');
  const [description, setDescription] = useState(layer?.description ?? '');
  const [colorKey, setColorKey] = useState(layer?.colorKey ?? 'blue');

  useEffect(() => {
    if (layer) { setIcon(layer.icon); setLabel(layer.label); setDescription(layer.description ?? ''); setColorKey(layer.colorKey ?? 'blue'); }
  }, [layer]);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ icon: icon.trim() || '📁', label: label.trim(), description: description.trim(), colorKey });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{isNew ? 'Nova Camada' : 'Editar Camada'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">✕</button>
        </div>

        {/* Icon + Label */}
        <div className="flex gap-3">
          <div className="w-16">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Ícone</label>
            <input
              type="text"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              maxLength={2}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Nome</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Aposentadoria"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Descrição <span className="font-normal">(opcional)</span></label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Breve descrição do objetivo desta camada"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Color */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {LAYER_COLOR_PALETTE.map(p => (
              <button
                key={p.key}
                onClick={() => setColorKey(p.key)}
                className={`w-8 h-8 rounded-full ${p.bar} transition-transform ${colorKey === p.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                title={p.key}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            {isNew ? 'Criar camada' : 'Salvar'}
          </button>
          {!isNew && onDelete && (
            <button
              onClick={onDelete}
              className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/LayerModal.jsx
git commit -m "feat: add LayerModal for creating and editing wallet layers"
```

---

## Task 6: SublayerModal

**Files:**
- Create: `src/pages/planner/carteira/SublayerModal.jsx`

- [ ] **Step 1: Create SublayerModal.jsx**

```jsx
// src/pages/planner/carteira/SublayerModal.jsx
import { useState, useEffect } from 'react';
import { SUBLAYER_TYPE_OPTIONS, formatBRL } from './constants';
import { netReturn } from './walletVersion';

export default function SublayerModal({ sublayer, layerMonthlyAmount, onSave, onDelete, onClose }) {
  const isNew = !sublayer;

  const [icon, setIcon] = useState(sublayer?.icon ?? '💰');
  const [label, setLabel] = useState(sublayer?.label ?? '');
  const [type, setType] = useState(sublayer?.type ?? 'Renda Fixa');
  const [bank, setBank] = useState(sublayer?.bank ?? '');
  const [description, setDescription] = useState(sublayer?.description ?? '');
  const [mode, setMode] = useState(sublayer?.mode ?? 'pct');
  const [pct, setPct] = useState(String(sublayer?.pct ?? 0));
  const [value, setValue] = useState(String(sublayer?.value ?? 0));
  const [goalTarget, setGoalTarget] = useState(String(sublayer?.goalTarget ?? 0));
  const [hasGoal, setHasGoal] = useState((sublayer?.goalTarget ?? 0) > 0);
  const [returnPct, setReturnPct] = useState(String(sublayer?.returnPct ?? 1.0));
  const [taxRate, setTaxRate] = useState(String(sublayer?.taxRate ?? 15));

  useEffect(() => {
    if (sublayer) {
      setIcon(sublayer.icon); setLabel(sublayer.label); setType(sublayer.type ?? 'Renda Fixa');
      setBank(sublayer.bank ?? ''); setDescription(sublayer.description ?? '');
      setMode(sublayer.mode ?? 'pct'); setPct(String(sublayer.pct ?? 0)); setValue(String(sublayer.value ?? 0));
      setGoalTarget(String(sublayer.goalTarget ?? 0)); setHasGoal((sublayer.goalTarget ?? 0) > 0);
      setReturnPct(String(sublayer.returnPct ?? 1.0)); setTaxRate(String(sublayer.taxRate ?? 15));
    }
  }, [sublayer]);

  const parsedReturnPct = parseFloat(returnPct) || 0;
  const parsedTaxRate = parseFloat(taxRate) || 0;
  const net = netReturn(parsedReturnPct, parsedTaxRate);

  const parsedPct = parseFloat(pct) || 0;
  const monthlyContrib = mode === 'pct' ? layerMonthlyAmount * (parsedPct / 100) : (parseFloat(value) || 0);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      icon: icon.trim() || '💰',
      label: label.trim(),
      type,
      bank,
      description: description.trim(),
      mode,
      pct: parseFloat(pct) || 0,
      value: parseFloat(value) || 0,
      goalTarget: hasGoal ? (parseFloat(goalTarget) || 0) : 0,
      returnPct: parseFloat(returnPct) || 1.0,
      taxRate: parseFloat(taxRate) || 15,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{isNew ? 'Novo Sublayer' : 'Editar Sublayer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">✕</button>
        </div>

        {/* Icon + Label */}
        <div className="flex gap-3">
          <div className="w-16">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Ícone</label>
            <input type="text" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Nome</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Fundo Emergência"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        {/* Type + Bank */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
              {SUBLAYER_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Banco / Corretora</label>
            <input type="text" value={bank} onChange={e => setBank(e.target.value)}
              placeholder="Ex: Nubank, XP, BTG..."
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        {/* Return + Tax */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Retorno bruto % a.m.</label>
            <input type="number" value={returnPct} onChange={e => setReturnPct(e.target.value)} step="0.1" min="0"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Líq: {net.toFixed(3)}% a.m.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Alíquota IRPF %</label>
            <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} step="1" min="0" max="100"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        {/* Contribution mode */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2">Aporte mensal</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setMode('pct')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === 'pct' ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              % da camada
            </button>
            <button onClick={() => setMode('value')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mode === 'value' ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              Valor fixo R$
            </button>
          </div>
          {mode === 'pct' ? (
            <div className="flex items-center gap-2">
              <input type="number" value={pct} onChange={e => setPct(e.target.value)} step="1" min="0" max="100"
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <span className="text-xs text-gray-400">% → {formatBRL.format(monthlyContrib)}/mês</span>
            </div>
          ) : (
            <input type="number" value={value} onChange={e => setValue(e.target.value)} step="10" min="0"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ex: 500" />
          )}
        </div>

        {/* Goal target */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-2">Meta</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setHasGoal(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${hasGoal ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              Com meta
            </button>
            <button onClick={() => setHasGoal(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!hasGoal ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              Reserva contínua
            </button>
          </div>
          {hasGoal && (
            <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} step="1000" min="0"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ex: 120000" />
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Descrição <span className="font-normal">(opcional)</span></label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Ex: CDB liq. diária / Tesouro Selic 2027"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!label.trim()}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
            {isNew ? 'Criar sublayer' : 'Salvar'}
          </button>
          {!isNew && onDelete && (
            <button onClick={onDelete}
              className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-rose-100 transition-colors">
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/SublayerModal.jsx
git commit -m "feat: add SublayerModal with all sublayer fields"
```

---

## Task 7: WalletSublayerCard

**Files:**
- Create: `src/pages/planner/carteira/WalletSublayerCard.jsx`

- [ ] **Step 1: Create WalletSublayerCard.jsx**

```jsx
// src/pages/planner/carteira/WalletSublayerCard.jsx
import { Shimmer } from '@/components/ui/shimmer';
import { formatBRL, resolveLayerColors, INSTRUMENT_TYPE_COLORS } from './constants';
import { sublayerMonthlyAmount, netReturn } from './walletVersion';
import { useState } from 'react';

function getSubBalance(sublayer, investments, getCurrentValue, taggedTransactions) {
  const invs = investments.filter(inv => inv.plannerGoalId === sublayer.id && inv.status !== 'closed');
  const txs = taggedTransactions[sublayer.id] ?? [];
  const auto = invs.reduce((s, i) => s + getCurrentValue(i), 0) + txs.reduce((s, t) => s + (t.amount || 0), 0);
  return auto > 0 ? auto : (sublayer.manualBalance ?? 0);
}

export default function WalletSublayerCard({
  sublayer,
  layerMonthlyAmount,
  layerId,
  layerColorKey,
  layerIndex,
  investments,
  getCurrentValue,
  invLoading,
  taggedTransactions,
  readOnly,
  onEdit,
}) {
  const [showInstruments, setShowInstruments] = useState(false);
  const colors = resolveLayerColors(layerId, layerColorKey, layerIndex);

  const monthlyContrib = sublayerMonthlyAmount(sublayer, layerMonthlyAmount);
  const net = netReturn(sublayer.returnPct ?? 1.0, sublayer.taxRate ?? 15);
  const currentBalance = getSubBalance(sublayer, investments, getCurrentValue, taggedTransactions);
  const goalTarget = sublayer.goalTarget ?? 0;
  const isOngoing = goalTarget === 0;
  const progressPct = !isOngoing && goalTarget > 0 ? Math.min(100, (currentBalance / goalTarget) * 100) : 0;
  const remaining = Math.max(0, goalTarget - currentBalance);
  const goalReached = !isOngoing && currentBalance >= goalTarget && goalTarget > 0;

  const taggedInvs = investments.filter(inv => inv.plannerGoalId === sublayer.id && inv.status !== 'closed');
  const taggedTxs = taggedTransactions[sublayer.id] ?? [];
  const hasAutoData = (taggedInvs.length + taggedTxs.length) > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{sublayer.icon}</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{sublayer.label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${INSTRUMENT_TYPE_COLORS[sublayer.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
            {sublayer.type ?? 'Outro'}
          </span>
          {!readOnly && (
            <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs transition-colors" title="Editar sublayer">✏️</button>
          )}
        </div>
      </div>

      {/* Description */}
      {sublayer.description && (
        <p className="text-xs text-gray-400">{sublayer.description}</p>
      )}

      {/* Instruments toggle */}
      {sublayer.instruments?.length > 0 && (
        <div>
          <button onClick={() => setShowInstruments(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors">
            <span>{showInstruments ? '▾' : '▸'}</span>
            <span>Onde investir</span>
          </button>
          {showInstruments && (
            <div className="mt-1.5 space-y-1">
              {sublayer.instruments.map((inst, i) => {
                const tc = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${tc}`}>{inst.type}</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{inst.name}</span>
                    </div>
                    <span className="text-xs tabular-nums text-gray-400 shrink-0">{inst.alloc}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Linked records */}
      <div className="space-y-1.5">
        {invLoading ? (
          <Shimmer className="h-7 w-full rounded-lg" />
        ) : hasAutoData ? (
          <>
            {taggedInvs.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{inv.name}</span>
                  {inv.bank && <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${colors.chip}`}>{inv.bank}</span>}
                </div>
                <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">{formatBRL.format(getCurrentValue(inv))}</span>
              </div>
            ))}
            {taggedTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">{tx.description}</span>
                <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-gray-300 ml-2 shrink-0">{formatBRL.format(tx.amount)}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {/* Stats + Progress */}
      <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Atual</span>
          <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{formatBRL.format(currentBalance)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Retorno bruto</span>
          <span className="tabular-nums">{(sublayer.returnPct ?? 1.0).toFixed(2)}% a.m.</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Líquido (IRPF {sublayer.taxRate ?? 15}%)</span>
          <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">{net.toFixed(3)}% a.m.</span>
        </div>
        {!isOngoing && (
          <>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Meta</span>
              <span className="tabular-nums">{formatBRL.format(goalTarget)}</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${colors.bar}`} style={{ width: `${progressPct}%` }} />
            </div>
            {goalReached ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-center">Meta atingida! 🎉</p>
            ) : (
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Faltam</span>
                <span className="tabular-nums">{formatBRL.format(remaining)}</span>
              </div>
            )}
          </>
        )}
        {isOngoing && <p className="text-xs text-gray-400 italic">Reserva contínua</p>}
      </div>

      {/* Footer: monthly contribution */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
        <span>Aporte este mês</span>
        <span className="tabular-nums font-semibold text-gray-700 dark:text-gray-300">{formatBRL.format(monthlyContrib)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/WalletSublayerCard.jsx
git commit -m "feat: add WalletSublayerCard with IRPF display and linked records"
```

---

## Task 8: LayerAllocationEditor

**Files:**
- Create: `src/pages/planner/carteira/LayerAllocationEditor.jsx`

- [ ] **Step 1: Create LayerAllocationEditor.jsx**

```jsx
// src/pages/planner/carteira/LayerAllocationEditor.jsx
import { useState } from 'react';
import { formatBRL, resolveLayerColors, LAYER_COLOR_PALETTE } from './constants';
import LayerModal from './LayerModal';

export default function LayerAllocationEditor({ layers, poupancaValue, onUpdateLayers, readOnly }) {
  const [showAddLayer, setShowAddLayer] = useState(false);
  const totalPct = layers.reduce((s, l) => s + (l.pct ?? 0), 0);
  const overAllocated = totalPct > 100;
  const underAllocated = totalPct < 100;

  const handlePctChange = (layerId, newPct) => {
    onUpdateLayers(layers.map(l => l.id === layerId ? { ...l, pct: Math.max(0, Math.min(100, newPct)) } : l));
  };

  const handleAddLayer = ({ icon, label, description, colorKey }) => {
    const id = `layer-${Date.now()}`;
    onUpdateLayers([...layers, { id, label, icon, colorKey, description, pct: 0, sublayers: [] }]);
    setShowAddLayer(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Alocação por Camada</p>
        <span className="text-xs text-gray-400 tabular-nums">{formatBRL.format(poupancaValue)}/mês</span>
      </div>

      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden flex mb-4">
        {layers.map((layer, i) => {
          const colors = resolveLayerColors(layer.id, layer.colorKey, i);
          const width = poupancaValue > 0 ? Math.min(100, layer.pct ?? 0) : 0;
          return <div key={layer.id} className={`h-2 ${colors.bar}`} style={{ width: `${width}%` }} />;
        })}
        {underAllocated && <div className="h-2 bg-gray-200 dark:bg-gray-600 flex-1" />}
      </div>

      {/* Layer tiles */}
      <div className="grid grid-cols-2 gap-2">
        {layers.map((layer, i) => {
          const colors = resolveLayerColors(layer.id, layer.colorKey, i);
          const monthly = poupancaValue * ((layer.pct ?? 0) / 100);
          return (
            <div key={layer.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${colors.tile} ${colors.tileBorder}`}>
              <span className="text-base shrink-0">{layer.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${colors.tileText} truncate`}>{layer.label}</p>
                <p className="text-xs text-gray-400 tabular-nums">{formatBRL.format(monthly)}/mês</p>
              </div>
              {!readOnly ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={layer.pct ?? 0}
                    onChange={e => handlePctChange(layer.id, parseFloat(e.target.value) || 0)}
                    className={`w-10 border rounded-md px-1 py-0.5 text-xs font-bold text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 ${colors.input}`}
                    min={0} max={100}
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              ) : (
                <span className={`text-xs font-bold tabular-nums ${colors.tileText}`}>{layer.pct ?? 0}%</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Total validation */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
        <span className={`font-medium ${overAllocated ? 'text-rose-500' : underAllocated ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {overAllocated ? `⚠ Excesso: ${totalPct - 100}% sobre-alocado` : underAllocated ? `${100 - totalPct}% não alocado` : '✓ Totalmente alocado'}
        </span>
        <span className="tabular-nums text-gray-400">{totalPct}% / 100%</span>
      </div>

      {!readOnly && (
        <button
          onClick={() => setShowAddLayer(true)}
          className="mt-3 w-full py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-1"
        >
          + Adicionar camada
        </button>
      )}

      {showAddLayer && (
        <LayerModal onSave={handleAddLayer} onClose={() => setShowAddLayer(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/LayerAllocationEditor.jsx
git commit -m "feat: add LayerAllocationEditor with stacked bar and % inputs"
```

---

## Task 9: WalletLayerSection

**Files:**
- Create: `src/pages/planner/carteira/WalletLayerSection.jsx`

- [ ] **Step 1: Create WalletLayerSection.jsx**

```jsx
// src/pages/planner/carteira/WalletLayerSection.jsx
import { useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL, resolveLayerColors, INSTRUMENT_TYPE_COLORS } from './constants';
import { sublayerMonthlyAmount } from './walletVersion';
import WalletSublayerCard from './WalletSublayerCard';
import SublayerModal from './SublayerModal';
import LayerModal from './LayerModal';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default function WalletLayerSection({
  layer,
  layerIndex,
  poupancaValue,
  investments,
  getCurrentValue,
  invLoading,
  taggedTransactions,
  readOnly,
  onUpdateLayer,
  onDeleteLayer,
}) {
  const { geminiApiKey } = useSettings();
  const colors = resolveLayerColors(layer.id, layer.colorKey, layerIndex);
  const layerMonthlyAmount = poupancaValue * ((layer.pct ?? 0) / 100);

  const [showEditLayer, setShowEditLayer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingSublayer, setEditingSublayer] = useState(null); // null = closed, 'new' = new, object = editing
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const handleSaveSublayer = (data) => {
    if (editingSublayer === 'new') {
      const newSub = { id: `sub-${Date.now()}`, ...data, instruments: [], manualBalance: 0 };
      onUpdateLayer({ ...layer, sublayers: [...(layer.sublayers ?? []), newSub] });
    } else {
      onUpdateLayer({ ...layer, sublayers: layer.sublayers.map(s => s.id === editingSublayer.id ? { ...s, ...data } : s) });
    }
    setEditingSublayer(null);
  };

  const handleDeleteSublayer = () => {
    onUpdateLayer({ ...layer, sublayers: layer.sublayers.filter(s => s.id !== editingSublayer.id) });
    setEditingSublayer(null);
  };

  const handleSaveLayer = (data) => {
    onUpdateLayer({ ...layer, ...data });
    setShowEditLayer(false);
  };

  const handleResearch = async () => {
    if (!geminiApiKey) return;
    setAiLoading(true); setAiError(''); setAiResult(null);
    const goals = (layer.sublayers ?? []).map(s =>
      `- id: "${s.id}" | label: "${s.label}" | meta: R$ ${s.goalTarget ?? 0} | aporte: ${formatBRL.format(sublayerMonthlyAmount(s, layerMonthlyAmount))}/mês`
    ).join('\n');
    const prompt = `Você é um consultor financeiro brasileiro especializado em investimentos PJ em 2026.
Analise a camada "${layer.label}" e retorne SOMENTE JSON válido, sem markdown.
CAMADA: ${layer.label} — ${layer.description ?? ''}
SUBLAYERS:\n${goals}
Regras: use instrumentos reais disponíveis em 2026 no Brasil. Alocação por sublayer deve somar 100%.
Schema: { "layerInsight": "análise em 1-2 frases", "goalRecommendations": [{ "goalId": "id", "goalLabel": "nome", "instruments": [{ "name": "...", "type": "Renda Fixa|FII|ETF|Ações|Cripto", "alloc": 0, "reason": "..." }] }] }`;
    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1400 } }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Erro HTTP ${res.status}`); }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      setAiResult(JSON.parse(cleaned));
    } catch (e) { setAiError(e.message || 'Erro desconhecido'); }
    finally { setAiLoading(false); }
  };

  const handleApplyGoal = (goalId, instruments) => {
    onUpdateLayer({ ...layer, sublayers: layer.sublayers.map(s => s.id === goalId ? { ...s, instruments } : s) });
    setAiResult(prev => prev ? { ...prev, goalRecommendations: prev.goalRecommendations.filter(g => g.goalId !== goalId) } : null);
  };

  return (
    <div className="space-y-3">
      {/* Layer header */}
      <div className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border ${colors.header}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base shrink-0">{layer.icon}</span>
          <div className="min-w-0">
            <p className={`text-xs font-bold uppercase tracking-wide ${colors.title}`}>{layer.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {layer.description ?? ''} · {formatBRL.format(layerMonthlyAmount)}/mês
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {geminiApiKey && (
            <button onClick={handleResearch} disabled={aiLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {aiLoading ? '...' : '✨'}
            </button>
          )}
          {!readOnly && (
            <>
              <button onClick={() => setShowEditLayer(true)}
                className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">✏️</button>
              <button onClick={() => setConfirmDelete(true)}
                className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">🗑</button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-rose-700 dark:text-rose-300">Excluir camada <strong>{layer.label}</strong> e todos os seus sublayers?</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { onDeleteLayer(); setConfirmDelete(false); }}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold">Confirmar</button>
            <button onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {/* AI result panel */}
      {(aiResult || aiError) && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-3">
          {aiError && <p className="text-xs text-rose-600 dark:text-rose-400">{aiError}</p>}
          {aiResult && (
            <>
              {aiResult.layerInsight && <p className="text-xs text-violet-700 dark:text-violet-300 font-medium">{aiResult.layerInsight}</p>}
              {aiResult.goalRecommendations?.map(rec => (
                <div key={rec.goalId} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{rec.goalLabel}</p>
                    <button onClick={() => handleApplyGoal(rec.goalId, rec.instruments)}
                      className="text-xs px-2 py-0.5 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-semibold transition-colors">Aplicar</button>
                  </div>
                  {rec.instruments?.map((inst, i) => {
                    const tc = INSTRUMENT_TYPE_COLORS[inst.type] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${tc}`}>{inst.type}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-gray-700 dark:text-gray-300">{inst.name}</span>
                          {inst.reason && <span className="text-xs text-gray-400 ml-1">— {inst.reason}</span>}
                        </div>
                        <span className="text-xs tabular-nums text-gray-400 shrink-0">{inst.alloc}%</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {aiResult.goalRecommendations?.length === 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Todas as sugestões aplicadas ✓</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Sublayer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-1">
        {(layer.sublayers ?? []).map(sub => (
          <WalletSublayerCard
            key={sub.id}
            sublayer={sub}
            layerMonthlyAmount={layerMonthlyAmount}
            layerId={layer.id}
            layerColorKey={layer.colorKey}
            layerIndex={layerIndex}
            investments={investments}
            getCurrentValue={getCurrentValue}
            invLoading={invLoading}
            taggedTransactions={taggedTransactions}
            readOnly={readOnly}
            onEdit={() => setEditingSublayer(sub)}
          />
        ))}

        {!readOnly && (
          <button
            onClick={() => setEditingSublayer('new')}
            className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl p-4 flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 transition-colors min-h-[80px]"
          >
            <span className="text-base">+</span> Adicionar sublayer
          </button>
        )}
      </div>

      {/* Modals */}
      {showEditLayer && (
        <LayerModal layer={layer} onSave={handleSaveLayer} onClose={() => setShowEditLayer(false)} />
      )}
      {editingSublayer !== null && (
        <SublayerModal
          sublayer={editingSublayer === 'new' ? null : editingSublayer}
          layerMonthlyAmount={layerMonthlyAmount}
          onSave={handleSaveSublayer}
          onDelete={editingSublayer !== 'new' ? handleDeleteSublayer : undefined}
          onClose={() => setEditingSublayer(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/WalletLayerSection.jsx
git commit -m "feat: add WalletLayerSection with edit/delete/AI research and sublayer management"
```

---

## Task 10: GoalPriorityModal + AnalysePanel

**Files:**
- Create: `src/pages/planner/carteira/GoalPriorityModal.jsx`
- Create: `src/pages/planner/carteira/AnalysePanel.jsx`

- [ ] **Step 1: Create GoalPriorityModal.jsx**

```jsx
// src/pages/planner/carteira/GoalPriorityModal.jsx
import { useState, useRef } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatBRL } from './constants';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default function GoalPriorityModal({ layers, poupancaValue, onSuggestions, onClose }) {
  const { geminiApiKey } = useSettings();
  const [orderedSublayers, setOrderedSublayers] = useState(() =>
    layers.flatMap(l => (l.sublayers ?? []).map(s => ({ ...s, layerLabel: l.label })))
  );
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dragIdx = useRef(null);

  const handleDragStart = (i) => { dragIdx.current = i; };
  const handleDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const newOrder = [...orderedSublayers];
    const [moved] = newOrder.splice(dragIdx.current, 1);
    newOrder.splice(i, 0, moved);
    dragIdx.current = i;
    setOrderedSublayers(newOrder);
  };
  const handleDrop = () => { dragIdx.current = null; };

  const handleAnalyse = async () => {
    if (!geminiApiKey) { setError('Chave Gemini não configurada em Configurações.'); return; }
    setLoading(true); setError('');
    const priorityList = orderedSublayers.map((s, i) => `${i + 1}. [${s.layerLabel}] ${s.label} — meta: R$ ${s.goalTarget ?? 0}`).join('\n');
    const layerSummary = layers.map(l => `- ${l.label} (${l.pct}% = ${formatBRL.format(poupancaValue * l.pct / 100)}/mês, ${(l.sublayers ?? []).length} sublayers)`).join('\n');
    const prompt = `Você é um consultor financeiro brasileiro especializado em planejamento PJ 2026.
Analise esta carteira de investimentos e retorne SOMENTE JSON válido, sem markdown.

DISPONÍVEL P/ INVESTIR: ${formatBRL.format(poupancaValue)}/mês

CAMADAS ATUAIS:
${layerSummary}

PRIORIDADE DE OBJETIVOS (do usuário):
${priorityList}

${context ? `CONTEXTO ADICIONAL: ${context}` : ''}

Retorne sugestões de melhoria como array. Cada sugestão deve ser acionável.
Schema: {
  "suggestions": [
    {
      "type": "allocation" | "instrument" | "sublayer",
      "title": "título curto da sugestão",
      "reason": "justificativa em 1-2 frases",
      "patch": {
        "layerId": "id da camada afetada (se aplicável)",
        "sublayerId": "id do sublayer afetado (se aplicável)",
        "newPct": 0,
        "instruments": []
      }
    }
  ]
}`;
    try {
      const res = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 2000 } }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err?.error?.message || `Erro HTTP ${res.status}`); }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      onSuggestions(parsed.suggestions ?? []);
      onClose();
    } catch (e) { setError(e.message || 'Erro desconhecido'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">✨ Analisar Carteira</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">✕</button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Ordene seus objetivos por prioridade. A IA vai balancear sua carteira respeitando essa ordem.</p>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Arraste para reordenar</p>
          <div className="space-y-2">
            {orderedSublayers.map((sub, i) => (
              <div
                key={sub.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={handleDrop}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 cursor-grab active:cursor-grabbing select-none"
              >
                <span className="text-gray-300 dark:text-gray-500 text-sm">⠿</span>
                <span className="text-base">{sub.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{sub.label}</p>
                  <p className="text-xs text-gray-400">{sub.layerLabel}{sub.goalTarget > 0 ? ` · meta ${formatBRL.format(sub.goalTarget)}` : ''}</p>
                </div>
                <span className="text-xs font-bold text-gray-300 dark:text-gray-500 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-md px-2 py-0.5">#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Contexto adicional <span className="font-normal">(opcional)</span></label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Ex: estou pensando em trocar de carro em 2027..."
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none h-16"
          />
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Gerando análise...</>
          ) : 'Gerar análise com IA →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AnalysePanel.jsx**

```jsx
// src/pages/planner/carteira/AnalysePanel.jsx
import { useState } from 'react';
import GoalPriorityModal from './GoalPriorityModal';

const TYPE_BADGE = {
  allocation:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  instrument:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  sublayer:    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
};

export default function AnalysePanel({ layers, poupancaValue, onApplySuggestions, readOnly }) {
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [accepted, setAccepted] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());

  const handleSuggestions = (list) => {
    setSuggestions(list);
    setAccepted(new Set());
    setRejected(new Set());
  };

  const toggle = (i, type) => {
    if (type === 'accept') {
      setAccepted(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
      setRejected(prev => { const s = new Set(prev); s.delete(i); return s; });
    } else {
      setRejected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
      setAccepted(prev => { const s = new Set(prev); s.delete(i); return s; });
    }
  };

  const handleSave = () => {
    const toApply = suggestions.filter((_, i) => accepted.has(i));
    onApplySuggestions(toApply);
    setSuggestions([]);
    setAccepted(new Set());
    setRejected(new Set());
  };

  const pending = suggestions.filter((_, i) => !accepted.has(i) && !rejected.has(i)).length;

  return (
    <div className="space-y-3">
      {/* CTA button */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">✨ Analisar Carteira</p>
          <p className="text-xs text-indigo-200 mt-0.5">IA analisa seus objetivos e sugere rebalanceamento completo</p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          >
            Analisar →
          </button>
        )}
      </div>

      {/* Suggestions panel */}
      {suggestions.length > 0 && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
              {accepted.size} aceitas · {rejected.size} rejeitadas · {pending} pendentes
            </p>
            <button onClick={() => { setSuggestions([]); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕ Limpar</button>
          </div>

          {suggestions.map((s, i) => {
            const isAccepted = accepted.has(i);
            const isRejected = rejected.has(i);
            return (
              <div key={i} className={`bg-white dark:bg-gray-800 rounded-xl p-3 border transition-all ${isAccepted ? 'border-emerald-300 dark:border-emerald-700' : isRejected ? 'border-gray-200 dark:border-gray-700 opacity-50' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${TYPE_BADGE[s.type] ?? TYPE_BADGE.allocation}`}>
                        {s.type === 'allocation' ? 'Alocação' : s.type === 'instrument' ? 'Instrumento' : 'Sublayer'}
                      </span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{s.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.reason}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 mt-0.5">
                    <button
                      onClick={() => toggle(i, 'accept')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${isAccepted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
                    >✓</button>
                    <button
                      onClick={() => toggle(i, 'reject')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${isRejected ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'}`}
                    >✕</button>
                  </div>
                </div>
              </div>
            );
          })}

          {accepted.size > 0 && (
            <button
              onClick={handleSave}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-xs font-bold transition-colors"
            >
              Salvar {accepted.size} mudança{accepted.size > 1 ? 's' : ''} aceita{accepted.size > 1 ? 's' : ''} →
            </button>
          )}
        </div>
      )}

      {showModal && (
        <GoalPriorityModal
          layers={layers}
          poupancaValue={poupancaValue}
          onSuggestions={handleSuggestions}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/carteira/GoalPriorityModal.jsx src/pages/planner/carteira/AnalysePanel.jsx
git commit -m "feat: add GoalPriorityModal and AnalysePanel for AI wallet analysis"
```

---

## Task 11: CarteiraTab root component

**Files:**
- Create: `src/pages/planner/carteira/index.jsx`

- [ ] **Step 1: Create index.jsx**

```jsx
// src/pages/planner/carteira/index.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments } from '@/contexts/InvestmentContext';
import { getActiveVersion, updateWalletForMonth } from './walletVersion';
import CarteiraDashboard from './CarteiraDashboard';
import LayerAllocationEditor from './LayerAllocationEditor';
import WalletLayerSection from './WalletLayerSection';
import AnalysePanel from './AnalysePanel';

export default function CarteiraTab({ state, update, poupancaValue, selectedMonth }) {
  const { ownerId } = useAccess();
  const { investments, getCurrentValue, loading: invLoading } = useInvestments();
  const [taggedTransactions, setTaggedTransactions] = useState({});

  // Fetch transactions tagged to planner goals
  useEffect(() => {
    if (!ownerId) return;
    const fetchTagged = async () => {
      try {
        const q = query(collection(db, 'transactions'), where('userId', '==', ownerId), where('amount', '>', 0));
        const snap = await getDocs(q);
        const byGoal = {};
        snap.forEach(d => {
          const tx = { id: d.id, ...d.data() };
          if (tx.plannerGoalId) {
            if (!byGoal[tx.plannerGoalId]) byGoal[tx.plannerGoalId] = [];
            byGoal[tx.plannerGoalId].push(tx);
          }
        });
        setTaggedTransactions(byGoal);
      } catch (err) {
        console.error('[CarteiraTab] Error fetching tagged transactions:', err);
      }
    };
    fetchTagged();
  }, [ownerId]);

  const walletVersions = state.walletVersions ?? [];
  const activeVersion = getActiveVersion(walletVersions, selectedMonth);
  const layers = activeVersion?.layers ?? [];

  // Determine if selected month is in the past (read-only)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const readOnly = selectedMonth < currentMonth;

  const applyLayerPatch = (patchFn) => {
    const newVersions = updateWalletForMonth(walletVersions, selectedMonth, patchFn);
    update('walletVersions', newVersions);
  };

  const handleUpdateLayers = (newLayers) => {
    applyLayerPatch(() => newLayers);
  };

  const handleUpdateLayer = (updatedLayer) => {
    applyLayerPatch(layers => layers.map(l => l.id === updatedLayer.id ? updatedLayer : l));
  };

  const handleDeleteLayer = (layerId) => {
    applyLayerPatch(layers => layers.filter(l => l.id !== layerId));
  };

  const handleApplySuggestions = (suggestions) => {
    applyLayerPatch(currentLayers => {
      let updated = [...currentLayers];
      suggestions.forEach(s => {
        if (s.type === 'allocation' && s.patch?.layerId && s.patch?.newPct != null) {
          updated = updated.map(l => l.id === s.patch.layerId ? { ...l, pct: s.patch.newPct } : l);
        }
        if (s.type === 'instrument' && s.patch?.sublayerId && s.patch?.instruments) {
          updated = updated.map(l => ({
            ...l,
            sublayers: (l.sublayers ?? []).map(sub =>
              sub.id === s.patch.sublayerId ? { ...sub, instruments: s.patch.instruments } : sub
            ),
          }));
        }
      });
      return updated;
    });
  };

  return (
    <div className="space-y-6">
      <CarteiraDashboard
        walletVersions={walletVersions}
        selectedMonth={selectedMonth}
        poupancaValue={poupancaValue}
        investments={investments}
        getCurrentValue={getCurrentValue}
        invLoading={invLoading}
        taggedTransactions={taggedTransactions}
      />

      <AnalysePanel
        layers={layers}
        poupancaValue={poupancaValue}
        onApplySuggestions={handleApplySuggestions}
        readOnly={readOnly}
      />

      <LayerAllocationEditor
        layers={layers}
        poupancaValue={poupancaValue}
        onUpdateLayers={handleUpdateLayers}
        readOnly={readOnly}
      />

      {layers.map((layer, i) => (
        <WalletLayerSection
          key={layer.id}
          layer={layer}
          layerIndex={i}
          poupancaValue={poupancaValue}
          investments={investments}
          getCurrentValue={getCurrentValue}
          invLoading={invLoading}
          taggedTransactions={taggedTransactions}
          readOnly={readOnly}
          onUpdateLayer={handleUpdateLayer}
          onDeleteLayer={() => handleDeleteLayer(layer.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/planner/carteira/index.jsx
git commit -m "feat: add CarteiraTab root component (carteira/index.jsx)"
```

---

## Task 12: Wire PlannerPage + delete old CarteiraTab.jsx

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx`
- Delete: `src/pages/planner/CarteiraTab.jsx`

- [ ] **Step 1: Update import in PlannerPage.jsx**

Find:
```js
import CarteiraTab from './CarteiraTab';
```
Replace with:
```js
import CarteiraTab from './carteira';
```

- [ ] **Step 2: Update CarteiraTab usage in PlannerPage.jsx**

Find the existing `<CarteiraTab .../>` block (around line 176–183):
```jsx
<CarteiraTab
  state={state}
  update={update}
  isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
  savingsComputed={savingsComputed}
  carSimulationRows={carSimulationRows}
/>
```
Replace with:
```jsx
<CarteiraTab
  state={state}
  update={update}
  poupancaValue={poupancaValue}
  selectedMonth={state.selectedPlannerMonth}
/>
```

- [ ] **Step 3: Delete the old CarteiraTab.jsx**

```bash
rm src/pages/planner/CarteiraTab.jsx
```

- [ ] **Step 4: Run lint to confirm no broken imports**

```bash
npm run lint 2>&1 | grep -E "error|CarteiraTab" | head -20
```
Expected: no errors referencing CarteiraTab.

- [ ] **Step 5: Run dev server and verify the Carteira tab loads**

```bash
npm run dev
```
Open http://localhost:5173 → Planejador → Carteira tab.

Verify:
1. Dashboard strip shows with patrimony / available / emergency / focus
2. "✨ Analisar Carteira" purple gradient block is visible
3. Layer allocation editor shows the 4 layers with % inputs and stacked bar
4. Each layer section shows its sublayers with return/IRPF info
5. Edit (✏️) and delete (🗑) buttons appear on layers and sublayer cards
6. "+ Adicionar sublayer" dashed card appears at end of each layer grid
7. "+ Adicionar camada" button appears in the allocation editor
8. Navigating to a past month hides all edit buttons (read-only mode)
9. Console shows no errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git add src/pages/planner/carteira/
git rm src/pages/planner/CarteiraTab.jsx
git commit -m "feat: wire new CarteirTab from carteira/ folder, remove old CarteiraTab.jsx"
```
