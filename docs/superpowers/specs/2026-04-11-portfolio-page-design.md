# Portfolio Page — Design Spec

**Date:** 2026-04-11
**Status:** Approved by user

---

## Goal

A dedicated `/portfolio` page that shows the total value the user has invested, grouped by wallet layer (Liquidez, Crescimento, Patrimônio, Legado). No return calculations, no growth percentages — only invested amounts.

---

## Data Sources

Two independent sources are combined into a single portfolio view:

1. **`investments` Firestore collection** — records created via the Investments form. Value = `initialAmount` field. Type = `type` field (mapped via `INVESTMENT_TYPES`).
2. **`transactions` Firestore collection** — transactions that have a `plannerGoalId` set (linked to a wallet sublayer). Value = `amount` field. Type = `investmentType` field if present, otherwise shown without type badge.

Active investment records use `status !== 'closed'` to exclude closed positions.

---

## Grouping Logic

The page reads the active wallet version from `planner/{userId}.walletVersions` (same `getActiveVersion` logic as CarteiraTab, using the current calendar month). It extracts all layers and their sublayers.

Each portfolio item (investment or transaction) has a `plannerGoalId`. This ID matches a sublayer's `id` within a layer. Items are grouped by which layer their sublayer belongs to.

Items with no `plannerGoalId`, or whose `plannerGoalId` doesn't match any known sublayer, fall into the **"Sem vínculo"** group at the bottom.

---

## UI Structure

### 1. Header card
- **Total investido**: sum of all `initialAmount` (active investments) + all tagged `transaction.amount`
- Item count: `N ativos · M transações vinculadas`

### 2. Donut chart
- CSS `conic-gradient`, one slice per layer that has invested value > 0
- Legend: layer icon + name + percentage
- Colors match layer colors from `LAYER_COLORS` / `resolveLayerColors` (existing constants)
- No slice for "Sem vínculo"

### 3. Layer groups
One card per layer from the active wallet version, in order (Liquidez → Crescimento → Patrimônio → Legado). Each group:
- **Header row**: layer icon + label + item count badge + total invested for that layer (color-coded with layer color)
- **Item rows**: one row per investment or transaction linked to any sublayer in this layer
  - Investment row: `inv.name` · type badge · `initialAmount`
  - Transaction row: `tx.description` · type badge (from `investmentType`) · `tx.amount`
- Only layers with at least one item are rendered (empty layers are hidden)

### 4. Sem vínculo group
- Shown at the bottom, dimmed (reduced opacity)
- Contains active investments with no `plannerGoalId`
- Contains no total in the donut chart

---

## Component Architecture

### `src/pages/Portfolio.jsx`
Main page component. Owns the data-fetching and aggregation logic inline (no separate hook needed — complexity is low). Uses:
- `useInvestments()` → `investments`, `loading`
- `useAccess()` → `ownerId`
- `usePlannerLayers()` → new lightweight hook (see below)
- Local `useEffect` to fetch tagged transactions from Firestore (same pattern as `CarteiraTab/index.jsx`)

### `src/pages/planner/usePlannerLayers.js`
New lightweight hook. Reads `walletVersions` from `planner/{userId}` via `onSnapshot`, resolves the active version for the current month, and returns the layers array: `{ id, label, icon, colorKey, sublayers[] }[]`. This is analogous to `usePlannerGoals` but returns full layer+sublayer structure instead of a flat list.

No changes to `InvestmentContext` — `initialAmount` is already available.

---

## Navigation

- New route in `src/App.jsx`: `<Route path="portfolio" element={<PortfolioPage />} />`
- Add `/portfolio` to `ROOT_ROUTES` in `Sidebar.jsx` (so it shows the hamburger, not back arrow)
- Add to `navItems` in `Sidebar.jsx` after the `/planner` entry, using `BriefcaseIcon` from `@heroicons/react/24/outline` (needs to be imported)
- Add label to `labels` map in `Sidebar.jsx`: `portfolio: language === 'pt' ? 'Portfólio' : 'Portfolio'`

---

## What Is Explicitly Not Shown

- Current value / `currentAmount`
- Growth percentage or absolute growth
- Return calculations (CDI, IRPF, IOF)
- Days held
- Maturity dates
- Closed investments (`status === 'closed'`)

---

## Out of Scope

- Filtering or sorting within the portfolio
- Editing items from this page (tap-to-edit stays on the Investments page)
- Historical portfolio snapshots by month
