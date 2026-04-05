# Carteira Tab v2 — Goal-Oriented Investment Tracker

**Date:** 2026-04-04
**Status:** Approved

---

## Goal

Redesign `CarteiraTab` from a class-based view to a **goal-oriented action guide**: one card per savings goal showing where to invest, how much this month, current balance, and progress toward the target. The tab answers: "where should I put my money this month?"

---

## Source Document

Values derived from *Sistema Operacional Financeiro — Família jlima*:
- §4: Reserva de Emergência → R$ 120.000
- §6: Objetivos → Independência R$ 4M (aposentadoria meta realista R$ 6M per §8), Filhos R$ 800.000, Casa R$ 300.000
- §8: Aposentadoria → Meta realista R$ 6.000.000–7.000.000, default R$ 6.000.000
- §5: Investment assets per class

---

## Architecture

### Data Changes

**1. `plannerGoalId: string`** — new optional field on investment records in Firestore.
- Added to `InvestmentForm.jsx` as a dropdown: "Objetivo do planner" listing all savings row labels + "Nenhum"
- Added to `TransactionForm.jsx` and `EditSingleTransactionModal.jsx` as the same dropdown

**2. Per savings row — two new fields** stored inside each item of `state.savingsRows` in the planner Firestore document:
- `goalTarget: number` — R$ goal amount. Defaults listed below. Editable inline.
- `manualBalance: number` — fallback balance when no records are tagged. Default: 0.

**3. `migrateState()` update** — inject `goalTarget` and `manualBalance` defaults for any row missing them.

### Balance Source Logic

For each savings row:
1. Collect investments where `plannerGoalId === row.id` and `status !== 'closed'` → sum `getCurrentValue()`
2. Collect transactions where `plannerGoalId === row.id` and `amount > 0` → sum amounts
3. If combined total > 0 → use as `currentBalance`, show "de N registros" badge
4. If total = 0 → use `row.manualBalance`, show editable input

### Goal Target Defaults

| Row ID | Default `goalTarget` | Notes |
|--------|---------------------|-------|
| `emergencia` | `liquidezFinal × 6` | Auto-computed, editable override |
| `aposentadoria` | `6000000` | From §8 (R$ 6M) — label changed to "Independência Financeira" |
| `casa` | `400000` | User-confirmed |
| `filhos` | `800000` | From §6 |
| `mae` | `0` | Ongoing — no progress bar shown |
| `manutencao` | `3000` | Annual budget R$ 3.000 |
| `ipva` | `2000` | Annual budget R$ 2.000 |
| `matricula` | `1500` | Annual budget R$ 1.500 (monthly: R$ 125) |

Rows with `goalTarget === 0` show as "reserva contínua" — no progress bar, just current balance + monthly contribution. Only `mae` qualifies.

### Card Order (Priority from §6)

1. Fundo de Emergência
2. Aposentadoria
3. Filhos (Educação)
4. Meta Entrada Casa
5. Reserva Mãe
6. Reserva Manutenção Carro
7. Reserva IPVA
8. Reserva Matrícula

Order is determined by a priority map keyed on `row.id`.

---

## CarteiraTab UI

**Layout:** `grid-cols-1 sm:grid-cols-2 gap-4`

### Goal Card (goalTarget > 0)

```
┌─────────────────────────────────┐
│ 💧 Fundo de Emergência    Fase 1│
│ Tesouro Selic / CDB liq. diária │
│                                  │
│ [linked investments list or      │
│  manual balance input]           │
│                                  │
│ Meta:    R$ 120.000              │
│ Atual:   R$ 43.200   de 3 invest │
│ ████░░░░░░░░░░░  36%             │
│ Faltam:  R$ 76.800               │
│──────────────────────────────────│
│ Aporte este mês: R$ 2.070,84    │
└─────────────────────────────────┘
```

Elements:
- **Header**: icon + label + phase badge ("Fase 1" / "Fase 2")
- **Instrument line**: `row.onde` (e.g., "Tesouro Selic / CDB liq. diária")
- **Linked records**: list of tagged investments/transactions (name + value chip). If none: editable `manualBalance` input.
- **Stats**: Meta (editable inline) / Atual (with "de N registros" badge if auto-summed) / progress bar / Faltam
- **Footer**: "Aporte este mês: R$ X" using `isPhase2ForSelectedMonth ? row.phase2 : row.phase1`

### Ongoing Reserve Card (goalTarget === 0 — only `mae`)

Same card but without Meta / progress bar / Faltam. Shows only:
- Header + instrument
- Linked records or manual balance
- Footer with monthly contribution

### Loading State

While `InvestmentContext` loading: shimmer rows inside the linked records area of each card.

---

## Form Changes

### InvestmentForm.jsx

Add optional "Objetivo do planner" select field below the existing `goalId` field:
- Options: "Nenhum" + one entry per `savingsRow` (label + id)
- Stored as `plannerGoalId` on the Firestore investment document
- Requires reading savings rows — pass as a prop from parent or use a hook

### TransactionForm.jsx + EditSingleTransactionModal.jsx

Same "Objetivo do planner" select field, same options, same `plannerGoalId` field.
- Show only for income-type or savings-type transactions (or show always — simpler)

---

## usePlannerState.js Changes

Add `goalTarget` and `manualBalance` defaults to `DEFAULT_STATE.savingsRows` entries.

Add to `migrateState()`:
```js
merged.savingsRows = merged.savingsRows.map(row => {
  const def = DEFAULT_STATE.savingsRows.find(d => d.id === row.id);
  return {
    goalTarget: def?.goalTarget ?? 0,
    manualBalance: def?.manualBalance ?? 0,
    ...row,
  };
});
```

`goalTarget` for `emergencia` is computed dynamically in `CarteiraTab` (not stored in state) using `liquidezFinal × 6` — the stored default `goalTarget` is 0, and the component overrides it with the computed value.

---

## File Map

| File | Action |
|------|--------|
| `src/pages/planner/CarteiraTab.jsx` | Full rewrite — goal-oriented cards |
| `src/pages/planner/usePlannerState.js` | Add `goalTarget` + `manualBalance` to savingsRows defaults + migrateState |
| `src/pages/InvestmentForm.jsx` | Add `plannerGoalId` field |
| `src/components/TransactionForm.jsx` | Add `plannerGoalId` field |
| `src/components/EditSingleTransactionModal.jsx` | Add `plannerGoalId` field |

---

## Out of Scope

- Month-specific parameter snapshots (separate feature)
- Editing savings row `phase1`/`phase2` amounts from CarteiraTab (stays in InvestmentTab)
- Reordering savings rows from CarteiraTab
- The Alocação Livre / investment class section (patrimônio is handled elsewhere)
