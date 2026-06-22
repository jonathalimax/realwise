# Mobile Import, Form Parity & Login Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mobile CSV/PDF import UX, unify the edit/import transaction form, make investment data persist to both edit and portfolio, and stabilize the post-login pipeline.

**Architecture:** Three independent areas. Area A is UI-only changes to `ImportSwipeSheet.jsx` + a global CSS rule + the tutorial overlay. Area B extracts a shared `TransactionFields` component, fixes the investment-doc schema/link, and fixes a planner-version race. Area C fixes the Google account-picker prompt and the login loader/error flow.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Firebase (Auth/Firestore), Vitest (node env, pure functions only).

## Global Constraints

- All new/changed user-facing copy is **pt-BR** (primary). Where a component uses the `label('pt','en')` helper, supply both with pt-BR as primary; otherwise pt-BR string literals.
- Tests: Vitest in **node** env, **pure functions only** — no Firebase, no React rendering. UI changes are verified manually.
- Test command: `npx vitest run <path>`.
- Do not change the `selected`/`ignored` Firestore data model — only the UI control changes.
- Import status control labels (exact): **Importar** / **Importar e ignorar** / **Não importar**. Clarifier for the middle option (exact): **Não aparece nos totais**, shown in a fixed-height row that never shifts layout.
- Follow existing file patterns; keep dark-mode `dark:` classes on every new element.

---

## Area A — Mobile import UX

### Task 1: Global date-input overflow fix

**Files:**
- Modify: `src/index.css` (append after the existing `input[type="date"]` dark-mode block, ~`:78-83`)

**Interfaces:**
- Produces: a global CSS rule constraining date/time inputs so they never exceed their container width.

- [ ] **Step 1: Add the CSS rule**

Append to `src/index.css`:

```css
/* Prevent iOS Safari date/time inputs from overflowing their flex container.
   These inputs have an intrinsic min-width that ignores width:100%, which makes
   forms scroll horizontally on mobile. */
input[type="date"],
input[type="datetime-local"],
input[type="time"] {
  min-width: 0;
  max-width: 100%;
  -webkit-appearance: none;
  appearance: none;
  box-sizing: border-box;
}
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, open `http://localhost:5173/<clientId>/dashboard` in mobile viewport (DevTools device toolbar, iPhone). Open the import flow and any form with a date (BillModal, TransactionModal, InvestmentModal, Goals). Confirm: no horizontal scroll; date field fits container width.
Expected: forms do not scroll sideways.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: prevent date inputs from overflowing on mobile"
```

---

### Task 2: Move import navigation to a bottom footer

**Files:**
- Modify: `src/components/ImportSwipeSheet.jsx`

**Interfaces:**
- Consumes: existing `goTo`, `currentIndex`, `isLast`, `transactions`, `onClose`, `label`.
- Produces: button-only navigation; swipe handlers removed; a persistent bottom footer with `‹ Voltar` / `Próximo ›`, and on the last card `‹ Voltar` + green **Concluir**.

- [ ] **Step 1: Remove horizontal swipe handlers**

In `ImportSwipeSheet.jsx`, delete `handleTouchStart` (`:35-37`) and `handleTouchEnd` (`:39-46`), and remove the `onTouchStart={handleTouchStart}` / `onTouchEnd={handleTouchEnd}` props from the sheet `<div>` (`:93-94`). Remove the now-unused `touchStartX` ref (`:18`). Keep `handleDragStart`/`handleDragEnd` and the drag handle (pull-down-to-dismiss).

- [ ] **Step 2: Remove the top arrow buttons**

In the navigation header (`:106-154`), delete the two `<button>` arrows (`‹` at `:107-113` and `›` at `:137-143`). Keep the progress bar + counter (`:115-135`) and the close `×` button (`:146-153`). The header now centers the progress bar with the close button on the right.

- [ ] **Step 3: Replace the footer with persistent bottom navigation**

Replace the entire footer block (`:532-542`, the `{isLast && (...)}`) with:

```jsx
{/* Bottom navigation — always visible, large tap targets */}
<div className="flex-shrink-0 flex items-center gap-3 px-4 py-4 border-t border-gray-100 dark:border-gray-700">
  <button
    onClick={() => goTo(currentIndex - 1)}
    disabled={currentIndex === 0}
    className="flex-shrink-0 w-14 h-14 rounded-2xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-3xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
    aria-label={label('Voltar', 'Back')}
  >
    ‹
  </button>
  {isLast ? (
    <button
      onClick={onClose}
      className="flex-1 h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
    >
      {label('Concluir', 'Finish')}
    </button>
  ) : (
    <button
      onClick={() => goTo(currentIndex + 1)}
      className="flex-1 h-14 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
    >
      {label('Próximo', 'Next')} ›
    </button>
  )}
