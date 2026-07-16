# Input UX Refactor — Design Spec

**Date:** 2026-04-20  
**Branch:** feat/productization (PR #1)  
**Status:** Approved

---

## Overview

A focused UX polish pass across three areas: input field consistency, allocation slider usability, and a new help system. No business logic changes.

---

## Area 1 — Input Field Standards

### Money inputs
- All currency inputs use `CurrencyInput` (already wraps `react-number-format` with BRL formatting)
- Never start with `0` — show empty field with descriptive placeholder (e.g. `R$ 1.000,00`)
- Any bare `<input type="number">` or inconsistent `NumericFormat` for currency values is replaced with `CurrencyInput`
- Introduce a shared `PercentInput` component for all `% suffix` fields (currently duplicated inline across AllocationTab, InvestmentTab, etc.)

### Text / semantic inputs
- `type="email"` on all email fields
- `inputMode="numeric"` + `type="tel"` on CEP / phone / numeric-only fields (shows numeric keyboard on mobile without spinner arrows)
- `autoComplete` attributes on all form fields (name, email, new-password, etc.)
- `type="text"` + `inputMode="decimal"` for any remaining numeric fields that shouldn't be currency

### Mobile overflow fix
- All inputs inside flex rows must have `min-w-0` to prevent overflow
- Forms inside modals/panels use `w-full` + constrained parent — no fixed widths that escape the viewport
- Audit: BillModal, TransactionForm, EditSingleTransactionModal, GoalsModal, CardsModal, InvestmentModal, RendaTab, InvestmentTab, CarSimulatorTab, HouseSimulatorTab

### Shared components
- `CurrencyInput` — already exists, minor cleanup (ensure no `value=0` passes through)
- `PercentInput` — new, wraps NumericFormat with `suffix=" %"`, `decimalScale={1}`, `placeholder="0 %"`, consistent styling matching CurrencyInput

---

## Area 2 — Allocation Slider (AllocationTab.jsx)

**Decision:** Option B — improved slider, same interaction but much clearer affordance.

### Changes
- Replace native `<input type="range">` with a styled wrapper that provides:
  - Thumb: 32px circle, white background, drop shadow, `⟺` icon inside
  - Track: gradient fill from left to thumb position
  - Labels: `0%` on left, `arraste →` in center (fades after first interaction), `100%` on right
  - Touch target: minimum 44px hit area (CSS padding trick)
- Implemented via CSS custom properties + Tailwind — no new JS dependency
- The three bucket cards (Necessidades, Poupança, Desejos) remain, slider sits inside each card

---

## Area 3 — Investment Plan Layer Cards (Carteira tab)

**Decision:** Option A — full-width stacked rows.

### Changes to `carteira/` components
- Layer allocation cards: switch from `grid-cols-2` cramped layout to `flex-col` stack
- Each layer row: icon + name + amount (left), editable % input (right)
- Amount shows as `R$ 390,00/mês` on its own line — no overflow possible
- "Adicionar camada" stays as a dashed full-width button at the bottom

---

## Area 4 — Page Help System

### `PageHelp` component (`src/components/ui/PageHelp.jsx`)
- Floating "?" FAB, 40px circle, secondary styling (gray, not purple)
- Position: `fixed bottom-6 right-6` normally; when a "+" FAB exists on the page, `PageHelp` renders at `bottom-20 right-6` (stacked above it)
- Tap → opens a bottom sheet modal with:
  - Drag handle at top
  - Page title + `📖 Como funciona` header
  - 2–4 sentence plain-language explanation
  - Tap outside or handle → dismisses
- After first view, the FAB gets a subtle pulse animation that stops after 3 seconds (one-time, no persistence needed)

### Help text per page (brief, plain language)
| Page | Text |
|------|------|
| Dashboard | Visão geral das suas finanças. Acompanhe saldo, receitas e despesas do mês selecionado. |
| Transactions | Registre e filtre suas movimentações. Categorize cada transação para acompanhar onde seu dinheiro vai. |
| Bills | Controle suas contas a pagar. Marque como paga quando quitar e receba lembretes por e-mail. |
| Budget | Defina limites de gasto por categoria. A barra mostra quanto você já usou do orçamento do mês. |
| Planner → Renda | Informe seu salário líquido. Ele é a base de todos os cálculos do planejador. |
| Planner → Alocação | Defina a divisão ideal entre Necessidades, Poupança e Desejos. Arraste o controle ou ajuste manualmente. |
| Planner → Carteira | Configure suas camadas de investimento e veja projeções de patrimônio ao longo do tempo. |
| Investments | Acompanhe seus ativos reais. Registre o valor atual e o retorno de cada investimento. |
| Goals | Defina objetivos financeiros e veja o progresso. Contribuições são descontadas automaticamente do saldo. |

---

## Files to touch

| File | Change |
|------|--------|
| `src/components/ui/CurrencyInput.jsx` | Minor cleanup |
| `src/components/ui/PercentInput.jsx` | New component |
| `src/components/ui/PageHelp.jsx` | New component |
| `src/pages/planner/AllocationTab.jsx` | Improved slider |
| `src/pages/planner/carteira/LayerModal.jsx` | Stacked layout |
| `src/pages/planner/carteira/SublayerModal.jsx` | Stacked layout |
| `src/pages/planner/InvestmentTab.jsx` | PercentInput, mobile fix |
| `src/pages/planner/RendaTab.jsx` | Mobile fix |
| `src/pages/planner/CarSimulatorTab.jsx` | Input audit |
| `src/pages/planner/HouseSimulatorTab.jsx` | Input audit |
| `src/components/BillModal.jsx` | Input audit, mobile fix |
| `src/components/TransactionForm.jsx` | Input audit, semantic types |
| `src/components/EditSingleTransactionModal.jsx` | Input audit |
| `src/components/GoalsModal.jsx` | Input audit |
| `src/components/CardsModal.jsx` | Input audit |
| `src/components/InvestmentModal.jsx` | Input audit |
| `src/components/SettingsModal.jsx` | email type, input audit |
| `src/pages/Dashboard.jsx` | Add PageHelp |
| `src/pages/Transactions.jsx` | Add PageHelp |
| `src/pages/Bills.jsx` | Add PageHelp |
| `src/pages/Budget.jsx` | Add PageHelp |
| `src/pages/Investments.jsx` | Add PageHelp |
| `src/pages/Goals.jsx` | Add PageHelp |
| `src/pages/planner/PlannerPage.jsx` | Add PageHelp per tab |

---

## Out of scope
- Business logic changes
- New features beyond help text
- Admin pages
- Landing page
