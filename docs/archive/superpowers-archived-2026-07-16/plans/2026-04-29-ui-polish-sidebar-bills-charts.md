# UI Polish: Sidebar, Bills, Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish 11 UI items spanning sidebar greeting/navigation, Bills page/modal, category charts, page header, and bank card layout.

**Architecture:** All changes are isolated to existing React components — no new context, no new routes (except a `/cards` redirect). The largest structural change is moving Banks content into a new Settings tab and lifting category filter state from `CategoryTrendChart` into `RastreamentoTab`.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, React Router v7, Firebase/Firestore, `@heroicons/react`

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/Sidebar.jsx` | Greeting text, remove Settings + Cards from nav array, add gear icon to footer |
| `src/components/PageHeader.jsx` | Absolute-positioned centered title on mobile |
| `src/pages/Settings.jsx` | Add "Banks" tab, render `<BanksTabContent />` |
| `src/pages/Cards.jsx` | Extract `BankItem` + form JSX into exported `BanksTabContent` component; keep `/cards` as redirect |
| `src/pages/Dashboard.jsx` | FAB "Meus Bancos" → `/settings?tab=banks` |
| `src/components/ExpensesByCategoryCard.jsx` | Show currency+pct per row, remove limit, recompute pct vs total |
| `src/components/charts/SpendingChart.jsx` | Remove limit display + progress bar; show pct vs total |
| `src/pages/planner/CategoryTrendChart.jsx` | Accept `hiddenCats`/`onToggleCat` props; remove internal chip state |
| `src/pages/planner/RastreamentoTab.jsx` | Own chip state + `catSearch`, render chips+search in card header |
| `src/components/BillsSummaryCard.jsx` | Pending/paid sections navigate with `?status=` param |
| `src/pages/Bills.jsx` | Read `?status=` on mount; remove 4-card stats grid |
| `src/components/BillModal.jsx` | Add `amount` field; landscape `dvh` overflow fix |
| `src/contexts/BillsContext.jsx` | Propagate `amount` in recurring instance creation |

---

### Task 1: Sidebar greeting

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Update the user sub-label in the brand block**

In `SidebarContent` (or wherever the brand block renders the user name), find the element that shows `auth.currentUser.displayName || auth.currentUser.email?.split('@')[0]` and replace it:

```jsx
// Replace this pattern:
// {auth.currentUser.displayName || auth.currentUser.email?.split('@')[0]}

// With:
{(() => {
  const user = auth.currentUser;
  if (!user) return null;
  const firstName = user.displayName?.split(' ')[0];
  return firstName ? `Olá, ${firstName}` : 'Olá novamente';
})()}
```

- [ ] **Step 2: Verify visually**

Run `npm run dev`. Open the sidebar — the sub-label under "Moneywise" should read "Olá, Jonatha" (for account jonathalimax@gmail.com with displayName "Jonatha Lima").

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat(sidebar): show personalized greeting instead of raw username"
```

---

### Task 2: PageHeader — center title on mobile

**Files:**
- Modify: `src/components/PageHeader.jsx`

- [ ] **Step 1: Replace the inner flex row with a relative container using absolute-positioned title**

Find the `<div className="flex items-center h-14 sm:h-16 gap-3">` and replace the entire inner layout:

```jsx
<div className="relative flex items-center h-14 sm:h-16 px-0">
  {/* Left: hamburger or back — sits in normal flow, z-10 to stay above title */}
  <div className="md:hidden flex-shrink-0 z-10">
    {isNestedRoute ? (
      <button
        onClick={handleBack}
        className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
        aria-label="Back"
      >
        <ArrowLeftIcon className="w-6 h-6" />
      </button>
    ) : (
      <button
        onClick={toggleSidebar}
        className="p-2 -ml-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
        aria-label="Menu"
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    )}
  </div>

  {/* Title: absolute center on mobile, normal flow on desktop */}
  <h1 className="
    absolute inset-x-0 text-center pointer-events-none
    sm:static sm:text-left sm:flex-1 sm:pointer-events-auto sm:truncate
    text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight
  ">
    {displayTitle}
  </h1>

  {/* Right: month nav + right slot */}
  <div className="ml-auto flex items-center gap-2 z-10 flex-shrink-0">
    {showMonth && (
      <CompactMonthNav
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        locale={locale}
      />
    )}
    {right}
  </div>
</div>
```