</div>
```

- [ ] **Step 4: Manual verification**

`npm run dev`, mobile viewport, open import preview → swipe sheet. Confirm: vertical scrolling never changes the item; swiping left/right does nothing; bottom `‹` + `Próximo ›` navigate; on the last card the footer shows `‹` + green **Concluir**; `Concluir` closes the sheet.
Expected: navigation only via bottom buttons.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportSwipeSheet.jsx
git commit -m "feat: move import nav to bottom buttons, remove swipe navigation"
```

---

### Task 3: Replace the two toggles with a single status control

**Files:**
- Create: `src/components/import/importStatus.js`
- Create: `src/components/import/importStatus.test.js`
- Modify: `src/components/ImportSwipeSheet.jsx`

**Interfaces:**
- Produces:
  - `statusFromFlags({ selected, ignored }) => 'import' | 'importIgnore' | 'skip'`
  - `flagsForStatus(status) => { selected: boolean, ignored: boolean }`
  - `IMPORT_STATUSES: ['import', 'importIgnore', 'skip']`

- [ ] **Step 1: Write the failing test**

Create `src/components/import/importStatus.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { statusFromFlags, flagsForStatus } from './importStatus';

describe('importStatus', () => {
  it('maps selected+not ignored to import', () => {
    expect(statusFromFlags({ selected: true, ignored: false })).toBe('import');
  });
  it('maps selected+ignored to importIgnore', () => {
    expect(statusFromFlags({ selected: true, ignored: true })).toBe('importIgnore');
  });
  it('maps not selected to skip regardless of ignored', () => {
    expect(statusFromFlags({ selected: false, ignored: false })).toBe('skip');
    expect(statusFromFlags({ selected: false, ignored: true })).toBe('skip');
  });
  it('flagsForStatus round-trips each status', () => {
    expect(flagsForStatus('import')).toEqual({ selected: true, ignored: false });
    expect(flagsForStatus('importIgnore')).toEqual({ selected: true, ignored: true });
    expect(flagsForStatus('skip')).toEqual({ selected: false, ignored: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/import/importStatus.test.js`
Expected: FAIL — cannot resolve `./importStatus`.

- [ ] **Step 3: Write the implementation**

Create `src/components/import/importStatus.js`:

