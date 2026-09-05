# UI Polish: Sidebar, Bills, Charts — Design Spec

**Date:** 2026-04-29  
**Branch:** feat/productization

---

## Context

A batch of UX polish across five areas:

1. Sidebar greeting and Settings placement
2. Banks page → inside Settings
3. ExpensesByCategoryCard + SpendingChart — simplify category rows
4. RastreamentoTab / CategoryTrendChart — integrate filter UI inside card
5. Bills: tap-to-filter, remove duplicate stats header, add amount field, fix landscape overflow

---

## 1. Sidebar Greeting

### Problem
The sidebar brand block shows the raw app name "Moneywise" and below it the raw email prefix ("jonathalimax") when no `displayName` is set.

### Design
Replace the sub-label with a personalized greeting:

- If `auth.currentUser.displayName` exists: **"Olá, {firstName}"** where `firstName = displayName.split(' ')[0]`
- If no displayName (falls back to email): **"Olá novamente"**

**File:** `src/components/Sidebar.jsx` — brand block, the `<p>` element that reads `auth.currentUser.displayName || auth.currentUser.email?.split('@')[0]`.

---

## 2. Settings as Footer Icon + Banks Inside Settings

### Problem
- Settings is a full nav item taking up vertical space when it could be a compact icon.
- Banks (the `/cards` route) is a top-level nav item; it belongs under Settings since it's a configuration concern.

### Design

**Sidebar footer changes (`src/components/Sidebar.jsx`):**
- Remove `Settings` from the `navigation` array.
- Remove `Cards` (Banks) from the `navigation` array.
- Add a gear icon `<NavLink to="/settings">` as an icon-only button in the footer actions row, placed to the left of `<ThemeToggle />`. The row becomes: `[gear icon] [ThemeToggle]`.
- The gear icon uses `Cog6ToothIcon` (already imported), sized `w-5 h-5`, same violet active / gray inactive color as nav items. No label. Tooltip/title="Configurações".
- The row becomes: `[gear icon] [ThemeToggle]`. No language toggle.

**Settings page changes (`src/pages/Settings.jsx`):**
- Add a 4th tab button: **"Bancos"** (pt) / **"Banks"** (en), tab key `'banks'`.
- When `activeTab === 'banks'`, render the Banks/Cards management UI. This is currently the full `src/pages/Cards.jsx` content. Extract the bank management JSX into a `<BanksTabContent />` component in `src/pages/Settings.jsx` (or a separate `src/components/BanksSettings.jsx`), then import it.
- The existing `/cards` route can stay but redirect to `/settings?tab=banks` for backward compatibility with any deep links or FAB button.
- The `handleOpenCards` in `src/pages/Dashboard.jsx` and the FAB "Meus Bancos" entry currently navigate to `/cards`. Update these to navigate to `/settings?tab=banks`.

**Settings tab bar:** Adjust width — currently 3 tabs fill the row. 4 tabs at equal width still fits at mobile sizes (`flex-1` or `min-w-0` per tab).

---

## 3. ExpensesByCategoryCard — Remove Limit Display

### Problem
Each row shows `percentage / limit`. The limit makes the row dense; the user only wants current spend + percentage.

### Design (`src/components/ExpensesByCategoryCard.jsx`)

**Per row, show:**
- Left: icon + category name
- Right: **`{formatCurrency(row.amount)}`** (currency in bold) + `{row.pct.toFixed(0)}%` (dimmed, below or inline)
- Progress bar: always use palette color (not status-based red), width = `(row.amount / total) * 100`
- Remove: limit sub-label, "Limit exceeded" badge, any conditional limit coloring

