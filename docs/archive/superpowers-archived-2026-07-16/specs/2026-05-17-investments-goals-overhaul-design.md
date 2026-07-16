# Investments — Goals Overhaul & List Fix

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

Three changes to the Investments section:

1. **Rename layers/sublayers → goals/products** — user-facing language only; the underlying `plannerGoalId` field and Firestore schema stay the same.
2. **Fix the investment list showing only one investment** — diagnose and fix the data/render bug.
3. **Better investment page UX** — goal-centric view, progress indicators, cleaner list.

---

## 1. Terminology: Layers → Goals

### Problem

"Camadas" (layers) and "Sublayers" are engineering metaphors. Users don't think about their portfolio as "layers." They think in goals: "Emergência", "Aposentadoria", "Carro", "Filhos."

### Change

All user-visible strings are renamed. The data model (Firestore fields, `plannerGoalId`, `walletVersions`) is **unchanged** — no migration needed.

| Before | After |
|---|---|
| Camada | Meta |
| Sublayer / Sublayers | Produto / Produtos |
| "Adicionar Camada" | "Nova Meta" |
| "Adicionar Sublayer" | "Adicionar Produto" |
| `LayerModal` title | "Meta de Investimento" |
| `SublayerModal` title | "Produto" |
| `WalletLayerSection` heading | uses `layer.label` (user-defined) — no change |
| PageHelp text | Updated to use "metas" language |
| `LayerAllocationEditor` label | "Suas Metas" |

Component file names (`WalletLayerSection.jsx`, `LayerModal.jsx`, `SublayerModal.jsx`) are **not renamed** — only the rendered strings change. Renaming files would break imports across many files for zero user-facing benefit.

---

## 2. Fix Investment List Bug

### Symptoms

The "Lista" tab in `Investments.jsx` shows only one investment even when multiple exist in Firestore.

### Root Causes (two independent issues)

**Issue A — `InvestmentItem` defined inside the render function:**

```jsx
// CURRENT (bug): component re-created on every render → React unmounts/remounts each item
export default function InvestmentsPage() {
  // ...
  const InvestmentItem = ({ investment }) => { ... }; // ← inside render!
  return <>{sortedInvestments.map(inv => <InvestmentItem key={inv.id} ... />)}</>
}
```

When `InvestmentItem` is defined inside `InvestmentsPage`, React sees a *new component type* on each render, causing it to unmount + remount every list item. This causes visual flicker and, combined with the loading state, may result in only the last-rendered item staying mounted.

**Fix:** Move `InvestmentItem` outside `InvestmentsPage` as a named export or a module-level component. Pass the required props explicitly.

```jsx
// CORRECT: defined at module level, stable reference across renders
function InvestmentItem({ investment, onNavigate, formatCurrency, t, language, getBankInfo, getInvestmentType }) {
  // ... same body
}

export default function InvestmentsPage() {
  // ... uses <InvestmentItem key={inv.id} investment={inv} onNavigate={handleInvestmentClick} ... />
}
```

**Issue B — Possible missing Firestore composite index:**

The `investments` collection query uses `where('userId', '==', ownerId)`. If a `createdAt` sort is added in the future (or already present in an older deploy), Firestore requires a composite index for `userId` + `createdAt`. A missing index causes the query to return 0 or 1 results silently in the client SDK.

Check `firestore.indexes.json` for the investments collection index. If missing, add:

```json
{
  "collectionGroup": "investments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

---

## 3. Better Investment UX — Goal-Centric View

### Current Structure

The `Investments.jsx` page has two subtabs:
- **Plano** — shows `CarteiraTab` (the layer/goal allocation editor from the Planner)
- **Lista** — shows all investments as a flat list

### Problem

The "Plano" tab shows a planning tool designed for the Planner page, crammed into the Investments page. Users can't see how their actual investment list relates to their goals. There's no progress feedback per goal.

### New Structure

Rename the two subtabs:

| Before | After |
|---|---|
| Plano | Metas |
| Lista | Ativos |

**Metas tab** keeps `CarteiraTab` but adds a small connection between each goal (layer) and the actual investments tagged to it:

Each goal card (`WalletLayerSection`) already shows `taggedTransactions` for that goal's `plannerGoalId`. Extend this to also show the count and total of `investments` with `plannerGoalId === layer.id`. This gives users a "planned vs. actual" view per goal:

```
┌─ 🌱 Emergência ──────────────────────────────────┐
│  Meta: R$ 30.000   Alocado: 20%   R$ 1.200/mês  │
│  ─────────────────────────────────────────────── │
│  Ativos vinculados: 3 investimentos · R$ 28.500  │
│  [CDB Nubank] [Tesouro Selic] [CDB Inter]        │
└──────────────────────────────────────────────────┘
```

**Ativos tab** improvements:
1. **Group by goal** — investments with a `plannerGoalId` are grouped under their goal name. Investments without a goal go under "Sem meta".
2. **Progress bar per group** — total invested in group vs. the goal's `goalTarget` (from sublayer).
3. **"Link to goal" action** — on each investment card, a small dropdown lets the user assign it to a goal. Currently there's no UI to set `plannerGoalId` after creation.

### Investment Card — Improved

Current card shows: icon, name, type badge, bank, date, amount.

Add:
- **Current value** (from `calculateProjectedValue`) alongside initial amount, with a small `+X%` or `+R$ X` delta.
- **Goal badge** — if `plannerGoalId` is set, show the goal's label as a small chip.

```
┌───────────────────────────────────────────────┐
│ 📈  CDB Banco Inter                 [Renda Fixa]│
│     🏦 Inter  ·  Jan 2025           [Emergência]│
│     R$ 5.000,00  →  R$ 5.234,10  (+4,68%)      │
└───────────────────────────────────────────────┘
```

### InvestmentForm — Add Goal Selector

`src/pages/InvestmentForm.jsx` and `src/components/InvestmentModal.jsx` need a "Meta de investimento" selector that lists the user's current goals (layers from `walletVersions`) and sets `plannerGoalId` on save.

Currently `plannerGoalId` can only be set via the Planner's `WalletSublayerCard` (by tagging a transaction). The investment form should also expose it.

---

## Data Model — No Changes

`plannerGoalId` on `investments` documents continues to reference a layer ID from `walletVersions` in the planner state. No migration. The Planner's `CarteiraTab` also uses `plannerGoalId` on `transactions` — that is separate and unchanged.

---

## Out of Scope

- Renaming Firestore fields (`plannerGoalId` stays).
- Replacing `walletVersions` storage structure.
- Automated goal completion detection.
- Portfolio rebalancing suggestions.