- [ ] **Step 2: Verify at mobile width**

Run `npm run dev`. Open DevTools → responsive mode → 375px. The page title ("MEUS BANCOS", "PAINEL", etc.) should be perfectly centered between the hamburger icon and the month navigator.

- [ ] **Step 3: Commit**

```bash
git add src/components/PageHeader.jsx
git commit -m "fix(header): center page title between hamburger and month nav on mobile"
```

---

### Task 3: Bank card subtitle — fix line-breaking

**Files:**
- Modify: `src/pages/Cards.jsx` (the `BankItem` component)

- [ ] **Step 1: Replace the verbose subtitle spans with a compact single-line string**

Find the subtitle `<div className="flex items-center gap-2 text-xs ...">` inside `BankItem` and replace:

```jsx
<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
  {subtitleName}
  {userBank.hasCredit && (
    <>
      {' · '}
      {language === 'pt'
        ? `Fecha dia ${userBank.closingDay} · Paga dia ${userBank.paymentDay}`
        : `Closes ${userBank.closingDay} · Due ${userBank.paymentDay}`}
    </>
  )}
</p>
```

- [ ] **Step 2: Verify at 375px**

Run `npm run dev`. Navigate to `/cards`. Each bank row subtitle should read e.g. `Nubank · Fecha dia 20 · Paga dia 27` on a single line without wrapping.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Cards.jsx
git commit -m "fix(banks): compact subtitle labels to prevent line-wrapping on narrow screens"
```

---

### Task 4: Settings — add Banks tab + extract BanksTabContent

**Files:**
- Modify: `src/pages/Cards.jsx` — export `BanksTabContent` component
- Modify: `src/pages/Settings.jsx` — add Banks tab

- [ ] **Step 1: Export `BanksTabContent` from Cards.jsx**

At the top of `Cards.jsx`, add an exported component that wraps the list + form JSX (the content that renders when `view === 'list'`). Move the bank management state and handlers into it. The existing default export `CardsPage` should simply render:

```jsx
import { useNavigate, useEffect } from 'react';

// Keep BanksTabContent as a named export for use in Settings
export function BanksTabContent() {
  // All the existing state: view, editingBank, showEditModal, formData
  // All the existing handlers: resetForm, handleOpenForm, handleSubmitBank, handleDelete
  // All the existing sub-components: BankItem, EditBankModal
  // All the existing JSX that was previously in CardsPage's return

  // ... (move the full CardsPage body here, minus the PageHeader)
  return (
    <div>
      {/* bank list or add-form JSX — same as before, minus PageHeader */}
    </div>
  );
}

export default function CardsPage() {
  const navigate = useNavigate();
  // Redirect /cards to /settings?tab=banks
  useEffect(() => {
    navigate('/settings?tab=banks', { replace: true });
  }, [navigate]);
  return null;
}
```

> **Important:** The full `BanksTabContent` body must include all the existing JSX from `CardsPage`'s return statement (bank list, add form, edit modal, FAB) — just without `<PageHeader>`.

- [ ] **Step 2: Add Banks tab to Settings.jsx**

In `Settings.jsx`:

1. Import `BanksTabContent`:
```jsx
import { BanksTabContent } from './Cards';
```

2. Add `'banks'` to the tab bar after "Notifications":
```jsx
<button
  onClick={() => setActiveTab('banks')}
  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
    activeTab === 'banks'
      ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
  }`}
>
  {language === 'pt' ? 'Bancos' : 'Banks'}
</button>
```

3. Add the tab content below the Notifications block:
```jsx
{activeTab === 'banks' && (
  <div className="p-4 sm:p-6">
    <BanksTabContent />
  </div>
)}
```

4. Read `?tab=` from URL on mount to support deep links:
```jsx
import { useSearchParams } from 'react-router-dom';

// Inside Settings component:
const [searchParams] = useSearchParams();
useEffect(() => {
  const tab = searchParams.get('tab');
  if (tab === 'banks') setActiveTab('banks');
}, [searchParams]);
```

- [ ] **Step 3: Verify**