The `pct` computation should change to `row.amount / total * 100` (relative to the month's total spend, not against a budget limit). This matches what the user wants: how much of their total spending went to each category.

---

## 4. SpendingChart (Rastreamento) — Remove Limit Display

### Problem
Same as above — `SpendingChart` shows `value / limit` per row. User wants only `value` + percentage.

### Design (`src/components/charts/SpendingChart.jsx`)

**Per category button in the 2-column grid:**
- Right-side label: always just `formatCurrency(item.value)` (remove the `/ formatCurrency(item.limit)` branch)
- Progress bar: remove entirely (it only made sense against a limit). Without a limit anchor, a bar adds no information.
- Percentage chip: change to show `(item.value / total * 100).toFixed(0)%` always (remove the `— ` no-limit fallback)

The pie chart and total remain unchanged.

---

## 5. RastreamentoTab — Filter UI Inside Card

### Problem
`CategoryTrendChart` renders its category toggle chips *inside* the chart component as a `flex-wrap` row. They feel disconnected from the card chrome in `RastreamentoTab`.

### Design

**`src/pages/planner/CategoryTrendChart.jsx`:**
- Lift the legend chips out of the component's own JSX. Instead, accept a `hiddenCats` + `onToggleCat` + `categories` prop so the parent can render the chips.
- The chart itself just renders the `BarChart` based on received `hiddenCats`.

**`src/pages/planner/RastreamentoTab.jsx` — CategoryTrendChart card header:**
- Add state: `catSearch` (string), `hiddenCats` (Set) — same logic currently in `CategoryTrendChart`, lifted here.
- In the card header row, place a small search `<input>` (placeholder "Buscar categoria…") and the category chips side-by-side in a `flex flex-wrap gap-2 items-center` row below the title.
- Chips that don't match `catSearch` are visually dimmed but still shown (filter is additive — don't hide non-matching, just help the user find the one to toggle).
- Pass `hiddenCats` and `onToggleCat` down to `CategoryTrendChart`.

---

## 6. Bills: Tap-to-Filter from Dashboard

### Problem
`BillsSummaryCard.handleClick` navigates to `/bills` with no context — the status filter is not passed.

### Design

**`src/components/BillsSummaryCard.jsx`:**
- The card has a "pending" count section and a "paid" count section. Make each clickable with its own handler:
  - Pending section → `navigate('/bills?status=pending')`
  - Paid section → `navigate('/bills?status=paid')`
  - Card-level click (if clicking the header/total area) → `navigate('/bills')` (no filter)

**`src/pages/Bills.jsx`:**
- On mount, read `useSearchParams()` and initialise `statusFilter` from `?status=` if present. Values: `all | pending | paid | overdue`.
- The existing filter buttons stay — they just work as override controls once on the page.

---

## 7. Bills Page — Remove Duplicate Stats Header

### Problem
Bills.jsx has a 4-card stats grid (Total / Pending / Paid / Overdue) at the top. The `BillsList` card already shows this information internally.

### Design (`src/pages/Bills.jsx`)
- Remove the 4-card stats grid section entirely (the `<div className="grid grid-cols-2 sm:grid-cols-4 ...">` block and its useMemo computations for `totalAmount`, `pendingAmount`, `paidAmount`).
- Keep: the status filter button row and the email reminders toggle.
- Keep: the `<BillsList>` component.

---

## 8. BillModal — Add Amount Field

### Problem
`BillModal` has no `amount` field. Bills' monetary values are never captured.

### Design (`src/components/BillModal.jsx`)

**Add to `formData`:**
```js
amount: 0,
```

**New input** — place it below `name`, above `description`:
- Label: "Valor" / "Amount"
- Type: `number`, `min="0"`, `step="0.01"`
- Placeholder: "0,00"
- Not required (some bills may be variable).

**Recurring clarification to surface in UI:**  
When `recurrence !== 'none'`, show an info note:
> "A conta será gerada automaticamente a cada período até a data de encerramento."

This makes it clear that the system creates a new instance per period (the existing `calculateNextDueDate` logic in `BillsContext` handles this). The amount is stored on each auto-created instance.

