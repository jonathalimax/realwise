# Portfolio Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/portfolio` page showing total invested amounts grouped by wallet layer, combining investment records and tagged transactions with no return calculations.

**Architecture:** A new `usePlannerLayers` hook reads wallet layers from Firestore, `Portfolio.jsx` fetches tagged transactions inline and merges them with investments from `useInvestments()`, grouping everything by which wallet layer each item's `plannerGoalId` maps to. Navigation is wired in `App.jsx` and `Sidebar.jsx`.

**Tech Stack:** React 19, Tailwind CSS v4, Firebase Firestore, React Router v7, `@heroicons/react/24/outline`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/planner/usePlannerLayers.js` | **Create** | Hook: reads active wallet version layers from Firestore |
| `src/pages/Portfolio.jsx` | **Create** | Full portfolio page: data aggregation, donut chart, layer groups |
| `src/App.jsx` | **Modify** | Import `Portfolio` and register `/portfolio` route |
| `src/components/Sidebar.jsx` | **Modify** | Add `BriefcaseIcon`, `/portfolio` nav entry, `ROOT_ROUTES`, label |

---

## Task 1: `usePlannerLayers` hook

**Files:**
- Create: `src/pages/planner/usePlannerLayers.js`

- [ ] **Step 1: Create the hook**

```js
// src/pages/planner/usePlannerLayers.js
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';

/**
 * Returns the layers array from the active wallet version for the current month.
 * Each layer: { id, label, icon, colorKey, sublayers[] }
 * sublayer: { id, label, type, ... }
 */
export default function usePlannerLayers() {
  const { ownerId } = useAccess();
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    if (!ownerId) return;
    const unsubscribe = onSnapshot(doc(db, 'planner', ownerId), (snap) => {
      if (!snap.exists()) { setLayers([]); return; }
      const walletVersions = snap.data().walletVersions ?? [];
      if (!walletVersions.length) { setLayers([]); return; }

      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const sorted = [...walletVersions].sort((a, b) => a.from.localeCompare(b.from));
      let active = null;
      for (const v of sorted) {
        if (v.from <= currentMonth) active = v;
      }
      setLayers((active ?? sorted[sorted.length - 1]).layers ?? []);
    });
    return unsubscribe;
  }, [ownerId]);

  return layers;
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/planner/usePlannerLayers.js
git commit -m "feat: add usePlannerLayers hook for portfolio page"
```

---

## Task 2: `Portfolio.jsx` — full page component

**Files:**
- Create: `src/pages/Portfolio.jsx`

- [ ] **Step 1: Create the full page**

```jsx
// src/pages/Portfolio.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';
import { useInvestments, INVESTMENT_TYPES } from '../contexts/InvestmentContext';
import usePlannerLayers from './planner/usePlannerLayers';
import { resolveLayerColors } from './planner/carteira/constants';
import { Shimmer } from '@/components/ui/shimmer';

// Maps investment type keys → display badge label
const INV_TYPE_BADGE = {
  fixed_income: 'Renda Fixa',
  stocks:       'Ações',
  crypto:       'Cripto',
  funds:        'Misto',
  fii:          'FII',
  real_estate:  'Outro',
};

// Solid hex colors for the donut chart slices, keyed by layer id
const DONUT_COLORS = {
  liquidez:    '#3b82f6',
  crescimento: '#10b981',
  patrimonio:  '#8b5cf6',
  legado:      '#f97316',
};

// Badge color classes keyed by display badge label
const BADGE_COLORS = {
  'Renda Fixa': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'FII':        'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'ETF':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Ações':      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Cripto':     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
};

const formatBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function TypeBadge({ type }) {
  const label = INV_TYPE_BADGE[type] ?? type ?? null;
  if (!label) return null;
  const cls = BADGE_COLORS[label] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

function ItemRow({ name, type, amount }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{name}</span>
        <TypeBadge type={type} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white shrink-0">
        {formatBRL.format(amount)}
      </span>
    </div>
  );
}

