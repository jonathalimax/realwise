# Carteira Tab Redesign — Design Spec

**Date:** 2026-04-06  
**Status:** Approved  
**Scope:** Full redesign of the Carteira tab in PlannerPage

---

## Goal

Transform the Carteira tab into a monthly investment driver: the user can see exactly how their 20% savings allocation is distributed across layers and sublayers for the selected month, track progress toward each goal, and get AI-powered whole-wallet analysis with accept/reject suggestions that apply from the selected month forward.

---

## Data Model

### `walletVersions` (replaces `savingsRows` + `investmentClasses`)

Stored in Firestore at `planner/{ownerId}` alongside existing planner fields.

```ts
type WalletVersion = {
  from: string;           // 'YYYY-MM' — effective from this month forward
  layers: WalletLayer[];
};

type WalletLayer = {
  id: string;             // e.g. 'liquidez', 'crescimento', or user-defined UUID
  label: string;          // e.g. 'Liquidez'
  icon: string;           // emoji
  pct: number;            // % of monthly investable amount (all layers must sum to 100)
  sublayers: WalletSublayer[];
};

type WalletSublayer = {
  id: string;             // stable identifier (UUID for user-created, legacy id for migrated)
  label: string;
  icon: string;           // emoji
  type: string;           // 'Renda Fixa' | 'FII' | 'ETF' | 'Ações' | 'Cripto' | 'Misto' | 'Outro'
  bank: string;           // matches registered bank name, or ''
  description: string;    // free-text note (e.g. 'CDB liq. diária / Tesouro Selic')
  mode: 'pct' | 'value';  // how monthly contribution is specified
  pct: number;            // % of layer allocation (used when mode === 'pct')
  value: number;          // fixed R$ monthly (used when mode === 'value')
  goalTarget: number;     // 0 = ongoing/no target
  manualBalance: number;  // fallback when no investments/transactions are linked
  returnPct: number;      // gross monthly return % (used for FV projections)
  taxRate: number;        // IRPF % applied to return (e.g. 15)
  instruments: Instrument[]; // recommended investment instruments
};

type Instrument = {
  name: string;
  type: string;           // 'Renda Fixa' | 'FII' | 'ETF' | 'Ações' | 'Cripto'
  alloc: number;          // % within this sublayer
};
```

### Key helpers in `usePlannerState`

```js
// Returns the most recent WalletVersion where version.from <= month
function getActiveVersion(walletVersions, month) { ... }

// Writes a change for a specific month:
// - If a version already exists with from === month, mutate it in place
// - Otherwise clone the active version, set from = month, insert into array (sorted)
function updateWalletForMonth(month, patchFn) { ... }
```

### Migration

On first load, `migrateState()` detects the absence of `walletVersions` and converts existing data:
- Each `savingsRow` becomes a `WalletSublayer` in its respective layer
- `investmentClasses` become sublayers inside the `crescimento` layer
- Layer `pct` values default to: Liquidez 30, Crescimento 40, Patrimônio 20, Legado 10
- Wrapped in a single `WalletVersion` with `from` = `plannerStartDate`

---

## UI Structure

### Top-level layout (top → bottom)

1. **CarteiraDashboard** — dark strip: total patrimony, monthly investable amount, emergency fund progress, current focus goal
2. **AnalysePanel** — purple gradient button; below it, pending suggestions list (only visible after analysis runs)
3. **LayerAllocationEditor** — colored % tiles (one per layer), stacked bar, "+ Adicionar camada"
4. **WalletLayerSection** ×N — one per layer, each containing sublayer cards + "+ Adicionar sublayer"

---

## Components

### `CarteiraDashboard`
- Reads `getActiveVersion(selectedMonth)` for layer/sublayer data
- Same 4 hero metrics as today: patrimony, monthly investable, emergency months covered, priority focus goal
- No changes to this component beyond data source

### `LayerAllocationEditor`
- Displays one tile per layer with: icon, label, R$/month computed amount, editable % input
- Stacked color bar reflects layer %s live
- Validation: warns when total ≠ 100% (does not block saving)
- "+ Adicionar camada" opens `LayerModal`
- On change: calls `updateWalletForMonth(selectedMonth, patch)`

### `WalletLayerSection`
- Header: icon, label, description, total R$/month · buttons: ✨ Pesquisar (existing Gemini), ✏️ edit, 🗑 delete
- Deleting a layer requires confirmation; sublayers are also removed
- Grid of `WalletSublayerCard` below the header
- "+ Adicionar sublayer" dashed card at end of grid

