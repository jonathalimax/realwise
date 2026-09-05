# Merge Portfolio into Investments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Portfolio page into the Investments page as the first tab (Portfólio), with the existing investments list as the second tab (Investimentos).

**Architecture:** Add a `useState` tab toggle to `Investments.jsx`, inline the Portfolio JSX as tab 1, keep the existing list as tab 2. Update `Sidebar.jsx` to remove the Portfolio nav item and `App.jsx` to redirect `/portfolio` → `/investments`. Delete `Portfolio.jsx`.

**Tech Stack:** React 19, React Router v7, Tailwind CSS v4, Heroicons

---

### Task 1: Remove Portfolio from Sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Remove the Portfolio nav item from `navItems`**

In `src/components/Sidebar.jsx`, change `navItems` from:
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
];
```
to:
```js
const navItems = [
  { path: '/dashboard', icon: HomeIcon, labelKey: 'dashboard' },
  { path: '/planner', icon: PresentationChartLineIcon, labelKey: 'planner' },
  { path: '/expenses', icon: ArrowTrendingDownIcon, labelKey: 'expenses' },
  { path: '/income', icon: ArrowTrendingUpIcon, labelKey: 'income' },
  { divider: true },
  { path: '/goals', icon: FlagIcon, labelKey: 'goals' },
  { path: '/bills', icon: DocumentTextIcon, labelKey: 'bills' },
  { path: '/cards', icon: CreditCardIcon, labelKey: 'cards' },
  { path: '/notifications', icon: BellIcon, labelKey: 'notifications' },
];
```

- [ ] **Step 2: Remove `/portfolio` from `ROOT_ROUTES`**

Change:
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
  '/planner',
  '/portfolio',
];
```
to:
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
  '/planner',
  '/investments',
];
```

- [ ] **Step 3: Remove unused imports**

Remove `BriefcaseIcon` from the heroicons import at the top of `Sidebar.jsx` (only if it's not used anywhere else in the file — check with a quick search). Also remove `portfolio` from the `labels` object:

```js
// Remove this line from labels:
portfolio: language === 'pt' ? 'Portfólio' : 'Portfolio',
```

- [ ] **Step 4: Verify the sidebar renders without errors**

Run `npm run dev` and open the app. Confirm:
- No "Portfólio" entry in the sidebar
- The sidebar renders without console errors

- [ ] **Step 5: Commit**
```bash
git add src/components/Sidebar.jsx
git commit -m "feat: remove Portfolio from sidebar nav"
```

---

### Task 2: Redirect `/portfolio` route in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the portfolio route with a redirect**

In `src/App.jsx`, find:
```jsx
<Route path="portfolio" element={<PortfolioPage />} />
```
Replace with:
```jsx
<Route path="portfolio" element={<Navigate to="/investments" replace />} />
```

- [ ] **Step 2: Remove the PortfolioPage import**

Find and remove:
```js
import PortfolioPage from './pages/Portfolio';
```

- [ ] **Step 3: Verify redirect works**

With `npm run dev` running, navigate to `http://localhost:5173/portfolio` in the browser. Confirm it redirects to `/investments`.

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "feat: redirect /portfolio to /investments"
```

---

### Task 3: Add tabs to Investments page with Portfolio as tab 1

**Files:**
- Modify: `src/pages/Investments.jsx`

This is the main task. The Investments page gains a tab bar below the sticky header. Tab 1 renders the Portfolio content inline; tab 2 renders the existing list.

- [ ] **Step 1: Add Portfolio imports to `Investments.jsx`**

At the top of `src/pages/Investments.jsx`, add these imports (taken from `Portfolio.jsx`):

```js
import { useState as useStatePortfolio, useEffect as useEffectPortfolio } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAccess } from '../contexts/AccessContext';
import usePlannerLayers from './planner/usePlannerLayers';
import { resolveLayerColors, formatBRL } from './planner/carteira/constants';
import { Shimmer } from '../components/ui/shimmer';
```

> Note: `useState` and `useEffect` are already imported in `Investments.jsx` — just import the additional Firestore/context items not already present. Check the existing imports first and only add what's missing.

- [ ] **Step 2: Add tab state and Portfolio data-fetching to the component**

Inside the `InvestmentsPage` component function, after the existing state declarations, add:

```js
// Tab state: 'portfolio' | 'investments'
const [activeTab, setActiveTab] = useState('portfolio');

// Portfolio data
const { ownerId } = useAccess();
const layers = usePlannerLayers();
const [taggedTxs, setTaggedTxs] = useState([]);
const [txLoading, setTxLoading] = useState(true);

useEffect(() => {
  if (!ownerId) { setTxLoading(false); return; }
  setTxLoading(true);
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', ownerId),
    where('plannerGoalId', '!=', null)
  );
  getDocs(q)
    .then(snap => {
      const tagged = [];
      snap.forEach(d => tagged.push({ id: d.id, ...d.data() }));
      setTaggedTxs(tagged);
    })
    .catch(err => console.error('[Portfolio] fetch tagged transactions:', err))
    .finally(() => setTxLoading(false));
}, [ownerId]);
```

- [ ] **Step 3: Add Portfolio helper constants and components inside the file**

Add these before the `InvestmentsPage` component (after the existing imports, before the component function). Copy them verbatim from `Portfolio.jsx`:

```js
// --- Portfolio tab helpers ---