function LayerGroup({ layer, layerIndex, items }) {
  const colors = resolveLayerColors(layer.id, layer.colorKey, layerIndex);
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${colors.header} border-b`}>
        <div className="flex items-center gap-2">
          <span>{layer.icon}</span>
          <span className={`text-sm font-semibold ${colors.title}`}>{layer.label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.badge}`}>
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${colors.title}`}>
          {formatBRL.format(total)}
        </span>
      </div>
      {/* Items */}
      <div className="bg-white dark:bg-gray-800">
        {items.map((item, i) => (
          <ItemRow key={`${item.sourceId}-${i}`} name={item.name} type={item.type} amount={item.amount} />
        ))}
      </div>
    </div>
  );
}

function DonutChart({ layers, grouped }) {
  const layerTotals = layers
    .map(l => ({ id: l.id, total: (grouped[l.id] ?? []).reduce((s, i) => s + i.amount, 0) }))
    .filter(lt => lt.total > 0);
  const grandTotal = layerTotals.reduce((s, lt) => s + lt.total, 0);
  if (grandTotal === 0) return null;

  // Build conic-gradient string
  let cursor = 0;
  const stops = layerTotals.map(lt => {
    const pct = (lt.total / grandTotal) * 100;
    const color = DONUT_COLORS[lt.id] ?? '#94a3b8';
    const stop = `${color} ${cursor.toFixed(2)}% ${(cursor + pct).toFixed(2)}%`;
    cursor += pct;
    return stop;
  });
  const gradient = `conic-gradient(${stops.join(', ')})`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Alocação por camada</p>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="shrink-0 relative w-20 h-20 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-[14px] bg-white dark:bg-gray-800 rounded-full" />
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {layerTotals.map(lt => {
            const layer = layers.find(l => l.id === lt.id);
            const pct = ((lt.total / grandTotal) * 100).toFixed(1);
            const color = DONUT_COLORS[lt.id] ?? '#94a3b8';
            return (
              <div key={lt.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {layer?.icon} {layer?.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { ownerId } = useAccess();
  const { investments, loading: invLoading } = useInvestments();
  const layers = usePlannerLayers();
  const [taggedTxs, setTaggedTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);

  // Fetch all transactions that have a plannerGoalId
  useEffect(() => {
    if (!ownerId) { setTxLoading(false); return; }
    setTxLoading(true);
    const q = query(collection(db, 'transactions'), where('userId', '==', ownerId));
    getDocs(q)
      .then(snap => {
        const tagged = [];
        snap.forEach(d => {
          const tx = { id: d.id, ...d.data() };
          if (tx.plannerGoalId) tagged.push(tx);
        });
        setTaggedTxs(tagged);
      })
      .catch(err => console.error('[Portfolio] fetch tagged transactions:', err))
      .finally(() => setTxLoading(false));
  }, [ownerId]);

  const loading = invLoading || txLoading;

  // Build sublayerId → layerId lookup from wallet layers
  const sublayerToLayer = {};
  layers.forEach(layer => {
    (layer.sublayers ?? []).forEach(sub => {
      sublayerToLayer[sub.id] = layer.id;
    });
  });

  // Convert investments and transactions to a uniform portfolio item shape:
  // { sourceId, name, type, amount, plannerGoalId }
  const activeInvestments = investments.filter(inv => inv.status !== 'closed');

  const invItems = activeInvestments.map(inv => ({
    sourceId: inv.id,
    name: inv.name,
    type: inv.type,           // fixed_income | stocks | crypto | funds | fii | real_estate
    amount: inv.initialAmount ?? 0,
    plannerGoalId: inv.plannerGoalId ?? null,
  }));

  const txItems = taggedTxs.map(tx => ({
    sourceId: tx.id,
    name: tx.description,
    type: tx.investmentType ?? null,
    amount: tx.amount ?? 0,
    plannerGoalId: tx.plannerGoalId,
  }));

  const allItems = [...invItems, ...txItems];

  // Group items by layerId; items with no matching layer go to 'unlinked'
  const grouped = {};
  const unlinked = [];

  allItems.forEach(item => {
    const layerId = item.plannerGoalId ? sublayerToLayer[item.plannerGoalId] : null;
    if (layerId) {
      if (!grouped[layerId]) grouped[layerId] = [];
      grouped[layerId].push(item);
    } else {
      unlinked.push(item);
    }
  });

  // Totals
  const totalInvested = allItems.reduce((s, i) => s + i.amount, 0);
  const invCount = invItems.length;
  const txCount = txItems.length;

  // Only render layers that have at least one item
  const activeLayers = layers.filter(l => (grouped[l.id] ?? []).length > 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Portfólio</h1>

      {/* Header summary card */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-5">
        <p className="text-xs text-gray-400 mb-1">Total investido</p>
        {loading ? (
          <Shimmer className="h-8 w-2/3 rounded-lg" />
        ) : (
          <p className="text-2xl font-bold text-white tabular-nums">{formatBRL.format(totalInvested)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          {invCount} {invCount === 1 ? 'ativo' : 'ativos'} · {txCount} {txCount === 1 ? 'transação vinculada' : 'transações vinculadas'}
        </p>
      </div>

      {/* Donut chart */}
      {!loading && <DonutChart layers={layers} grouped={grouped} />}
      {loading && <Shimmer className="h-28 w-full rounded-2xl" />}

      {/* Layer groups */}
      {loading ? (
        <>
          <Shimmer className="h-24 w-full rounded-2xl" />
          <Shimmer className="h-24 w-full rounded-2xl" />
        </>
      ) : (
        <>
          {activeLayers.map((layer, i) => (
            <LayerGroup
              key={layer.id}
              layer={layer}
              layerIndex={i}
              items={grouped[layer.id] ?? []}
            />
          ))}

          {/* Sem vínculo */}
          {unlinked.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm opacity-50">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span>📦</span>
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Sem vínculo</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {unlinked.length} {unlinked.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-gray-400">
                  {formatBRL.format(unlinked.reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800">
                {unlinked.map((item, i) => (
                  <ItemRow key={`${item.sourceId}-${i}`} name={item.name} type={item.type} amount={item.amount} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activeLayers.length === 0 && unlinked.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">💼</p>
              <p className="text-sm font-medium">Nenhum investimento encontrado</p>
              <p className="text-xs mt-1">Adicione investimentos ou vincule transações a uma camada da carteira</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Portfolio.jsx src/pages/planner/usePlannerLayers.js
git commit -m "feat: add Portfolio page with donut chart and layer groups"
```