**`src/contexts/BillsContext.jsx`:**
- Ensure `addBill` passes `amount` from `billData` to Firestore. Verify `calculateNextDueDate`-triggered copies also carry `amount` forward.

---

## 9. BillModal — Landscape Overflow Fix

### Problem
On landscape mobile, the modal's `max-h-[90vh]` clips the form because viewport height is very small in landscape (~400px). Date input and other fields overflow.

### Design (`src/components/BillModal.jsx`)

- Change outer container from `max-h-[90vh]` to `max-h-[90dvh]` (`dvh` = dynamic viewport height, accounts for browser chrome).
- Change inner form scroll area from `max-h-[calc(90vh-140px)]` to `max-h-[calc(90dvh-140px)]`.
- Add `@media (orientation: landscape) and (max-height: 500px)` targeting: reduce padding inside the modal (`p-4` → `p-3`, reduce label/input `mb-` gaps) so more fields are visible without scrolling.
- For the date input specifically: ensure it uses full `w-full` width and does not get squeezed by adjacent flex siblings. The two date inputs (`dueDate` + `recurrenceEndDate`) should each be full-width block rows, not in a side-by-side layout at small heights.
- Test at iPhone SE landscape (375×667 rotated = 667×375) and similar.

---

## 10. PageHeader — Hamburger Centered with Title on Mobile

### Problem
The current `PageHeader` is a `flex` row: `[hamburger] [title flex-1] [month nav]`. The title is left-aligned immediately after the hamburger, making the header feel unbalanced — visible in the screenshot where "MEUS BANCOS" hugs the left side.

### Design (`src/components/PageHeader.jsx`)

Replace the single `flex` row with a **3-column grid** on mobile:

```
grid grid-cols-[2.5rem_1fr_auto]  (mobile only, sm:flex sm:items-center)
```

- **Column 1 (left, fixed `2.5rem`):** hamburger / back button — `flex items-center justify-start`
- **Column 2 (center, `1fr`):** `<h1>` with `text-center` — always horizontally centered regardless of left/right widths
- **Column 3 (right, `auto`):** month nav + `right` prop — `flex items-center justify-end`

On `sm:` and larger, revert to the current `flex` layout (desktop sidebar is visible, hamburger is hidden).

The left and right column widths need to be balanced so the title centers against the full header. Since the hamburger is `2.5rem` (`w-10`) and the right side (month nav) is variable, use `grid-cols-[2.5rem_1fr_2.5rem]` as a minimum, letting the right column overflow naturally. Or use the simpler `absolute` approach: keep the `flex` row, but make `<h1>` `absolute inset-0 flex items-center justify-center pointer-events-none` (behind the interactive elements). The absolute approach is simpler and avoids grid complexity.

**Recommended: absolute title**
```jsx
<div className="relative flex items-center h-14 sm:h-16 px-4">
  {/* Left: hamburger or back */}
  <div className="md:hidden flex-shrink-0 z-10">...</div>
  {/* Center: title — absolute, full width, pointer-events-none */}
  <h1 className="absolute inset-x-0 text-center ...">
    {displayTitle}
  </h1>
  {/* Right: month nav */}
  <div className="ml-auto flex items-center gap-2 z-10">...</div>
</div>
```

This guarantees perfect center alignment without any width calculations.

---

## 11. Bank Card — Fix Line-Breaking Subtitle

### Problem
In the `BankItem` component (`src/pages/Cards.jsx`), the subtitle row renders:

```
Nubank · Dia de fechamento: 20 · Dia de pagamento: 27
```

Each segment is a `<span>` inside a plain `flex items-center gap-2` row with no `whitespace-nowrap`, so "Dia de fechamento:" and "Dia de pagamento:" wrap to the next line on narrow screens (as visible in the screenshot).

### Design (`src/pages/Cards.jsx`, `BankItem` component)

Two changes:

