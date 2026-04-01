# Planner: Firestore Persistence + Default Values Update + Sistema Tab

**Date:** 2026-03-31
**Branch:** claude/finance-tracker-app-V1xPW
**Status:** Approved

---

## 1. Problem

- `usePlannerState.js` uses `localStorage` for persistence. UI changes are lost on reload (localStorage silently fails in some environments — PWA cache, private mode, storage quota).
- Default values in `DEFAULT_STATE` do not match the user's actual financial plan (wrong investment class percentages, missing Filhos savings row).
- No high-level financial system overview in the planner.

---

## 2. Solution Summary

1. **Persistence:** Replace `localStorage` with Firestore (`planner/{userId}` document). Optimistic writes via debounced `setDoc`. Show `DEFAULT_STATE` immediately on mount while Firestore loads, then hydrate.
2. **Default values:** Align `investmentClasses`, `savingsRows`, dízimo %, and allocation targets to the user's financial plan document.
3. **New tab:** Add a "Sistema Financeiro" tab as the first tab — read-only overview of the complete financial system with live cash flow data.

---

## 3. Persistence Design

### Firestore document
- Path: `planner/{userId}` — scoped by `ownerId` from `AccessContext` (same pattern as `settings/{userId}`)
- Shape: identical to current `DEFAULT_STATE` (flat object with nested arrays for `savingsRows`, `investmentClasses`, `allocationOverrides`)

### Data flow
1. Mount → `setState(DEFAULT_STATE)` immediately, set `isLoading = true`
2. Fire `getDoc('planner/{userId}')`
3. On response → `setState({ ...DEFAULT_STATE, ...firestoreData })` (migration: adds any missing keys from DEFAULT_STATE), set `isLoading = false`
4. On every state change → debounced `setDoc({ merge: true })` after 800ms

### Loading UX
- `isLoading` exported from `usePlannerState`
- `PlannerPage` shows a shimmer card (using existing `Shimmer` component from `src/components/ui/shimmer`) while `isLoading = true`
- After ~300–500ms, Firestore responds and real data replaces the shimmer — no flicker of wrong values

### Migration
```js
const merged = { ...DEFAULT_STATE, ...firestoreData };
// Re-apply savingsRows migration: ensure returnPct exists on all rows
merged.savingsRows = merged.savingsRows.map(row => {
  const def = DEFAULT_STATE.savingsRows.find(d => d.id === row.id);
  return { returnPct: def?.returnPct ?? 1.0, ...row };
});
```

### Firestore security rules (to be added)
```
match /planner/{userId} {
  allow read, write: if request.auth.uid == userId;
}
```

### Files changed
- `src/pages/planner/usePlannerState.js` — remove localStorage, add Firestore load + debounced write, export `isLoading`
- `src/pages/planner/PlannerPage.jsx` — consume `isLoading`, render shimmer when true
- `firestore.rules` — add planner rule

---

## 4. Default Values Update

### Investment classes
```js
investmentClasses: [
  { name: 'Renda Fixa (CDB/Tesouro)', pct: 35, returnPct: 1.0, vehicle: 'Tesouro Selic / CDB 115% CDI' },
  { name: 'Exterior ETFs',            pct: 30, returnPct: 1.0, vehicle: 'IVVB11 (S&P 500)' },
  { name: 'FIIs',                     pct: 15, returnPct: 0.8, vehicle: 'MXRF11, HGLG11' },
  { name: 'Ações Dividendos',         pct: 15, returnPct: 0.7, vehicle: 'ITUB4, BBAS3' },
  { name: 'Cripto',                   pct:  5, returnPct: 1.5, vehicle: 'BTC 70% + ETH' },
]
```

### Savings rows — add Filhos row, update existing amounts
```js
{ id: 'filhos', label: 'Filhos (Educação)', phase1: 1500, phase2: 2000, tipo: 'Meta R$ 600k–1.2M', onde: 'ETFs 70% / Renda Fixa 30%', returnPct: 0.9 }
```
All other rows keep their current values.

