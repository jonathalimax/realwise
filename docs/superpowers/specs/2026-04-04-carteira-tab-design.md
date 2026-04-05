# Carteira Tab — Investment Plan Progress Tracker

**Date:** 2026-04-04  
**Status:** Approved

## Goal

Add a "Carteira" tab to the Planner that shows the 5 investment classes from the user's financial plan, with real progress driven by actual investment records from Firestore. Hide the standalone Investimentos page from the sidebar to avoid duplication.

---

## Architecture

### Data Sources

| Source | What it provides |
|--------|-----------------|
| `usePlannerState` | `state.investmentClasses` (name, pct, returnPct, vehicle), `savingsComputed.livresPhase2` (monthly free amount to invest) |
| `InvestmentContext` | `investments[]` (live Firestore records), `getCurrentValue(inv)` (projected current value per record), `loading` |

No new Firestore reads. CarteiraTab is a pure display component derived from two already-loaded sources.

### Type Mapping

A module-level constant in `CarteiraTab.jsx` bridges the planner class names to InvestmentContext types:

```js
const CLASS_TYPE_MAP = {
  'Renda Fixa (CDB/Tesouro)': ['fixed_income'],
  'Exterior ETFs':            ['funds'],
  'FIIs':                     ['fii'],
  'Ações Dividendos':         ['stocks'],
  'Cripto':                   ['crypto'],
};
```

`real_estate` type is intentionally unmapped — it belongs to patrimônio, not investimentos.

### Per-Class Computed Values

For each investment class:

- **Current value** — `investments.filter(inv => mappedTypes.includes(inv.type)).reduce((sum, inv) => sum + getCurrentValue(inv), 0)`
- **Monthly PMT** — `Math.max(0, livresPhase2 * cls.pct / 100)` (clamped at 0)
- **Goal (20-year FV)** — `PMT * ((Math.pow(1 + r, n) - 1) / r)` where `r = cls.returnPct / 100` (monthly rate), `n = 240` (20 × 12 months). If `r === 0`, fallback to `PMT * n`.
- **Remaining** — `Math.max(0, goal - current)`
- **Progress %** — `Math.min(100, current / goal * 100)`

---

## Components

### `CarteiraTab.jsx` (new file)

**Props:**
```js
{
  state,           // from usePlannerState — investmentClasses, pct, returnPct, vehicle
  livresPhase2,    // number — monthly investable amount after fixed savings
}
```

**Internal hooks:**
```js
const { investments, getCurrentValue, loading } = useInvestments();
```

**Layout:** `space-y-4` stack of class cards. On `sm:` screens, cards render in a `grid grid-cols-2` with the last card spanning full width if count is odd.

**Per-class card structure:**
1. **Header row** — colored icon + class name + `pct%` badge
2. **Vehicle line** — muted text, e.g. "Tesouro Selic / CDB 115% CDI"
3. **Linked investments list** — each matched investment shows: name + bank chip + current value. If `loading`: shimmer rows. If empty: "Nenhum investimento registrado" in muted style.
4. **Progress section:**
   - Three stat rows: `Atual` / `Meta (20 anos)` / `Faltam`
   - Progress bar colored by class, capped at 100%
   - If `current ≥ goal`: show "Meta atingida!" in green, bar at 100%
5. **Footer** — "Aporte mensal planejado: R$ X" using `livresPhase2 × pct%`

### `PlannerPage.jsx` (modify)

Add to `TABS` array between Sistema and Dashboard:
```js
{ value: 'carteira', label: 'Carteira' }
```

Add `TabsContent` for `carteira` that renders `<CarteiraTab>` with `state` and `livresPhase2={savingsComputed.livresPhase2}`.

### Sidebar nav (modify)

Remove the Investimentos entry from the sidebar navigation component. The route (`/investments`) remains intact — only the nav link is hidden. This is non-destructive and reversible.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| `InvestmentContext` still loading | Shimmer rows inside each class card's investment list |
| No investments match a class | "Nenhum investimento registrado" muted message |
| Current value ≥ goal | Progress bar 100%, "Meta atingida!" label in green |
| `livresPhase2` is negative | Monthly contribution shows R$ 0 (clamped) |
| `real_estate` investment type | Silently ignored — not mapped to any class |

---

## File Map

| File | Action |
|------|--------|
| `src/pages/planner/CarteiraTab.jsx` | Create |
| `src/pages/planner/PlannerPage.jsx` | Modify — add Carteira tab |
| Sidebar nav component | Modify — hide Investimentos link |

---

## Out of Scope

- Editing investment records from CarteiraTab (read-only view)
- Custom goal overrides per class (uses computed 20y FV only)
- Filtering by time horizon (20 years fixed)
- `real_estate` investment type mapping
