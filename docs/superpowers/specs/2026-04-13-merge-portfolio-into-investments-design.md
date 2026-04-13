# Merge Portfolio into Investments — Design Spec

**Date:** 2026-04-13  
**Status:** Approved

## Overview

Merge the standalone Portfolio page into the Investments page as a tab. This removes the duplicate navigation entry and gives users a single place for everything investment-related.

## Tab Structure

The `/investments` route gains two tabs rendered directly below the sticky page header (underline style):

| Order | Label | Content |
|-------|-------|---------|
| 1 | Portfólio | Current Portfolio page (donut chart + layer groups) |
| 2 | Investimentos | Current Investments list (summary, search, filters, sort) |

**Default tab:** Portfólio (tab 1) loads when navigating to `/investments`.

## Layout

```
┌─────────────────────────────────────────┐
│  Investimentos               [+ Adicionar] ← only on tab 2
├─────────────────────────────────────────┤
│  [Portfólio]  Investimentos              ← tabs (underline style)
├─────────────────────────────────────────┤
│                                         │
│  (tab content)                          │
│                                         │
└─────────────────────────────────────────┘
```

- The `+ Adicionar` button in the sticky header is **only visible when the Investimentos tab is active**
- Tab state is managed with local React `useState` (no URL param needed — the tabs are a UI detail, not a bookmarkable state)

## Tab 1 — Portfólio

Renders the full content of the current `Portfolio.jsx`:
- Dark header card showing total invested + asset/transaction counts
- Donut chart: allocation % by wallet layer
- Layer groups (liquidez, crescimento, patrimônio, legado) with investment items
- "Sem vínculo" section for unlinked items
- Empty state when no investments exist

No changes to the Portfolio's internal logic or data fetching.

## Tab 2 — Investimentos

Renders the full content of the current `Investments.jsx`:
- Gradient summary banner (invested, current value, rendimento, rentabilidade %)
- Search input + Filters toggle
- Sort controls
- Investment list with edit/withdraw actions

No changes to the Investments list logic.

## Routing Changes

| Route | Before | After |
|-------|--------|-------|
| `/investments` | Investments list | Investments page with tabs (Portfólio default) |
| `/portfolio` | Portfolio page | Redirect to `/investments` |
| `/investments/new` | InvestmentForm | Unchanged |
| `/investments/:id/edit` | InvestmentForm | Unchanged |
| `/investments/:id/withdraw` | InvestmentForm | Unchanged |

## Sidebar Changes

- **Remove** the "Portfólio" nav item (path `/portfolio`, `BriefcaseIcon`)
- The "Investimentos" nav item remains and now covers both views
- The active-state highlight logic in the sidebar already handles `/investments` as a parent route — no change needed there

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Investments.jsx` | Add tab state, render tabs UI, conditionally show `+ Adicionar`, embed Portfolio content in tab 1 |
| `src/components/Sidebar.jsx` | Remove the `/portfolio` nav entry |
| `src/App.jsx` | Replace `<Route path="portfolio" …>` with a `<Navigate to="/investments" />` redirect; remove `PortfolioPage` import |

`src/pages/Portfolio.jsx` is **not deleted** — its JSX is extracted and rendered inline inside the Portfólio tab within `Investments.jsx`. The file itself can be left as a dead module or deleted; deleting is cleaner.