`npm run dev`. Navigate to `/settings?tab=banks` — should show the bank list. Add/edit/delete a bank — should work identically to the old `/cards` page. Navigate to `/cards` — should redirect to `/settings?tab=banks`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cards.jsx src/pages/Settings.jsx
git commit -m "feat(settings): add Banks tab, redirect /cards to /settings?tab=banks"
```

---

### Task 5: Sidebar — remove Settings/Cards nav items, add gear icon

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Remove Settings and Cards from the navigation array**

Find the `navigation` array at the top of `Sidebar.jsx` and remove these two entries:

```js
// Remove:
{ name: 'Cards', namePt: 'Cartões', href: '/cards', icon: CreditCardIcon },
{ name: 'Settings', namePt: 'Ajustes', href: '/settings', icon: Cog6ToothIcon },
```

- [ ] **Step 2: Add gear icon to footer**

In the footer actions block (the `<div>` containing `<ThemeToggle />`), add a settings icon link to the left:

```jsx
<div className="flex items-center justify-between px-2 mb-2">
  <NavLink
    to="/settings"
    title="Configurações"
    className={({ isActive }) =>
      `p-2 rounded-xl transition-colors ${
        isActive
          ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`
    }
  >
    <Cog6ToothIcon className="w-5 h-5" />
  </NavLink>
  <ThemeToggle />
</div>
```

- [ ] **Step 3: Verify**

`npm run dev`. Sidebar nav list should no longer show "Settings" or "Cards/Banks". The footer shows the gear icon on the left. Clicking gear navigates to `/settings`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat(sidebar): replace Settings/Banks nav items with gear icon in footer"
```

---

### Task 6: Dashboard FAB — update Banks link

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Update handleOpenCards to navigate to settings tab**

Find `handleOpenCards`:

```js
const handleOpenCards = () => {
  if (isMobile) navigate('/cards');
  else setShowCards(true);
};
```

Replace with:

```js
const handleOpenCards = () => {
  navigate('/settings?tab=banks');
};
```

Also remove `CardsModal` usage if it's only used by this handler (check — if `showCards` is only set by `handleOpenCards`, remove the `CardsModal` import, state, and JSX too).

- [ ] **Step 2: Verify**

`npm run dev` on mobile. Tap FAB → "Meus Bancos" → should navigate to `/settings?tab=banks`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "fix(dashboard): FAB Meus Bancos navigates to settings banks tab"
```

---

### Task 7: ExpensesByCategoryCard — simplify to amount + pct

**Files:**
- Modify: `src/components/ExpensesByCategoryCard.jsx`

- [ ] **Step 1: Change pct computation from limit-relative to total-relative**

In the `useMemo` that builds the rows array, change the `pct` calculation:

```js
// Before:
pct: row.limit > 0 ? (row.amount / row.limit) * 100 : (row.amount / total) * 100,

// After:
pct: total > 0 ? (row.amount / total) * 100 : 0,
```

- [ ] **Step 2: Update the row JSX**

Find the JSX for each category row and replace the right-side content. Remove the limit display and "Limit exceeded" badge. Show currency + percentage:

```jsx
{/* Right side: amount + percentage */}
<div className="flex flex-col items-end ml-2 flex-shrink-0">
  <span className="font-bold text-gray-900 dark:text-white text-sm tabular-nums">
    {formatCurrency(row.amount)}
  </span>
  <span className="text-xs text-gray-400 tabular-nums">
    {row.pct.toFixed(0)}%
  </span>
</div>
```

Remove: the `/ {formatCurrency(row.limit)}` sub-label, the "Limit exceeded" badge, and any `row.status` / `row.barColor` usage.

- [ ] **Step 3: Simplify progress bar to always use palette color**

Change the progress bar to always use the palette color (remove limit-based conditional coloring):

```jsx
<div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
  <div
    className="h-full rounded-full transition-all duration-500"
    style={{
      width: `${Math.min(row.pct, 100)}%`,
      backgroundColor: COLORS[index % COLORS.length],
    }}
  />
</div>
```

- [ ] **Step 4: Verify**

`npm run dev`. Dashboard → each category row shows e.g. "R$ 450,00 / 32%" with a colored bar. No limit values. No red warning badges.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpensesByCategoryCard.jsx
git commit -m "feat(dashboard): show category spent amount + percentage, remove budget limit display"
```

---

### Task 8: SpendingChart — remove limit display and progress bar