```js
export const IMPORT_STATUSES = ['import', 'importIgnore', 'skip'];

export function statusFromFlags({ selected, ignored }) {
  if (!selected) return 'skip';
  return ignored ? 'importIgnore' : 'import';
}

export function flagsForStatus(status) {
  switch (status) {
    case 'importIgnore':
      return { selected: true, ignored: true };
    case 'skip':
      return { selected: false, ignored: false };
    case 'import':
    default:
      return { selected: true, ignored: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/import/importStatus.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Replace the two toggles in ImportSwipeSheet**

In `ImportSwipeSheet.jsx`, add the import near the top:

```jsx
import { statusFromFlags, flagsForStatus } from './import/importStatus';
```

Replace both toggle blocks — "Include toggle" (`:486-503`) and "Ignored toggle" (`:505-527`) — with this single control:

```jsx
{/* Import status — single control replacing the include/ignore toggles */}
<div>
  {(() => {
    const status = statusFromFlags({ selected: trans.selected, ignored: trans.ignored });
    const setStatus = (next) => {
      const flags = flagsForStatus(next);
      patch('selected', flags.selected);
      patch('ignored', flags.ignored);
    };
    const options = [
      { value: 'import', label: label('Importar', 'Import') },
      { value: 'importIgnore', label: label('Importar e ignorar', 'Import & ignore') },
      { value: 'skip', label: label('Não importar', "Don't import") },
    ];
    return (
      <>
        <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-xl gap-0.5 overflow-hidden">
          {options.map(({ value, label: lbl }) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`flex-1 px-1 py-2.5 text-[11px] font-black rounded-[10px] transition-all leading-tight ${
                status === value
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-400'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        {/* Fixed-height clarifier row — reserved always so layout never shifts */}
        <div className="h-4 mt-1">
          {status === 'importIgnore' && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center">
              {label('Não aparece nos totais', 'Not counted in totals')}
            </p>
          )}
        </div>
      </>
    );
  })()}
</div>
```

- [ ] **Step 6: Manual verification**

`npm run dev`, mobile viewport, open import swipe sheet. Confirm: three options **Importar / Importar e ignorar / Não importar**; selecting **Importar e ignorar** shows **Não aparece nos totais** beneath without moving anything; switching options does not change the card height. Import a transaction with each status and confirm it is saved/excluded as expected.
Expected: single clear control, no layout shift.

- [ ] **Step 7: Commit**

```bash
git add src/components/import/importStatus.js src/components/import/importStatus.test.js src/components/ImportSwipeSheet.jsx
git commit -m "feat: replace import include/ignore toggles with single status control"
```

---

### Task 4: Update the import tutorial overlay

**Files:**
- Modify: `src/components/ImportOnboardingOverlay.jsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: tutorial copy/pointers that describe the bottom buttons + status control instead of swipe/top-arrows.

- [ ] **Step 1: Rewrite the overlay to point at the bottom nav**

Replace the spotlight nav row (`:9-26`) and tooltip (`:30-35`) so the highlighted controls sit at the **bottom** of the sheet and the copy no longer mentions swipe. Replace the body of `ImportOnboardingOverlay` return with:

```jsx
<div className="fixed inset-0 z-[60] flex flex-col px-4">
  {/* Dark backdrop */}
  <div className="absolute inset-0 bg-black/80" />

  {/* Content pinned near the bottom, where the new nav buttons live */}
  <div className="relative mt-auto mb-4 w-full max-w-sm self-center flex flex-col gap-3">
    {/* Spotlighted bottom nav buttons */}
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-2xl border-2 border-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.25)] bg-gray-800 flex items-center justify-center text-white text-3xl font-black">
        ‹
      </div>
      <div className="flex-1 h-14 rounded-2xl border-2 border-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.25)] bg-gray-800 flex items-center justify-center text-white text-sm font-black uppercase tracking-widest">
        Próximo ›
      </div>
    </div>

    {/* Tooltip */}
    <div className="text-center">
      <span className="inline-block bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-xl">
        Use os botões para navegar entre as transações
      </span>
    </div>

    {/* Green callout */}
    <div className="flex items-center gap-3 p-4 bg-emerald-950/90 border border-emerald-700 rounded-2xl">
      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-black text-base">
        ✓
      </div>
      <div>
        <p className="text-sm font-bold text-white">Revise cada transação</p>
        <p className="text-xs text-emerald-300 mt-0.5">
          Suas edições ficam guardadas até concluir
        </p>
      </div>
    </div>

    {/* Dismiss */}
    <button
      onClick={onDismiss}
      className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
    >
      Entendi, vamos lá
    </button>
  </div>
</div>
```

Keep the `ONBOARDING_KEY` export unchanged at the top of the file.

- [ ] **Step 2: Manual verification**

Clear the key: in DevTools console run `localStorage.removeItem('import_swipe_onboarding_seen')`, reopen the import swipe sheet. Confirm the tutorial highlights the bottom buttons and the copy mentions buttons (not swipe).
Expected: tutorial matches the new bottom-nav UX.

- [ ] **Step 3: Commit**

```bash
git add src/components/ImportOnboardingOverlay.jsx
git commit -m "docs: update import tutorial for bottom-button navigation"
```

---

## Area B — Form parity + investment data

### Task 5: Fix planner goals missing in import (version fallback)

**Files:**
- Modify: `src/pages/planner/carteira/walletVersion.js`
- Create: `src/pages/planner/carteira/walletVersion.test.js` (if absent; otherwise append)
- Modify: `src/pages/planner/usePlannerGoals.js`

**Interfaces:**
- Produces: `getActiveVersionOrLatest(walletVersions, month)` — returns the active version for `month`, or the latest version when none matches, or `null` when the list is empty.

- [ ] **Step 1: Write the failing test**

Create/append `src/pages/planner/carteira/walletVersion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getActiveVersionOrLatest } from './walletVersion';

describe('getActiveVersionOrLatest', () => {
  const v = (from) => ({ from, layers: [] });

  it('returns null for empty list', () => {
    expect(getActiveVersionOrLatest([], '2026-06')).toBeNull();
  });
  it('returns the active version when one matches the month', () => {
    expect(getActiveVersionOrLatest([v('2026-01'), v('2026-05')], '2026-06').from).toBe('2026-05');
  });
  it('falls back to the latest version when all versions are in the future', () => {
    expect(getActiveVersionOrLatest([v('2026-07'), v('2026-09')], '2026-06').from).toBe('2026-09');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/planner/carteira/walletVersion.test.js`
Expected: FAIL — `getActiveVersionOrLatest` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/pages/planner/carteira/walletVersion.js`, add after `getActiveVersion`:

```js
/**
 * Like getActiveVersion, but falls back to the most recent version when none
 * applies to `month` (e.g. a plan whose only version starts in a future month).
 * Returns null only when there are no versions at all.
 * @param {Array} walletVersions
 * @param {string} month - 'YYYY-MM'
 * @returns {object|null}
 */
export function getActiveVersionOrLatest(walletVersions, month) {
  if (!walletVersions?.length) return null;
  const active = getActiveVersion(walletVersions, month);
  if (active) return active;
  const sorted = [...walletVersions].sort((a, b) => a.from.localeCompare(b.from));
  return sorted[sorted.length - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/planner/carteira/walletVersion.test.js`
Expected: PASS.

- [ ] **Step 5: Use the fallback in usePlannerGoals**

In `src/pages/planner/usePlannerGoals.js`, change the import:

```js
import { getActiveVersionOrLatest } from './carteira/walletVersion';
```

Replace the `getActiveVersion(walletVersions, currentMonth)` call with `getActiveVersionOrLatest(walletVersions, currentMonth)`.

- [ ] **Step 6: Manual verification**

`npm run dev`, open the import swipe sheet for an account that has a planner with wallet sublayers. Confirm the **Meta do planejamento** dropdown lists the plans (matches what the edit modal shows).
Expected: planner goals populate consistently.

- [ ] **Step 7: Commit**

```bash
git add src/pages/planner/carteira/walletVersion.js src/pages/planner/carteira/walletVersion.test.js src/pages/planner/usePlannerGoals.js
git commit -m "fix: fall back to latest wallet version so planner goals show in import"
```

---

### Task 6: Persist typed investment fields on the investment doc

**Files:**
- Modify: `src/contexts/InvestmentContext.jsx:360-375` (the `newInvestment` object in `addInvestment`)

**Interfaces:**
- Consumes: `investmentData.{ticker,platform,coinName,fundName}` (optional).
- Produces: an `investments` doc that stores `ticker, platform, coinName, fundName` so the edit modal and portfolio can read them back.

- [ ] **Step 1: Add the typed fields to newInvestment**

In `addInvestment`, extend the `newInvestment` object (after `notes`, before `createdAt`):

```js
        ticker: investmentData.ticker || null,
        platform: investmentData.platform || null,
        coinName: investmentData.coinName || null,
        fundName: investmentData.fundName || null,
```

- [ ] **Step 2: Manual verification**

`npm run dev`, create a manual stock investment with a ticker + platform via the investment form, then open it for edit. Confirm ticker and platform are populated (previously empty).
Expected: ticker/platform round-trip correctly.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/InvestmentContext.jsx
git commit -m "fix: persist ticker/platform/coinName/fundName on investment docs"
```

---

### Task 7: Create a linked investment doc when importing an investment transaction

**Files:**
- Modify: `src/components/ImportModal.jsx` (the `handleImport` loop, `:346-389`)

**Interfaces:**
- Consumes: `useInvestments().addInvestment(investmentData, createTransaction)` from `InvestmentContext`; `INVESTMENT_TYPES`/category check (a transaction is an investment when `t.category === 'Investimentos' || t.category === 'Investments'`).
- Produces: for each imported investment-category transaction, an `investments` doc linked via `transactionId`, so it appears in the portfolio and edits resolve `linkedInvestment`.

- [ ] **Step 1: Wire addInvestment into ImportModal**

At the top of `ImportModal.jsx`, add (or extend the existing context import):

```jsx
import { useInvestments } from '../contexts/InvestmentContext';
```

Inside the component, near the other hooks:

```jsx
const { addInvestment } = useInvestments();
```

- [ ] **Step 2: Create the linked investment after the transaction is written**

In `handleImport` (`:349-383`), capture the created transaction ref and, for investment-category rows, create the linked investment. Replace the loop body:

```jsx
const toImport = transactions.filter(t => t.selected);
for (const t of toImport) {
  const isInvestment = t.category === 'Investimentos' || t.category === 'Investments';
  const txRef = await addDoc(collection(db, 'transactions'), {
    userId: auth.currentUser.uid,
    type: t.type,
    description: t.description,
    amount: t.amount,
    category: t.category,
    createdAt: serverTimestamp(),
    date: t.date,
    imported: true,
    hash: t.hash,
    dedupHash: t.dedupHash || null,
    bankId: selectedBankId || null,
    paymentMethod: selectedBankId ? importPaymentMethod : null,
    isInstallment: t.isInstallment || false,
    installmentCurrent: t.installmentCurrent || null,
    installmentTotal: t.installmentTotal || null,
    installmentGroupId: t.installmentGroupId || null,
    autoGenerated: t.autoGenerated || false,
    goalId: t.goalId || null,
    goalName: t.goalName || null,
    plannerGoalId: t.plannerGoalId || null,
    investmentType: t.investmentType || null,
    ticker: t.ticker || null,
    platform: t.platform || null,
    coinName: t.coinName || null,
    fundName: t.fundName || null,
    propertyDescription: t.propertyDescription || null,
    expectedReturn: t.expectedReturn != null ? parseFloat(t.expectedReturn) / 100 : null,
    returnType: t.returnType || null,
    maturityDate: t.maturityDate || null,
    metadata: t.metadata || null,
  });

  if (isInvestment && !t.ignored) {
    // createTransaction:false — the transaction already exists above; just link to it.
    await addInvestment({
      name: t.ticker || t.fundName || t.coinName || t.description,
      type: t.investmentType || 'fixed_income',
      bank: t.platform || selectedBankId || '',
      initialAmount: t.amount,
      currentAmount: t.amount,
      expectedReturn: t.expectedReturn != null ? parseFloat(t.expectedReturn) / 100 : 0,
      returnType: t.returnType || 'annual',
      purchaseDate: t.date ? t.date.split('T')[0] : undefined,
      maturityDate: t.maturityDate || null,
      goalId: t.goalId || null,
      plannerGoalId: t.plannerGoalId || null,
      ticker: t.ticker || null,
      platform: t.platform || null,
      coinName: t.coinName || null,
      fundName: t.fundName || null,
      transactionId: txRef.id,
    }, false);
  }
}
setStep('done');
```

- [ ] **Step 3: Confirm addInvestment links by transactionId**

Open `src/contexts/InvestmentContext.jsx` `addInvestment` and verify `newInvestment` includes `transactionId: investmentData.transactionId || null`. If it does not, add that line alongside the fields from Task 6 (the edit modal resolves the link via `investments.transactionId === transaction.id` at `EditSingleTransactionModal.jsx:57`).

- [ ] **Step 4: Manual verification**

`npm run dev`, import a transaction categorized as **Investimentos** with a ticker + platform set in the swipe sheet. After import: (a) open it for edit → ticker/platform are populated; (b) open the investments/portfolio view → the position appears.
Expected: imported investment shows in edit and portfolio.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportModal.jsx src/contexts/InvestmentContext.jsx
git commit -m "fix: create linked investment doc when importing investment transactions"
```

---

### Task 8: Extract a shared TransactionFields component for edit + import

**Files:**
- Create: `src/components/transaction/TransactionFields.jsx`
- Modify: `src/components/ImportSwipeSheet.jsx`
- Modify: `src/components/EditSingleTransactionModal.jsx`

**Interfaces:**
- Produces: `TransactionFields` — a presentational component rendering description, amount, type, payment method, date, category, investment fields (type + ticker/platform/coinName/fundName/expectedReturn/maturity per `investmentType`), goal, and planner-goal selectors. It is controlled:
  - Props: `value` (the transaction/draft object), `onChange(field, value)`, `categories`, `availableGoals`, `plannerGoals`, `language`, `isCreditCard`, `formatCurrency`.
  - Does **not** render the import status control (import-only) or save/delete/installment UI (edit-only) — those stay in the parents.

- [ ] **Step 1: Create TransactionFields from the import card body**

Create `src/components/transaction/TransactionFields.jsx` by moving the field JSX currently in `ImportSwipeSheet.jsx` between the identity row and the status control — i.e. Description (`:217-226`), Amount+Type (`:228-266`), Payment method (`:268-292`), Date (`:294-303`), Category (`:305-335`), Investment fields (`:337-440`), Goal (`:442-462`), Planner goal (`:464-484`). Wrap them in:

```jsx
import { useSettings, UNCATEGORIZED_CATEGORY } from '../../contexts/SettingsContext';
import CurrencyInput from '../ui/CurrencyInput';
import { INVESTMENT_TYPES } from '../../contexts/InvestmentContext';

export default function TransactionFields({
  value: trans,
  onChange: patch,
  categories,
  availableGoals,
  plannerGoals,
  language,
  isCreditCard,
  formatCurrency,
}) {
  const label = (pt, en) => (language === 'pt' ? pt : en);
  const fieldLabel = (text) => (
    <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
      {text}
    </label>
  );
  const isInvestmentCategory =
    trans.category === 'Investimentos' || trans.category === 'Investments';

  return (
    <div className="flex flex-col gap-3">
      {/* …moved field JSX here, unchanged… */}
    </div>
  );
}
```

Keep the moved JSX byte-for-byte (it already uses `patch`, `trans`, `label`, `fieldLabel`, `formatCurrency`, `categories`, `availableGoals`, `plannerGoals`, `language`, `isCreditCard`, `INVESTMENT_TYPES`, `UNCATEGORIZED_CATEGORY`).

- [ ] **Step 2: Render TransactionFields inside ImportSwipeSheet**

In `ImportSwipeSheet.jsx`, import it:

```jsx
import TransactionFields from './transaction/TransactionFields';
```

Replace the `<div className="flex flex-col gap-3"> … </div>` field block (everything from `:215` Description through `:484` Planner goal) with:

```jsx
<TransactionFields
  value={trans}
  onChange={patch}
  categories={categories}
  availableGoals={availableGoals}
  plannerGoals={plannerGoals}
  language={language}
  isCreditCard={isCreditCard}
  formatCurrency={formatCurrency}
/>
```

Then re-add the import status control (from Task 3) **below** `<TransactionFields />`, still inside the scrollable area. Remove the now-unused local `fieldLabel`/`INVESTMENT_TYPES` if no longer referenced.

- [ ] **Step 3: Manual verification of import parity**

`npm run dev`, mobile viewport, open the import swipe sheet. Confirm every field still renders and edits correctly (description, amount, type, payment, date, category, investment fields appear for investment category, goals, planner goal), and the status control sits below them.
Expected: import card looks and behaves exactly as before Task 8.

- [ ] **Step 4: Commit the extraction**

```bash
git add src/components/transaction/TransactionFields.jsx src/components/ImportSwipeSheet.jsx
git commit -m "refactor: extract shared TransactionFields from import swipe sheet"
```

- [ ] **Step 5: Use TransactionFields in EditSingleTransactionModal**

In `EditSingleTransactionModal.jsx`, replace the modal's hand-rolled field markup (the investment type/ticker/platform/coinName/fundName blocks around `:488-724` and the description/amount/category/date/goal inputs) with `<TransactionFields … />`, driven by the modal's existing state. Map the modal's individual `useState` values into a single `value` object and route `onChange(field, val)` back to the matching setters, e.g.:

```jsx
import TransactionFields from './transaction/TransactionFields';

const fieldsValue = {
  description, amount, type, paymentMethod, date, category,
  investmentType, ticker, platform, coinName, fundName,
  expectedReturn, maturityDate, goalId: selectedGoalId,
  plannerGoalId: selectedPlannerGoalId,
};

const handleFieldChange = (field, val) => {
  switch (field) {
    case 'description': return setDescription(val);
    case 'amount': return setAmount(val);
    case 'type': return setType(val);
    case 'paymentMethod': return setPaymentMethod(val);
    case 'date': return setDate(val);
    case 'category': return setCategory(val);
    case 'investmentType': return setInvestmentType(val);
    case 'ticker': return setTicker(val);
    case 'platform': return setPlatform(val);
    case 'coinName': return setCoinName(val);
    case 'fundName': return setFundName(val);
    case 'expectedReturn': return setExpectedReturn(val);
    case 'maturityDate': return setMaturityDate(val);
    case 'goalId': return setSelectedGoalId(val);
    case 'plannerGoalId': return setSelectedPlannerGoalId(val);
    default: return undefined;
  }
};
```

Render `<TransactionFields value={fieldsValue} onChange={handleFieldChange} categories={categories} availableGoals={availableGoals} plannerGoals={plannerGoals} language={language} isCreditCard={false} formatCurrency={formatCurrency} />` in place of the removed inputs. Keep the modal's save/delete/installment-scope controls. Confirm the field names produced by `TransactionFields` (`investmentType`, `ticker`, etc.) match these setters exactly.

> Note: `TransactionFields` exposes `fixed_income`, `stocks`, `etf`, `fii`, `crypto`, `funds`, `other` (from `INVESTMENT_TYPES`). If the edit modal previously supported `real_estate`/`propertyDescription`, add a `real_estate` branch to `TransactionFields` (ticker-less, with a `propertyDescription` text field) so parity is preserved — otherwise that type would silently lose its UI.

- [ ] **Step 6: Manual verification of edit parity**

`npm run dev`, open an existing transaction for edit. Confirm the form matches the import card (same fields, order, styling), investment fields show ticker/platform for stock investments and are pre-filled from the linked investment, and saving persists changes.
Expected: edit form is visually and functionally identical to the import card.

- [ ] **Step 7: Commit**

```bash
git add src/components/EditSingleTransactionModal.jsx src/components/transaction/TransactionFields.jsx
git commit -m "refactor: use shared TransactionFields in edit transaction modal"
```

---

## Area C — Login reliability

### Task 9: Force the Google account picker on PWA re-login

**Files:**
- Modify: `src/pages/SharedLogin.jsx:147` (the `popupUrl` construction)

**Interfaces:**
- Produces: a popup URL that always asks Google which account to use, so logout → login no longer silently reuses the last account.

- [ ] **Step 1: Add prompt=select_account to the handler URL**

In `SharedLogin.jsx` `handleGoogleSignIn`, change the `popupUrl`:

```jsx
const popupUrl = `${protocol}://${authDomain}/__/auth/handler?apiKey=${apiKey}&prompt=select_account`;
```

- [ ] **Step 2: Manual verification**

Build and run as PWA (`npm run build && npm run preview`), install/open the PWA, log in, then log out, then log in again. Confirm Google shows the account chooser instead of jumping straight into the last account.
Expected: account picker appears on every login.

> If `prompt` is not honored on the `/__/auth/handler` URL in testing, apply systematic-debugging: inspect how the handler forwards params to Google's OAuth endpoint, and instead pass `prompt=select_account` through the provider/custom-parameters path used by the popup. Re-test before committing.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SharedLogin.jsx
git commit -m "fix: force Google account picker on re-login in PWA"
```

---

### Task 10: Stabilize the post-login pipeline (investigate-first)

**Files:**
- Investigate/Modify: `src/pages/LoadingPage.jsx`, `src/components/LoginLoader.jsx`, `src/components/LoginLoader.timing.js`, and the dashboard/context hydration path (`src/contexts/*Context.jsx`, `src/pages/Dashboard.jsx`).

**Interfaces:**
- Produces: a login→dashboard flow where the loader stays until first dashboard data is ready, real failures are surfaced (not silently routed home), and the dashboard does not paint zeros that require a manual refresh.

- [ ] **Step 1: Reproduce and root-cause with systematic-debugging**

REQUIRED SUB-SKILL: Use `superpowers:systematic-debugging`. Reproduce each reported symptom and confirm the cause before changing code:
  1. "Welcome takes too long" / "Demorando mais que o normal… / Tentar novamente" — time the `getCustomToken` callable (`LoadingPage.jsx:40`). Confirm whether the 8s `MAX_DISPLAY_MS` cap (`LoginLoader.jsx:14`) is hit due to function cold start.
  2. "Sometimes an error but goes home anyway" — trace the catch in `LoadingPage.jsx` (`:50-58`) which sets `__rw_login_error`, signs out, and redirects to `/login`; confirm under what conditions the user still lands on the dashboard.
  3. "Dashboard shimmer keeps playing / everything 0, needs refresh" — confirm the loader's `onFinished` navigates to `/dashboard` (`LoadingPage.jsx`) **before** the data contexts (`BillsContext`, `CardsContext`, etc.) have hydrated, so the first paint shows empty/zero state.

Write down the confirmed cause for each before proceeding. Do not implement fixes for a symptom whose cause is not confirmed.

- [ ] **Step 2: Hold the loader until first dashboard data is ready**

Once confirmed that navigation races hydration: gate `onFinished`/navigation on a "first data ready" signal. Concretely, expose a readiness flag from the data contexts (e.g. a `dataReady` boolean that flips true after the initial Firestore snapshot of transactions/bills resolves) and have `LoadingPage` keep `LoginLoader` mounted until both `isReady` (auth) and `dataReady` are true. Keep the existing `MAX_DISPLAY_MS` cap as the timeout escape hatch. Implement using the exact context APIs found in Step 1 (record the chosen flag name here once known, e.g. `useAccess().dataReady`).

- [ ] **Step 3: Surface real failures instead of silent home routing**

In `LoadingPage.jsx` catch block, when `getCustomToken`/`signInWithCustomToken` fails, route to `/login` **with** the error already stored (current behavior at `:52-56`) AND ensure `SharedLogin` renders that stored error (it reads `__rw_login_error` at `:39-48`). Verify the error is not lost when the redirect happens; if it is, confirm the cause from Step 1 and fix the storage/read ordering.

- [ ] **Step 4: Manual verification**

`npm run build && npm run preview`, log in fresh several times (including after the function has gone cold). Confirm: loader stays until the dashboard has real data (no zero-state flash, no manual refresh needed); genuine failures show an error on the login screen instead of silently landing on an empty dashboard.
Expected: consistent, honest login→dashboard transition.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LoadingPage.jsx src/components/LoginLoader.jsx src/contexts
git commit -m "fix: hold login loader until dashboard data ready and surface login errors"
```

---

## Self-Review

- **Spec coverage:** Area A items 1-5 → Tasks 1-4 (date CSS, swipe removal + bottom nav, status control, tutorial). Area B items 1-3 → Tasks 5 (planner race), 6-7 (investment persistence + link), 8 (shared form). Area C items 1-2 → Tasks 9 (account picker), 10 (login pipeline). All spec sections map to a task.
- **Placeholders:** Task 10 is intentionally investigate-first (per spec "investigate-first"); its implementation steps name exact files and concrete fixes, with the readiness-flag name to be recorded once Step 1 confirms the context API. All other tasks contain complete code.
- **Type consistency:** `statusFromFlags`/`flagsForStatus` used consistently (Tasks 3, 8). `getActiveVersionOrLatest` consistent (Task 5). `TransactionFields` prop/field names (`investmentType`, `ticker`, `platform`, `coinName`, `fundName`, `expectedReturn`, `maturityDate`, `goalId`, `plannerGoalId`) are the same in Tasks 8 Step 1, 8 Step 5, and match `ImportModal`/`addInvestment` fields in Tasks 6-7.