### `WalletSublayerCard`
- Shows: icon, label, type badge, description, bank chip, monthly contribution, gross return %, net return after IRPF (computed: `returnPct × (1 - taxRate/100)`), goal progress bar (if goalTarget > 0), linked investments/transactions
- ✏️ opens `SublayerModal`, ✕ deletes after confirm

### `SublayerModal` (add / edit)
Fields:
- Icon (emoji input), Name (text)
- Type (dropdown: Renda Fixa / FII / ETF / Ações / Cripto / Misto / Outro)
- Banco / Corretora (dropdown from registered banks + "Nenhum")
- Retorno bruto % a.m. — live preview shows net return after IRPF
- Alíquota IRPF %
- Aporte: toggle % da camada / Valor fixo R$ — shows remaining unallocated hint
- Meta: toggle Com meta / Reserva contínua — shows R$ input when active
- Descrição (optional free text)
- Save / Delete buttons

### `LayerModal` (add / edit)
Fields: Icon (emoji), Label (text), Color (preset palette matching existing layer colors)

### `AnalysePanel`
- Purple gradient button: "✨ Analisar Carteira"
- Clicking opens `GoalPriorityModal`
- After analysis: suggestions list appears inline below the button
- Each suggestion card: type badge (Alocação / Instrumento / Sublayer), title, reason, ✓ / ✕ buttons
- Suggestions shown in AI-recommended order of importance
- Counter: "N aceitas · M rejeitadas · K pendentes"
- "Salvar mudanças aceitas" button: applies all accepted suggestions via `updateWalletForMonth(selectedMonth, patches)` → creates new wallet version from selected month forward; clears the panel

### `GoalPriorityModal`
- Title + subtitle explaining the flow
- Drag-to-reorder list of all sublayers (showing icon, label, current progress)
- Optional free-text context textarea
- "Gerar análise com IA" CTA
- AI call: sends full active wallet config + goal priorities + context to Gemini; parses structured JSON response into suggestion array
- Error handling: displays error message inline (including Gemini quota errors with a note to check billing)

---

## Temporal Model

- **Reading:** `getActiveVersion(walletVersions, selectedMonth)` is used everywhere in the tab
- **Writing:** all edits (layer %, sublayer fields, new layers/sublayers) call `updateWalletForMonth(selectedMonth, patch)`
  - If the active version's `from === selectedMonth` → mutate in place (same version)
  - If `from < selectedMonth` → clone + insert new version with `from = selectedMonth`
  - Past months are never modified
- **Viewing past months:** read-only — edit buttons are hidden when `selectedMonth` is before the current calendar month. Present and future months are always editable.

---

## Allocation Rules

- Layer `pct`s: editable, no hard enforcement to sum to 100, but a warning is shown
- Sublayer contributions within a layer:
  - If `mode = 'pct'`: stored `pct` values are user-set; the last sublayer's card displays "using remainder" and shows the leftover % as its effective contribution (stored pct is not mutated)
  - If `mode = 'value'`: fixed R$ amounts; any unallocated layer budget is shown as "não alocado"
  - Mixed modes within a layer are allowed

---

## IRPF Display

- Per sublayer: `netReturn = returnPct × (1 - taxRate / 100)`
- Shown as "Líquido: X% a.m." in the card and modal
- Used for display/projection only — not for computing actual balances (those come from linked investments/transactions)

---

## Transaction & Investment Linking

- Existing behavior preserved: investments tagged with `plannerGoalId` are matched to sublayer by `id`
- Transactions with `plannerGoalId` are also matched
- Balance priority: linked investments + transactions → fallback to `manualBalance`

---

## Out of Scope

- Gemini quota fix (deferred — user to upgrade plan manually)
- Full IRPF tax table by holding period (simple fixed rate per sublayer only)
- Historical wallet version viewer / diff UI

---

## Files Changed

| File | Action |
|------|--------|
| `src/pages/planner/usePlannerState.js` | Add `walletVersions`, `getActiveVersion`, `updateWalletForMonth`, migration logic |
| `src/pages/planner/CarteiraTab.jsx` | Full rewrite using new data model and components |
| `src/pages/planner/PlannerPage.jsx` | Pass `selectedPlannerMonth` to CarteiraTab (minimal change) |