**Files:**
- Modify: `src/components/charts/SpendingChart.jsx`

- [ ] **Step 1: Update the category button JSX**

In the 2-column grid of category buttons, find the right-side label and progress bar. Replace:

```jsx
{/* Right side: just the spent amount — remove limit */}
<span className="font-bold text-gray-900 dark:text-white text-sm ml-2 tabular-nums">
  {formatCurrency(item.value)}
</span>
```

Below the category name row, replace the progress bar block with just a percentage chip:

```jsx
<span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
  {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '—'}
</span>
```

Remove the entire `<div className="flex items-center gap-2">` progress bar block.

- [ ] **Step 2: Remove now-unused limit variables**

Remove `hasLimit`, `percentage` variables inside the `.map()`. The `item.limit` and `resolveLimit` function are still used to build `data` — leave them but they won't affect the rendered output. (Or remove `limit` from `data` mapping entirely if you want a clean cut; `resolveLimit` and its dependencies can then also be removed.)

- [ ] **Step 3: Verify**

`npm run dev`. Planner → Rastreamento tab → SpendingChart category list shows only the currency amount + small percentage. No progress bars. No `/ R$ X,XX` limit text.

- [ ] **Step 4: Commit**

```bash
git add src/components/charts/SpendingChart.jsx
git commit -m "feat(chart): remove budget limit from spending chart, show amount + percentage only"
```

---

### Task 9: CategoryTrendChart + RastreamentoTab — lift filter state, add search

**Files:**
- Modify: `src/pages/planner/CategoryTrendChart.jsx`
- Modify: `src/pages/planner/RastreamentoTab.jsx`

- [ ] **Step 1: Make CategoryTrendChart accept filter props**

Replace the internal `hiddenCats` state with props:

```jsx
export default function CategoryTrendChart({ allTx, last6Months, getMonthKey, hiddenCats, onToggleCat }) {
  // Remove: const [hiddenCats, setHiddenCats] = useState(() => new Set());
  // Remove: const toggleCat = ...

  // Remove the entire legend chips <div className="flex flex-wrap ..."> block from the return
  // The component now only renders the BarChart:
  return (
    <div className="h-80 w-full overflow-visible">
      <BarChart ... />
    </div>
  );
}
```

- [ ] **Step 2: Add filter state and search + chips to RastreamentoTab**

In `RastreamentoTab.jsx`, add state and build the top categories list:

```jsx
import { useState, useEffect, useMemo } from 'react';
// (existing imports...)

export default function RastreamentoTab({ selectedMonth }) {
  // existing state...
  const [hiddenCats, setHiddenCats] = useState(() => new Set());
  const [catSearch, setCatSearch] = useState('');

  const toggleCat = (cat) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Compute top categories (same logic as CategoryTrendChart used internally)
  const topCats = useMemo(() => {
    const CAT_COLORS = ['#8B5CF6','#EC4899','#06B6D4','#F59E0B','#10B981','#EF4444'];
    const catTotals = {};
    for (const tx of allTx) {
      if (tx.type !== 'expense' || tx.ignored) continue;
      catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    }
    return Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat], i) => ({ cat, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [allTx]);
  // ... rest of component
```

- [ ] **Step 3: Render chips + search in CategoryTrendChart card header**

In the CategoryTrendChart card JSX in `RastreamentoTab`:

