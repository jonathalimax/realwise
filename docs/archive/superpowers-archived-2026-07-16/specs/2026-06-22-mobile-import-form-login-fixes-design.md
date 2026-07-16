# Mobile Import, Transaction-Form Parity & Login Reliability — Design

Date: 2026-06-22
Status: Approved (pending spec review)

## Context

Mobile users hit several issues across the CSV/PDF import flow, the transaction
edit experience, investment data persistence, and the post-login pipeline. This
spec groups the fixes into three independent areas. All new/changed user-facing
copy is **pt-BR** (primary), following the existing `language === 'pt'` /
`label('pt','en')` patterns and `src/locales/pt.js`.

## Root causes (confirmed by code reading)

- **Date overflow:** `<input type="date">` on iOS Safari has an intrinsic
  min-width that ignores `width:100%` inside flex rows, forcing horizontal
  scroll. Present in nearly every form (`ImportSwipeSheet`, `BillModal`,
  `TransactionModal`, `EditSingleTransactionModal`, `InvestmentModal`, `Goals`…).
- **Scroll jumps to next item:** `ImportSwipeSheet.jsx:93-94` attaches
  `onTouchStart/End` swipe handlers to the whole sheet; vertical scroll with
  slight horizontal drift triggers `goTo(next)`.
- **Arrows at top:** navigation lives in the header (`:105-154`); the footer
  action only renders on the last card (`:533`).
- **Edit ≠ import form:** `ImportSwipeSheet` (lean card) and
  `EditSingleTransactionModal` (1104-line modal) were built independently.
- **Ticker disappears on edit:** import (`ImportModal.jsx:351-374`) writes
  `ticker`/`platform` onto the **transaction**, but the edit modal
  (`EditSingleTransactionModal.jsx:95-98`) reads them from a **linked
  `investments` doc** that the import never creates. Worse,
  `InvestmentContext.addInvestment` (`:360-375`) omits `ticker/platform/
  coinName/fundName` from the investment doc entirely — so even the manual flow
  can lose ticker on round-trip, and the portfolio never shows it.
- **Planner plans missing in import (intermittent):** `usePlannerGoals` returns
  `[]` when `getActiveVersion(walletVersions, currentMonth)` finds no version
  for the current month — a data/timing race.
- **Slow/erratic post-login:** `LoadingPage` → `getCustomToken` callable
  (cold-start latency) → `LoginLoader` caps at 8s, then shows "Demorando mais
  que o normal… / Tentar novamente". Dashboard shimmer/zeros = contexts still
  hydrating after navigation; errors sometimes route home silently.
- **PWA skips account picker:** `SharedLogin.handleGoogleSignIn` (`:137-178`)
  builds a raw `/__/auth/handler` popup URL with **no `prompt` param**, so
  Google silently reuses the last session after logout. (`Auth.jsx:61` sets
  `prompt:'select_account'` but is not the active login path.)

## Area A — Mobile import UX

Files: `ImportSwipeSheet.jsx`, `src/index.css`, `ImportOnboardingOverlay.jsx`

1. **Date overflow (global, one fix):** add a CSS rule for
   `input[type="date"|"time"|"datetime-local"]` →
   `min-width:0; max-width:100%; -webkit-appearance:none; box-sizing:border-box`.
   Fixes overflow in every form at once.
2. **Stop scroll-to-navigate:** remove the horizontal swipe handlers
   (`onTouchStart/End` at `:93-94` and `handleTouchStart/handleTouchEnd`).
   Navigation becomes button-only. Keep drag-handle pull-down-to-dismiss.
3. **Move nav to bottom, bigger:** remove the top arrow row; add a fixed footer
   that always shows large `‹ Voltar` / `Próximo ›` buttons. On the **last**
   card the footer shows `‹ Voltar` + the green **Concluir** button (current
   "Fechar"). The progress bar/counter stays at top (non-interactive).
4. **Single status control (replaces two confusing toggles):** replace
   `selected` + `ignored` toggles (`:486-527`) with one segmented control,
   pt-BR labels:
   - **Importar** → `selected:true, ignored:false`
   - **Importar e ignorar** → `selected:true, ignored:true`
   - **Não importar** → `selected:false`
   The clarifier *"Não aparece nos totais"* for the middle option must be shown
   **without taking much space and without changing the layout height**. The
   control reserves a **fixed-height helper row** below it (always present, even
   when empty) that displays *"Não aparece nos totais"* only while **Importar e
   ignorar** is selected — so selecting it never shifts the surrounding layout.
   Underlying `selected`/`ignored` fields unchanged → `ImportModal` commit logic
   untouched.
5. **Tutorial:** update `ImportOnboardingOverlay` copy/pointers (pt-BR) to
   describe bottom buttons and the new status control instead of swipe/top-arrows.

## Area B — Form parity + investment data (issues 4, 5, 6)

1. **Shared form component:** extract `ImportSwipeSheet`'s field body into a
   reusable `TransactionFields` component (description, amount, type, payment
   method, date, category, investment fields, goals, status control). Both
   `ImportSwipeSheet` and `EditSingleTransactionModal` render it — one source of
   truth, identical UX. The edit modal keeps its own save/delete/installment
   logic around the shared fields.
2. **Investment persistence (root fix):**
   - Extend `addInvestment`'s `newInvestment` to persist `ticker, platform,
     coinName, fundName` (and any typed field the edit modal reads).
   - On import commit (`ImportModal.jsx:351`), when a transaction is in an
     investment category, call `addInvestment(..., createTransaction:false)` and
     link the IDs (`transaction.investmentId` ↔ `investments.transactionId`) so a
     linked investments doc is created — appears in portfolio AND edits
     correctly.
   - Verify every typed field the edit modal reads is written by the shared path.
3. **Issue 6 (planner goals race):** apply systematic-debugging. Likely fix:
   `usePlannerGoals` falls back to the latest wallet version when none matches
   the current month, so plans always populate in the import card.

## Area C — Login reliability (issues 7, 8)

1. **Issue 8 (PWA account picker):** add `&prompt=select_account` (and scopes)
   to the `/__/auth/handler` popup URL in `SharedLogin.handleGoogleSignIn` so
   Google always shows the chooser after logout. Confirm the handler honors it.
2. **Issue 7 (slow/erratic post-login):** investigate-first via
   systematic-debugging. Hypotheses: `getCustomToken` cold-start dominates
   latency; navigation races context hydration (dashboard shows zeros).
   Candidate fixes: hold the loader until first dashboard data resolves (not just
   `isReady`); surface real errors instead of silently routing home. Concrete
   fixes finalized in the plan after root-causing.

## Out of scope

- Desktop-only redesigns of the edit modal beyond adopting `TransactionFields`.
- Reworking the import parsing/bank-detection pipeline.
- Changing the `selected`/`ignored` data model (only the UI control changes).

## Testing

- Unit (Vitest, pure functions): `getActiveVersion` fallback logic for issue 6.
- Manual mobile verification: date fields no longer overflow; scroll does not
  navigate; bottom buttons navigate; last card shows Voltar+Concluir; status
  control maps to correct `selected`/`ignored`; imported investment shows ticker
  on edit and in portfolio; PWA logout → login shows account picker.