### Other defaults
- `dizimoPct`: 11 (was 10)
- `necessidades`: 64, `poupanca`: 28, `desejos`: 8 (unchanged — matches "Atual" in the doc)

---

## 5. Sistema Financeiro Tab

### Tab placement
New first tab. Final tab order: **Sistema | Dashboard | Alocação | Gastos | Investimentos | Simulações**

### New file
`src/pages/planner/SistemaTab.jsx`

### Props received from PlannerPage
```js
// All already computed in usePlannerState / PlannerPage:
{ state, computedRendaBruta, simplesValue, despesasPJ, dizimoValue,
  liquidezFinal, necessidadesValue, poupancaValue, desejosValue }
```

### Sections

#### ① Visão Geral
Card with:
- Objective: protect family, build wealth, achieve R$ 20k/mês independence
- Time horizons: 3 badges (Curto: 2–3a, Médio: 5–10a, Longo: 15–25a)

#### ② Arquitetura em Camadas
5 stacked color-coded cards (no inputs):

| Layer | Color | Key info |
|-------|-------|----------|
| 🛡️ Proteção | red | Seguro vida R$ 6M — morte / invalidez / doenças graves |
| 💧 Liquidez | blue | Reserva emergência — meta R$ 120k — Tesouro Selic / CDB liq. diária |
| 📈 Crescimento | green | Investimentos — aporte base R$ 4k–6k+/mês |
| 🏠 Patrimônio | purple | Casa (meta entrada) + carro |
| 👨‍👩‍👧‍👦 Legado | orange | Filhos R$ 600k–1.2M + holding futuro (trigger R$ 300–500k patrimônio) |

#### ③ Fluxo de Caixa (live, selected month)
Vertical waterfall card using live computed values:

```
Renda Bruta         [computedRendaBruta]
− Simples (%)       [simplesValue]
− Despesas PJ       [despesasPJ]
− Dízimo (%)        [dizimoValue]
═ Liquidez Final    [liquidezFinal]  ← highlighted
  → Necessidades    [necessidadesValue]
  → Poupança        [poupancaValue]
  → Desejos         [desejosValue]
```

Each deduction row has a red minus badge; the total row has a violet highlight. The allocation split shows as 3 small pills below.

#### ④ Distribuição Atual vs Meta
Two side-by-side mini progress bars:
- **Atual:** 64% needs / 28% invest / 8% leisure (from `state.necessidades/poupanca/desejos`)
- **Meta:** 56% / 32% / 8% (hardcoded reference from the plan)

#### ⑤ Regras de Ouro
Numbered list:
1. Investir antes de gastar
2. Não subir custo fixo
3. Revisar anualmente
4. Manter consistência
5. Diversificação global

#### ⑥ Próximos Passos
4 read-only cards with status badges:
- Aumentar aporte → Em progresso
- Reduzir custo → Em progresso
- Criar holding → Pendente (trigger: R$ 300–500k)
- Expandir renda → Em progresso

### Mobile layout
All sections stack full-width. No horizontal scroll except the existing tab bar (`overflow-x-auto` already in place).

---

## 6. Out of Scope

- Firestore real-time listener (`onSnapshot`) for planner — `getDoc` once on mount is sufficient (planner is single-user, single-device use)
- Editing Próximos Passos status — read-only in this iteration
- Holding tracker — read-only reference card only
- Life insurance premium tracking — reference card only

---

## 7. Files Affected

| File | Change |
|------|--------|
| `src/pages/planner/usePlannerState.js` | Replace localStorage with Firestore persistence, export `isLoading` |
| `src/pages/planner/PlannerPage.jsx` | Add shimmer loading state, add Sistema tab, reorder tabs |
| `src/pages/planner/SistemaTab.jsx` | New file — Sistema Financeiro overview |
| `firestore.rules` | Add `planner/{userId}` read/write rule |
