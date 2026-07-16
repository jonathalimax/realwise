# Planner — Orçamento Tab Redesign

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

Two focused changes to the Planner's allocation section:

1. **Rename "Alocação" → "Orçamento"** — clearer, everyday word that immediately communicates what the tab does.
2. **Replace the two stacked vertical sections with inner tabs** — "Regra" (the 70/20/10 master rule) and "Categorias" (category budget limits) so each section gets full focus without requiring the user to scroll past one to reach the other.

---

## 1. Rename

| Before | After |
|---|---|
| Tab label: `Alocação` | `Orçamento` |
| URL param: `?tab=alocacao` | `?tab=orcamento` |
| Page title (PLANNER_TITLES): `Alocação` | `Orçamento` |
| Help text | Update to describe budget planning |

All internal variable names (`activeTab === 'allocation'`) can stay unchanged — this is a display-only rename.

The old `?tab=alocacao` URL param must continue to work for any existing bookmarks. In `PlannerPage.jsx`, add a backward-compat alias: if `tab === 'alocacao'`, treat it as `'allocation'` (already the case — just keep it).

---

## 2. Inner Tabs: Regra + Categorias

### Current layout

```
AllocationTab
├── [section] Plano Mestre  (3 slider cards: Necessidades / Poupança / Desejos)
└── [section] Limites por Categoria  (grid of category cards)
```

Both sections are always visible, stacked vertically. To see categories the user must scroll past the master rule section.

### New layout

```
AllocationTab
├── [inner tab bar]  Regra  |  Categorias
│
├── [Regra tab]
│     Plano Mestre — 3 slider cards (unchanged)
│
└── [Categorias tab]
      Limites por Categoria — category grid (unchanged)
```

### Inner tab component

`AllocationTab.jsx` already has an `InnerTabs` component defined locally. Reuse it:

```jsx
const INNER_TABS = [
  { value: 'regra',       label: '⚖️ Regra' },
  { value: 'categorias',  label: '📂 Categorias' },
];
```

Add state: `const [innerTab, setInnerTab] = useState('regra');`

Default tab is `'regra'` so the 70/20/10 sliders are the first thing a user sees.

### Persistence

The inner tab selection is **not** persisted to the URL or Firestore — it's session-local state. Navigating away and back resets to `'regra'`.

### "Regra" tab

Unchanged content from the current "Plano Mestre" section. Remove the `<h2>Plano Mestre</h2>` heading since the tab label already contextualizes it. Keep the "Copiar do mês anterior" and "Resetar" buttons.

### "Categorias" tab

Unchanged content from the current "Limites por Categoria" section. Remove the `<h2>` heading for the same reason. Keep the "Livre / Excedido" summary badge.

### Zero-state guard

The existing guard (when `liquidezFinal <= 0`, show "Definir Renda" prompt) stays at the top level — it appears before the inner tabs, same as today.

---

## Out of Scope

- Changing the content of either section (only the container layout changes).
- Persisting inner tab choice to URL params.
- Renaming other Planner tabs (Renda, Carteira, etc.).
