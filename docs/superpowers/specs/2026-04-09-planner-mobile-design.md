# Planner Mobile Improvements — Design Spec

**Date:** 2026-04-09  
**Scope:** `src/pages/planner/` only — no other pages affected  
**Strategy:** Mobile-only layout changes via Tailwind responsive prefixes. Desktop layout is entirely unchanged.

---

## Problems Being Solved

| # | Problem | Location |
|---|---------|----------|
| 1 | Header occupies ~110px before any content on mobile | `PlannerPage.jsx` |
| 2 | Tab bar requires horizontal swipe; easy to miss tabs | `PlannerPage.jsx` |
| 3 | Limite category rows overflow/clip on narrow screens | `AllocationTab.jsx` |

---

## Change 1 — Compact Mobile Header

### Behaviour
- **Mobile (`< sm`):** Single-row header — title + month nav + ⚙️ gear button, all in one `flex` row. ~44px total.
- **Desktop (`sm:`):** Existing multi-row header with "Início do plano" input and "Mês selecionado" label remains exactly as-is.

### Gear button
- Tapping ⚙️ opens a small bottom sheet (modal overlay anchored to the bottom of the screen).
- Bottom sheet contains only the "Início do plano" `<input type="month">` field.
- Dismisses on backdrop tap or a close button.
- Implemented as local React state (`showSettings`) in `PlannerPage.jsx`. No new context or file needed.

### Implementation pattern
```jsx
{/* Mobile header — hidden on sm+ */}
<div className="flex items-center gap-2 sm:hidden px-4 py-3">
  <h1 className="flex-1 text-lg font-bold">Planejador</h1>
  <MonthNav ... />
  <button onClick={() => setShowSettings(true)}>⚙️</button>
</div>

{/* Desktop header — hidden on mobile */}
<div className="hidden sm:flex ...">
  {/* existing header unchanged */}
</div>

{/* Settings bottom sheet */}
{showSettings && (
  <div className="fixed inset-0 z-50 flex items-end sm:hidden" onClick={() => setShowSettings(false)}>
    <div className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
      <label>Início do plano</label>
      <input type="month" ... />
    </div>
  </div>
)}
```

---

## Change 2 — Bottom Tab Bar (Mobile)

### Behaviour
- **Mobile (`< sm`):** Fixed bottom navigation bar with 4 icon+label items. `position: fixed; bottom: 0`.
- **Desktop (`sm:`):** Existing top `<Tabs>` / `<TabsList>` component remains, `sm:block`. Bottom nav is `sm:hidden`.
- Active tab highlighted in violet (`text-violet-600`), inactive in gray.
- Tab state is lifted — a single `activeTab` string drives both the top bar (desktop) and bottom bar (mobile). Currently the Radix `<Tabs>` component manages this; we replace it with controlled `value` + `onValueChange` so both navs can set it.

### Tabs & icons
| Tab | Icon | Label |
|-----|------|-------|
| `sistema` | 🧭 | Sistema |
| `carteira` | 💼 | Carteira |
| `dashboard` | 📊 | Dashboard |
| `allocation` | 📐 | Alocação |

### Bottom padding
Tab content area on mobile gets `pb-20` so content is never hidden behind the fixed nav bar.

### Implementation pattern
```jsx
const [activeTab, setActiveTab] = useState('sistema');

// Bottom nav (mobile only)
<nav className="fixed bottom-0 inset-x-0 sm:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex z-40 pb-safe">
  {TABS.map(tab => (
    <button key={tab.value} onClick={() => setActiveTab(tab.value)}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
        activeTab === tab.value ? 'text-violet-600 dark:text-violet-400' : 'text-gray-500'
      }`}>
      <span className="text-xl">{tab.icon}</span>
      {tab.label}
    </button>
  ))}
</nav>
```

---

## Change 3 — Limite Category Rows (2-line layout)

### Behaviour
Current single-row layout clips on screens narrower than ~390px. Replace with a consistent 2-line layout at all widths.

**Line 1:** Category name (left) + N / D / P rule buttons (right)  
**Line 2:** `% input` + `= R$ computed` + spacer + `R$ X gasto` + progress bar + `%used`

This is purely a CSS/JSX restructure inside `AllocationTab.jsx` — no logic changes.

### Before vs after
```
BEFORE (single flex row, clips):
[Alimentação] [N][D][P] [15 %] [= R$4.1k] [R$1.2k gasto] [████░░] [30%]

AFTER (two lines, never clips):
Line 1: [Alimentação                    ] [N][D][P]
Line 2: [15 %] [= R$ 4.144]    [R$ 1.2k gasto] [████░░] [30%]
```

---

## What Does NOT Change

- Desktop layout — every `sm:` class remains untouched
- All calculations, Firestore persistence, context providers
- Inner tabs inside AllocationTab (Regra / Rastreamento / Limite)
- All other pages (Home, Expenses, Bills, etc.)
- Dark mode

---

## Files Touched

| File | Change |
|------|--------|
| `src/pages/planner/PlannerPage.jsx` | Add mobile header, bottom nav, controlled tab state, settings sheet |
| `src/pages/planner/AllocationTab.jsx` | Restructure category rows to 2-line layout |

No new files. No new dependencies.