---

## Task 3: Wire navigation — `App.jsx` and `Sidebar.jsx`

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`

### App.jsx

- [ ] **Step 1: Add import and route**

In `src/App.jsx`, add the import after the existing page imports:

```jsx
import PortfolioPage from './pages/Portfolio';
```

Add the route inside the `<Route element={<Layout />}>` block, after the planner route:

```jsx
<Route path="portfolio" element={<PortfolioPage />} />
```

### Sidebar.jsx

- [ ] **Step 2: Add `BriefcaseIcon` to the heroicons import**

Find the existing import block (around line 8) and add `BriefcaseIcon`:

```jsx
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  FlagIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftIcon,
  TagIcon,
  BellIcon,
  BriefcaseIcon,
  PresentationChartLineIcon,
} from '@heroicons/react/24/outline';
```

- [ ] **Step 3: Add portfolio to `navItems`**

In `navItems`, add the portfolio entry after `/planner`:

```js
const navItems = [
  { path: '/dashboard', icon: HomeIcon, labelKey: 'dashboard' },
  { path: '/planner', icon: PresentationChartLineIcon, labelKey: 'planner' },
  { path: '/portfolio', icon: BriefcaseIcon, labelKey: 'portfolio' },
  { path: '/expenses', icon: ArrowTrendingDownIcon, labelKey: 'expenses' },
  { path: '/income', icon: ArrowTrendingUpIcon, labelKey: 'income' },
  { divider: true },
  { path: '/goals', icon: FlagIcon, labelKey: 'goals' },
  { path: '/bills', icon: DocumentTextIcon, labelKey: 'bills' },
  { path: '/cards', icon: CreditCardIcon, labelKey: 'cards' },
  { path: '/notifications', icon: BellIcon, labelKey: 'notifications' },
  { path: '/pending-review', icon: TagIcon, labelKey: 'pendingReview', hasBadge: true },
];
```

- [ ] **Step 4: Add `/portfolio` to `ROOT_ROUTES`**

In the `ROOT_ROUTES` array (around line 49), add `/portfolio`:

```js
const ROOT_ROUTES = [
  '/dashboard',
  '/expenses',
  '/income',
  '/goals',
  '/bills',
  '/cards',
  '/transactions',
  '/settings',
  '/budget',
  '/help',
  '/notifications',
  '/pending-review',
  '/planner',
  '/portfolio',
];
```

- [ ] **Step 5: Add `portfolio` label to the `labels` map**

In the `labels` object inside the `Sidebar` component (around line 97), add:

```js
portfolio: language === 'pt' ? 'Portfólio' : 'Portfolio',
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/Sidebar.jsx
git commit -m "feat: wire /portfolio route and sidebar nav entry"
```

---

## Task 4: Deploy

- [ ] **Step 1: Final build check**

```bash
npm run build 2>&1 | tail -8
```

Expected: `✓ built in` — no TypeScript/lint errors, bundle size warning is pre-existing and acceptable.

- [ ] **Step 2: Push and deploy**

```bash
git push origin claude/finance-tracker-app-V1xPW && firebase deploy --only hosting
```

Expected output ends with:
```
✔  hosting[limas-finance]: release complete
✔  Deploy complete!
Hosting URL: https://limas-finance.web.app
```