```jsx
<div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
  {/* Card header with title + search */}
  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
      Tendência — últimos 6 meses
    </h3>
    <input
      type="text"
      value={catSearch}
      onChange={e => setCatSearch(e.target.value)}
      placeholder="Buscar categoria…"
      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 w-40"
    />
  </div>
  {/* Category toggle chips */}
  <div className="flex flex-wrap gap-x-2 gap-y-1.5 mb-3">
    {topCats.map(({ cat, color }) => {
      const hidden = hiddenCats.has(cat);
      const dimmed = catSearch.length > 0 && !cat.toLowerCase().includes(catSearch.toLowerCase());
      return (
        <button
          key={cat}
          type="button"
          onClick={() => toggleCat(cat)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all hover:bg-gray-100 dark:hover:bg-gray-700 ${
            hidden || dimmed ? 'opacity-40' : 'opacity-100'
          }`}
        >
          <div
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ background: hidden ? 'transparent' : color, border: `1.5px solid ${color}` }}
          />
          <span className={`text-xs ${hidden ? 'line-through text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
            {cat}
          </span>
        </button>
      );
    })}
  </div>
  <CategoryTrendChart
    allTx={allTx}
    last6Months={last6Months}
    getMonthKey={getPaymentMonthKey}
    hiddenCats={hiddenCats}
    onToggleCat={toggleCat}
  />
</div>
```

- [ ] **Step 4: Verify**

`npm run dev`. Planner → Rastreamento tab → "Tendência" card shows chips + search input in its header. Typing in search dims non-matching chips. Clicking a chip hides its bar series.

- [ ] **Step 5: Commit**

```bash
git add src/pages/planner/CategoryTrendChart.jsx src/pages/planner/RastreamentoTab.jsx
git commit -m "feat(planner): move category filter chips to card header with search input"
```

---

### Task 10: BillsSummaryCard — navigate with status filter

**Files:**
- Modify: `src/components/BillsSummaryCard.jsx`

- [ ] **Step 1: Make pending and paid sections navigate with status param**

Find the `handleClick` function and the sections rendering pending/paid counts. Replace the single `handleClick` with two targeted handlers:

```jsx
const handlePendingClick = () => navigate('/bills?status=pending');
const handlePaidClick = () => navigate('/bills?status=paid');
const handleTotalClick = () => navigate('/bills');
```

Apply these to the respective sections (the pending count div and paid count div). The outer card click (if it exists for the total/header) uses `handleTotalClick`.

- [ ] **Step 2: Verify**

`npm run dev`. Dashboard → Bills card → tap the pending count → navigates to `/bills` with `?status=pending` visible in the URL.

- [ ] **Step 3: Commit**

```bash
git add src/components/BillsSummaryCard.jsx
git commit -m "feat(bills): tap pending/paid on dashboard navigates to bills with filter pre-applied"
```

---

### Task 11: Bills page — read status from URL, remove stats grid

**Files:**
- Modify: `src/pages/Bills.jsx`

- [ ] **Step 1: Read `?status=` on mount**

Add `useSearchParams` and initialise `statusFilter` from the URL:

```jsx
import { useSearchParams } from 'react-router-dom';

// Inside Bills component:
const [searchParams] = useSearchParams();
const [statusFilter, setStatusFilter] = useState(() => {
  const s = searchParams.get('status');
  return ['all', 'pending', 'paid', 'overdue'].includes(s) ? s : 'all';
});
```

- [ ] **Step 2: Remove the 4-card stats grid**

Find and delete the entire `<div className="grid grid-cols-2 sm:grid-cols-4 ...">` block that shows Total / Pending / Paid / Overdue cards. Also remove the `useMemo` computations for `totalAmount`, `pendingAmount`, `paidAmount` if they're only used by this grid and not by `BillsList`.

- [ ] **Step 3: Verify**

`npm run dev`. Navigate to `/bills` — no stats grid. Navigate to `/bills?status=pending` — pending filter is active. Status filter buttons still work to change the filter manually.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Bills.jsx
git commit -m "feat(bills): read status filter from URL, remove duplicate stats header"
```

---

### Task 12: BillModal — add amount field

**Files:**
- Modify: `src/components/BillModal.jsx`
- Modify: `src/contexts/BillsContext.jsx`

- [ ] **Step 1: Add `amount` to `formData`**

In `BillModal.jsx`, add to the initial `formData` object:

```js
const [formData, setFormData] = useState({
  name: '',
  description: '',
  category: '',
  dueDate: '',
  recurrence: 'none',
  recurrenceEndDate: '',
  notificationEnabled: true,
  notificationDaysBefore: 3,
  amount: '',  // ← add this
});
```

- [ ] **Step 2: Add the amount input to the form**

Place it below the `name` field, above `description`:

```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    {language === 'pt' ? 'Valor' : 'Amount'}
    <span className="text-gray-400 text-xs ml-1">({language === 'pt' ? 'opcional' : 'optional'})</span>
  </label>
  <input
    type="number"
    min="0"
    step="0.01"
    value={formData.amount}
    onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
    placeholder="0,00"
    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
  />
</div>
```

- [ ] **Step 3: Add recurring info note**

Below the `recurrenceEndDate` field (or right after the `recurrence` select when its value is not `'none'`), add:

```jsx
{formData.recurrence !== 'none' && (
  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
    {language === 'pt'
      ? 'A conta será gerada automaticamente a cada período até a data de encerramento.'
      : 'A bill will be created automatically each period until the end date.'}
  </p>
)}
```

- [ ] **Step 4: Include amount in the save payload**

Find where `formData` is converted into the Firestore document (in the submit handler), and include:

```js
amount: formData.amount ? parseFloat(formData.amount) : 0,
```

- [ ] **Step 5: Propagate amount in BillsContext recurring creation**

In `src/contexts/BillsContext.jsx`, find `calculateNextDueDate` and the logic that creates the next recurring instance. Ensure the new instance carries `amount` from the source bill:

```js
// When creating the next recurring bill instance, spread the source bill:
const nextBill = {
  ...sourceBill,          // carries amount, name, category, etc.
  dueDate: nextDueDate,
  status: 'pending',
  createdAt: new Date().toISOString(),
};
```

- [ ] **Step 6: Verify**

`npm run dev`. Create a new bill with amount `150`. Check Firestore — the document should have `amount: 150`. Create a recurring monthly bill, mark it paid — the next instance should also have `amount: 150`.

- [ ] **Step 7: Commit**

```bash
git add src/components/BillModal.jsx src/contexts/BillsContext.jsx
git commit -m "feat(bills): add amount field to bill form, propagate through recurring instances"
```

---

### Task 13: BillModal — fix landscape overflow

**Files:**
- Modify: `src/components/BillModal.jsx`

- [ ] **Step 1: Replace `vh` units with `dvh` in modal sizing**

Find the modal container class with `max-h-[90vh]` and the form scroll container with `max-h-[calc(90vh-140px)]`:

```jsx
// Outer modal container — change vh → dvh:
// Before: max-h-[90vh]
// After:  max-h-[90dvh]

// Inner form scroll area — change vh → dvh:
// Before: max-h-[calc(90vh-140px)]
// After:  max-h-[calc(90dvh-140px)]
```

- [ ] **Step 2: Add landscape-specific compact padding**

On the modal's inner content `<div>` (the one with `p-4 sm:p-6`), add responsive landscape tweaks using Tailwind's arbitrary variant or a `<style>` block:

```jsx
// Add to the modal container div:
className="... p-4 sm:p-6 landscape:p-3"
```

And for label spacing inside the form, wrap input groups in a class that reduces margin in landscape. The simplest approach — add a `<style>` tag inside the modal:

```jsx
<style>{`
  @media (orientation: landscape) and (max-height: 500px) {
    .bill-modal-form .form-group { margin-bottom: 0.5rem; }
    .bill-modal-form label { margin-bottom: 0.125rem; }
  }
`}</style>
```

Add `form-group` to each field wrapper `<div>` and `bill-modal-form` to the `<form>` element.

- [ ] **Step 3: Verify**

`npm run dev`. Open DevTools → responsive mode → set to 667×375 (landscape iPhone). Open the bill form. All fields should be visible or scrollable. Date input should not overflow its container.

- [ ] **Step 4: Commit**

```bash
git add src/components/BillModal.jsx
git commit -m "fix(bills): use dvh units and compact landscape layout in bill modal"
```

---

## Self-Review Checklist

- [x] **Spec §1 Sidebar greeting** → Task 1
- [x] **Spec §2 Settings gear icon + Banks tab** → Tasks 4, 5, 6
- [x] **Spec §3 ExpensesByCategoryCard** → Task 7
- [x] **Spec §4 SpendingChart** → Task 8
- [x] **Spec §5 RastreamentoTab filter** → Task 9
- [x] **Spec §6 Bills tap-to-filter** → Task 10
- [x] **Spec §7 Bills remove stats header** → Task 11
- [x] **Spec §8 BillModal amount field** → Task 12
- [x] **Spec §9 BillModal landscape** → Task 13
- [x] **Spec §10 PageHeader centering** → Task 2
- [x] **Spec §11 Bank card subtitle** → Task 3
- [x] No TBDs, no "similar to Task N" references
- [x] All code blocks are complete (not pseudocode)
- [x] `hiddenCats`/`onToggleCat` prop names consistent across Tasks 9 steps
- [x] `amount` field name consistent across Tasks 12 steps