const INV_TYPE_BADGE = {
  fixed_income: 'Renda Fixa',
  stocks: 'Ações',
  crypto: 'Cripto',
  funds: 'Misto',
  fii: 'FII',
  real_estate: 'Outro',
};

const DONUT_COLORS = {
  liquidez:    '#3b82f6',
  crescimento: '#10b981',
  patrimonio:  '#8b5cf6',
  legado:      '#f97316',
};

const BADGE_COLORS = {
  'Renda Fixa': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'FII':        'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  'ETF':        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'Ações':      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Cripto':     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
};

function PortfolioTypeBadge({ type }) {
  const label = INV_TYPE_BADGE[type] ?? type ?? null;
  if (!label) return null;
  const cls = BADGE_COLORS[label] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

function PortfolioItemRow({ name, type, amount }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{name}</span>
        <PortfolioTypeBadge type={type} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white shrink-0">
        {formatBRL.format(amount)}
      </span>
    </div>
  );
}

function PortfolioLayerGroup({ layer, layerIndex, items }) {
  const colors = resolveLayerColors(layer.id, layer.colorKey, layerIndex);
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
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
      <div className="bg-white dark:bg-gray-800">
        {items.map((item) => (
          <PortfolioItemRow key={item.sourceId} name={item.name} type={item.type} amount={item.amount} />
        ))}
      </div>
    </div>
  );
}

