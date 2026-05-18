# Import Swipe Review — Design Spec

**Date:** 2026-05-18  
**Status:** Approved

---

## Overview

Overhaul the import preview step (`ImportModal.jsx`) with three improvements:

1. **Rich card list** — transactions grouped by date, better information hierarchy, checkbox outside the card.
2. **Bottom sheet editor** — tap a card to open a full edit form in a sheet; navigate between all transactions without closing; changes held in local state the whole time.
3. **First-time onboarding overlay** — teaches navigation gestures once, never again.

---

## 1. Import List (preview step)

### Grouping

Transactions are grouped by date. The date renders as a section header (`12 mai 2025`) above each group — it is removed from the individual cards.

### Card layout

Each row is: `[checkbox] [card]` — the checkbox floats **outside** the card to the left.

Inside the card, two rows:

```
[type dot]  [title — max 2 lines]        [value]
            [category badge ▾]
```

- **Type dot** (↑ income / ↓ expense): display-only, not tappable. Color-coded circle (green/red).
- **Title**: max 2 lines (`-webkit-line-clamp: 2`), full remaining width, no truncation mid-word.
- **Value**: fixed `min-width` column on the right, always has breathing room, never wraps.
- **Category badge**: below the title, full width available, with a `▾` chevron indicating it is tappable. Never truncated. Amber style for "Sem categoria".
- **No right-arrow chevron** on mobile.

### Selection

- Tapping the **checkbox** toggles selection (include/exclude from import).
- Tapping the **card body** opens the bottom sheet editor.
- **Select all / Clear bar** pinned at the top of the list showing transaction count and two buttons.

### Credit card import

When `importPaymentMethod === 'credit'`, the type dot and any type-switching UI are hidden entirely — all transactions are treated as expenses.

---

## 2. Bottom Sheet Editor

### Opening

Tapping any card opens the sheet over the dimmed list. The list remains visible behind the sheet at ~25% opacity for context.

### Sheet contents

```
[drag handle]
[‹]  [progress bar — X de Y]  [›]
[type dot]  [title 2-line]  [value]
──────────────────────────────────
Descrição     [field]
Valor / Tipo  [amount field] [entrada|saída toggle]
Categoria     [picker ▾]
Data          [date field]
Incluir       [toggle]
```

### Navigation

- **‹ ›** buttons navigate to previous/next transaction.
- Swiping the sheet left/right also navigates.
- Moving between transactions does **not** trigger a save — changes are written to the `transactions` local state array immediately on field change, exactly as `saveDraftTransaction` already does.

### State persistence

Changes are always held in local state (`transactions` state in `ImportModal`). Closing the sheet at any point returns the user to the list with all edits intact. There is no discard/confirm dialog.

### Last card

When the user reaches the last transaction:

- Progress bar turns green.
- `›` button is disabled (opacity 30%).
- A **"Fechar"** button appears at the bottom of the sheet.
- Tapping "Fechar" closes the sheet and returns to the list.

The actual commit to Firestore still happens via the existing **"Importar X transações"** footer button on the list — unchanged.

---

## 3. First-time Onboarding Overlay

Shown **once**, the first time the bottom sheet opens in any session. Persisted via `localStorage` key `import_swipe_onboarding_seen`.

### Layout

- Dark semi-transparent overlay covers everything behind the sheet.
- Purple spotlight ring (`box-shadow` glow) highlights both ‹ and › buttons.
- Tooltip above the nav bar: `‹ › ou arraste para navegar`
- Green callout card below: `Navegue à vontade — suas edições ficam guardadas até o final`
- Single dismiss button: **"Entendi, vamos lá"** — removes overlay, sets localStorage flag.

---

## 4. Component Architecture

### New component: `ImportSwipeSheet`

`src/components/ImportSwipeSheet.jsx`

Props:
```js
{
  transactions: Transaction[],        // full draft list from ImportModal state
  initialIndex: number,               // which card was tapped
  isCreditCard: boolean,              // hides type toggle when true
  onUpdate: (localId, patch) => void, // writes patch to ImportModal state
  onClose: () => void,
}
```

Owns: sheet open/close animation, navigation state (current index), onboarding overlay visibility.
Does **not** own transaction state — reads from props, writes via `onUpdate`.

### Modified: `ImportModal`

- `step === 'preview'`: renders grouped-by-date card list instead of flat list.
- Replaces `EditSingleTransactionModal` call with `ImportSwipeSheet`.
- `openEditTransaction(localId)` resolves the index and passes it to `ImportSwipeSheet` as `initialIndex`.
- `saveDraftTransaction` renamed/refactored into `patchDraftTransaction(localId, patch)` — same logic, smaller surface.

### New component: `ImportOnboardingOverlay`

`src/components/ImportOnboardingOverlay.jsx`

Props: `{ onDismiss: () => void }`  
Self-contained: reads/writes `localStorage` flag, renders overlay markup.

---

## 5. Data Flow

```
ImportModal (transactions state)
  │
  ├─ ImportList (read-only display + checkbox toggle)
  │    └─ tap card → openEditTransaction(localId)
  │
  └─ ImportSwipeSheet
       ├─ reads transactions[initialIndex..] for display
       └─ onUpdate(localId, patch) → ImportModal.patchDraftTransaction
            └─ setTransactions(prev => prev.map(...patch))
```

Firestore write only happens when user taps "Importar X transações" in the footer.

---

## 6. Out of Scope

- Swipe-to-delete or swipe-to-skip gestures on the list itself (could be a future enhancement).
- Keyboard navigation on desktop.
- Batch category assignment from the sheet.