1. **Shorten the labels:** Replace verbose i18n keys with compact inline text:
   - `{t('cards.closingDay')}: {userBank.closingDay}` → `Fecha dia {userBank.closingDay}`
   - `{t('cards.paymentDay')}: {userBank.paymentDay}` → `Paga dia {userBank.paymentDay}`
   - In English: `Closes {day}` / `Due {day}`

2. **Prevent wrapping:** Add `whitespace-nowrap` and `overflow-hidden` to the subtitle `<div>`, and `flex-shrink-0` to each `<span>`. Alternatively, replace the separator dots with a single inline string: `{subtitleName} · Fecha {closingDay} · Paga {paymentDay}` rendered as one `<p className="truncate">`.

**Resulting card subtitle (pt):**
```
Nubank · Fecha dia 20 · Paga dia 27
```
This fits on one line even at 320px width.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/Sidebar.jsx` | Greeting, remove Settings/Cards from nav, add gear icon to footer |
| `src/pages/Settings.jsx` | Add Banks tab, render BanksTabContent |
| `src/pages/Cards.jsx` | Extract JSX into `BanksTabContent` component (or inline in Settings) |
| `src/pages/Dashboard.jsx` | Update FAB "Meus Bancos" → navigate `/settings?tab=banks` |
| `src/components/ExpensesByCategoryCard.jsx` | Show amount+pct, remove limit, recompute pct vs total |
| `src/components/charts/SpendingChart.jsx` | Remove limit display, remove progress bar, show pct vs total |
| `src/pages/planner/CategoryTrendChart.jsx` | Accept `hiddenCats`/`onToggleCat`/`categories` props, remove internal chip state |
| `src/pages/planner/RastreamentoTab.jsx` | Lift category filter state here, add search input in card header |
| `src/components/BillsSummaryCard.jsx` | Make pending/paid sections navigate with `?status=` param |
| `src/pages/Bills.jsx` | Read `?status=` on mount, remove duplicate stats grid |
| `src/components/BillModal.jsx` | Add amount field, landscape overflow fixes (`dvh`, compact landscape layout) |
| `src/contexts/BillsContext.jsx` | Ensure `amount` propagates through recurring instance creation |
| `src/components/PageHeader.jsx` | Center title absolutely on mobile; hamburger left, month nav right |
| `src/pages/Cards.jsx` | Compact subtitle labels + `whitespace-nowrap` to prevent line-breaks |

---

## Verification

1. **Sidebar:** Open app — greeting shows "Olá, Jonatha". No Settings or Banks in nav. Gear icon in footer links to Settings.
2. **Settings → Banks tab:** Add/remove a bank account — works identically to the old `/cards` page.
3. **Dashboard → FAB "Meus Bancos":** Navigates to `/settings?tab=banks`.
4. **ExpensesByCategoryCard:** Each row shows currency + `%`, no limit, progress bar uses palette colors.
5. **SpendingChart (Rastreamento):** Category rows show only currency value + percentage relative to total. No `/limit` text. No progress bars.
6. **CategoryTrendChart:** Search input in card header filters category chips. Toggle chips hide/show bar series. Layout is `flex` row with chips + search side-by-side.
7. **Dashboard BillsSummaryCard:** Tapping pending section → `/bills?status=pending` → pending filter pre-applied on Bills page. Same for paid.
8. **Bills page:** No 4-card stats grid at top. Status filter buttons present. BillsList card shows its own internal summary.
9. **BillModal:** Amount field visible. On save, amount is stored in Firestore. Recurring info note appears when recurrence != none.
10. **BillModal landscape:** Open on a narrow landscape viewport (Safari DevTools 667×375) — all fields visible, date inputs not overflowing, form scrollable.
11. **PageHeader mobile:** On any page, title is perfectly centered between the hamburger (left) and month nav (right) at 375px width.
12. **Bank cards:** The subtitle row shows `Nubank · Fecha dia 20 · Paga dia 27` on a single line at 320px width. No line wraps.