function PortfolioDonutChart({ layers, grouped }) {
  const layerTotals = layers
    .map(l => ({ id: l.id, total: (grouped[l.id] ?? []).reduce((s, i) => s + i.amount, 0) }))
    .filter(lt => lt.total > 0);
  const grandTotal = layerTotals.reduce((s, lt) => s + lt.total, 0);
  if (grandTotal === 0) return null;

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
        <div className="shrink-0 relative w-20 h-20 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-[14px] bg-white dark:bg-gray-800 rounded-full" />
        </div>
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
```

- [ ] **Step 4: Build Portfolio tab data inside the component**

Inside `InvestmentsPage`, after the tab state and data-fetching added in Step 2, add the derived Portfolio data:

```js
// Portfolio tab computed data
const portfolioLoading = loading || txLoading;

const sublayerToLayer = {};
layers.forEach(layer => {
  (layer.sublayers ?? []).forEach(sub => {
    sublayerToLayer[sub.id] = layer.id;
  });
});

const activeInvestments = investments.filter(inv => inv.status !== 'closed');

const invItems = activeInvestments.map(inv => ({
  sourceId: `inv-${inv.id}`,
  name: inv.name,
  type: inv.type,
  amount: inv.initialAmount ?? 0,
  plannerGoalId: inv.plannerGoalId ?? null,
}));

const txItems = taggedTxs.map(tx => ({
  sourceId: `tx-${tx.id}`,
  name: tx.description,
  type: tx.investmentType ?? null,
  amount: tx.amount ?? 0,
  plannerGoalId: tx.plannerGoalId,
}));

const allPortfolioItems = [...invItems, ...txItems];

const portfolioGrouped = {};
const portfolioUnlinked = [];

allPortfolioItems.forEach(item => {
  const layerId = item.plannerGoalId ? sublayerToLayer[item.plannerGoalId] : null;
  if (layerId) {
    if (!portfolioGrouped[layerId]) portfolioGrouped[layerId] = [];
    portfolioGrouped[layerId].push(item);
  } else {
    portfolioUnlinked.push(item);
  }
});

const portfolioTotal = allPortfolioItems.reduce((s, i) => s + i.amount, 0);
const portfolioActiveLayers = layers.filter(l => (portfolioGrouped[l.id] ?? []).length > 0);
```

- [ ] **Step 5: Add the tab bar to the page header JSX**

In the `return` of `InvestmentsPage`, find the sticky header block:
```jsx
<div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-14 sm:h-16">
      <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
        {language === 'pt' ? 'Investimentos' : 'Investments'}
      </h1>
      <button
        onClick={handleOpenAdd}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="hidden sm:inline">{language === 'pt' ? 'Adicionar' : 'Add'}</span>
      </button>
    </div>
  </div>
</div>
```

Replace it with:
```jsx
<div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-14 sm:h-16">
      <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pl-12 md:pl-0">
        {language === 'pt' ? 'Investimentos' : 'Investments'}
      </h1>
      {activeTab === 'investments' && (
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">{language === 'pt' ? 'Adicionar' : 'Add'}</span>
        </button>
      )}
    </div>
  </div>
  {/* Tab bar */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
    <button
      onClick={() => setActiveTab('portfolio')}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'portfolio'
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {language === 'pt' ? 'Portfólio' : 'Portfolio'}
    </button>
    <button
      onClick={() => setActiveTab('investments')}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'investments'
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      {language === 'pt' ? 'Investimentos' : 'Investments'}
    </button>
  </div>
</div>
```

- [ ] **Step 6: Wrap the existing content in a tab conditional and add Portfolio tab content**

Find the opening of the content section:
```jsx
{/* Content */}
<div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6 lg:px-8 pt-4 space-y-4 sm:space-y-6">
```

Replace everything from that opening div to the closing `</div>` of the entire content block with:

```jsx
{/* Content */}
<div className="max-w-7xl mx-auto pb-24 px-4 sm:px-6 lg:px-8 pt-4">

  {/* ── Portfolio tab ── */}
  {activeTab === 'portfolio' && (
    <div className="space-y-4">
      {/* Total card */}
      <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl p-5">
        <p className="text-xs text-gray-400 mb-1">
          {language === 'pt' ? 'Total investido' : 'Total invested'}
        </p>
        {portfolioLoading ? (
          <Shimmer className="h-8 w-2/3 rounded-lg" />
        ) : (
          <p className="text-2xl font-bold text-white tabular-nums">{formatBRL.format(portfolioTotal)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          {invItems.length} {invItems.length === 1 ? (language === 'pt' ? 'ativo' : 'asset') : (language === 'pt' ? 'ativos' : 'assets')}
          {' · '}
          {txItems.length} {txItems.length === 1 ? (language === 'pt' ? 'transação vinculada' : 'linked transaction') : (language === 'pt' ? 'transações vinculadas' : 'linked transactions')}
        </p>
      </div>

      {/* Donut chart */}
      {portfolioLoading
        ? <Shimmer className="h-28 w-full rounded-2xl" />
        : <PortfolioDonutChart layers={layers} grouped={portfolioGrouped} />
      }

      {/* Layer groups */}
      {portfolioLoading ? (
        <>
          <Shimmer className="h-24 w-full rounded-2xl" />
          <Shimmer className="h-24 w-full rounded-2xl" />
        </>
      ) : (
        <>
          {portfolioActiveLayers.map((layer, i) => (
            <PortfolioLayerGroup
              key={layer.id}
              layer={layer}
              layerIndex={i}
              items={portfolioGrouped[layer.id] ?? []}
            />
          ))}

          {portfolioUnlinked.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm opacity-50">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span>📦</span>
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    {language === 'pt' ? 'Sem vínculo' : 'Unlinked'}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {portfolioUnlinked.length} {portfolioUnlinked.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums text-gray-400">
                  {formatBRL.format(portfolioUnlinked.reduce((s, i) => s + i.amount, 0))}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-800">
                {portfolioUnlinked.map((item) => (
                  <PortfolioItemRow key={item.sourceId} name={item.name} type={item.type} amount={item.amount} />
                ))}
              </div>
            </div>
          )}

          {portfolioActiveLayers.length === 0 && portfolioUnlinked.length === 0 && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <p className="text-4xl mb-3">💼</p>
              <p className="text-sm font-medium">
                {language === 'pt' ? 'Nenhum investimento encontrado' : 'No investments found'}
              </p>
              <p className="text-xs mt-1">
                {language === 'pt'
                  ? 'Adicione investimentos ou vincule transações a uma camada da carteira'
                  : 'Add investments or link transactions to a wallet layer'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )}

  {/* ── Investments list tab ── */}
  {activeTab === 'investments' && (
    <div className="space-y-4 sm:space-y-6 pt-0">
      {/* (paste the existing content block here — everything that was inside the original content div) */}
    </div>
  )}

</div>
```

> **Important:** The `{/* (paste the existing content block here) */}` comment is a placeholder instruction. Move everything that was previously inside the content `<div>` (the gradient summary, search bar, filters panel, results count, and investments list) inside the `activeTab === 'investments'` block.

- [ ] **Step 7: Verify both tabs render correctly**

Run `npm run dev`. Navigate to `/investments`. Confirm:
- Page loads on the Portfólio tab by default
- Portfólio tab shows donut chart and layer groups (or empty state)
- Clicking "Investimentos" tab shows the list with gradient summary, search, filters
- `+ Adicionar` button only appears on the Investimentos tab
- No console errors

- [ ] **Step 8: Commit**
```bash
git add src/pages/Investments.jsx
git commit -m "feat: merge Portfolio as first tab in Investments page"
```

---

### Task 4: Delete Portfolio.jsx

**Files:**
- Delete: `src/pages/Portfolio.jsx`

- [ ] **Step 1: Delete the file**
```bash
rm src/pages/Portfolio.jsx
```

- [ ] **Step 2: Verify no broken imports**
```bash
npm run build 2>&1 | grep -i "portfolio\|error"
```
Expected: build completes with no errors referencing Portfolio.

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "chore: delete standalone Portfolio page (merged into Investments)"
```
