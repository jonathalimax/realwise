# Import Swipe Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the import preview step with grouped-by-date rich cards, a bottom sheet editor that navigates between transactions without closing, and a one-time onboarding overlay.

**Architecture:** Three new files (`groupByDate.js`, `ImportOnboardingOverlay.jsx`, `ImportSwipeSheet.jsx`) plus targeted changes to `ImportModal.jsx`. The sheet reads transaction state from `ImportModal` via props and writes back via a `patchDraftTransaction` callback — no Firestore writes happen until the user taps the existing "Importar X transações" footer button.

**Tech Stack:** React 19, Tailwind CSS v4, Vitest (pure function tests only), localStorage for onboarding flag.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/groupByDate.js` | Pure function: group sorted transaction array by date |
| Create | `src/utils/groupByDate.test.js` | Vitest tests for groupByDate |
| Create | `src/components/ImportOnboardingOverlay.jsx` | One-time overlay teaching ‹ › navigation |
| Create | `src/components/ImportSwipeSheet.jsx` | Bottom sheet editor with navigation + onboarding |
| Modify | `src/components/ImportModal.jsx` | Grouped list, new card layout, wire ImportSwipeSheet |

---

## Task 1: Pure utility — `groupByDate`

**Files:**
- Create: `src/utils/groupByDate.js`
- Create: `src/utils/groupByDate.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/groupByDate.test.js
import { describe, it, expect } from 'vitest';
import { groupByDate } from './groupByDate';

describe('groupByDate', () => {
  it('returns empty array for empty input', () => {
    expect(groupByDate([])).toEqual([]);
  });

  it('groups transactions sharing a date into one entry', () => {
    const txs = [
      { _localId: '1', date: '2025-05-12T10:00:00.000Z' },
      { _localId: '2', date: '2025-05-12T18:00:00.000Z' },
    ];
    const result = groupByDate(txs);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-05-12');
    expect(result[0].transactions).toHaveLength(2);
  });

  it('creates a separate group for each distinct date', () => {
    const txs = [
      { _localId: '1', date: '2025-05-12T10:00:00.000Z' },
      { _localId: '2', date: '2025-05-11T09:00:00.000Z' },
      { _localId: '3', date: '2025-05-10T08:00:00.000Z' },
    ];
    const result = groupByDate(txs);
    expect(result.map(g => g.date)).toEqual(['2025-05-12', '2025-05-11', '2025-05-10']);
  });

  it('preserves order within each group', () => {
    const txs = [
      { _localId: 'a', date: '2025-05-12T10:00:00.000Z' },
      { _localId: 'b', date: '2025-05-12T18:00:00.000Z' },
    ];
    const result = groupByDate(txs);
    expect(result[0].transactions.map(t => t._localId)).toEqual(['a', 'b']);
  });

  it('handles transactions with no T separator in date string', () => {
    const txs = [{ _localId: '1', date: '2025-05-12' }];
    const result = groupByDate(txs);
    expect(result[0].date).toBe('2025-05-12');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/utils/groupByDate.test.js
```
Expected: FAIL — `Cannot find module './groupByDate'`

- [ ] **Step 3: Write the implementation**

```js
// src/utils/groupByDate.js

/**
 * Groups an already-sorted transaction array by calendar date.
 * @param {Array<{date: string}>} sortedTransactions
 * @returns {Array<{date: string, transactions: Array}>}
 */
export function groupByDate(sortedTransactions) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;

  for (const t of sortedTransactions) {
    const date = t.date ? t.date.split('T')[0] : 'unknown';
    if (date !== currentDate) {
      currentDate = date;
      currentGroup = { date, transactions: [] };
      groups.push(currentGroup);
    }
    currentGroup.transactions.push(t);
  }

  return groups;
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npx vitest run src/utils/groupByDate.test.js
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/groupByDate.js src/utils/groupByDate.test.js
git commit -m "feat: add groupByDate utility with tests"
```

---

## Task 2: `ImportOnboardingOverlay` component

**Files:**
- Create: `src/components/ImportOnboardingOverlay.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/ImportOnboardingOverlay.jsx
export const ONBOARDING_KEY = 'import_swipe_onboarding_seen';

export default function ImportOnboardingOverlay({ onDismiss }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-end pb-6 px-4">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative w-full max-w-sm flex flex-col gap-4">
        {/* Spotlight nav row */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-9 h-9 rounded-xl border-2 border-violet-400 shadow-[0_0_0_4px_rgba(167,139,250,0.3)] bg-gray-800 dark:bg-gray-900 flex items-center justify-center text-white text-xl font-black">
            ‹
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-28 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="w-[11%] h-full bg-white rounded-full" />
            </div>
            <span className="text-xs font-bold text-gray-400">1 de 27</span>
          </div>
          <div className="w-9 h-9 rounded-xl border-2 border-violet-400 shadow-[0_0_0_4px_rgba(167,139,250,0.3)] bg-gray-800 dark:bg-gray-900 flex items-center justify-center text-white text-xl font-black">
            ›
          </div>
        </div>

        {/* Tooltip */}
        <div className="text-center">
          <span className="inline-block bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-xl">
            ‹ › ou arraste para navegar
          </span>
        </div>

        {/* Green callout */}
        <div className="flex items-center gap-3 p-4 bg-emerald-950/90 border border-emerald-700 rounded-2xl">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 text-white font-black text-base">
            ✓
          </div>
          <div>
            <p className="text-sm font-bold text-white">Navegue à vontade</p>
            <p className="text-xs text-emerald-300 mt-0.5">
              Suas edições ficam guardadas até o final
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
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ImportOnboardingOverlay.jsx
git commit -m "feat: add ImportOnboardingOverlay component"
```

---

## Task 3: `ImportSwipeSheet` — navigation shell

**Files:**
- Create: `src/components/ImportSwipeSheet.jsx`

- [ ] **Step 1: Create the shell with navigation only (no edit form yet)**

```jsx
// src/components/ImportSwipeSheet.jsx
import { useState, useRef, useEffect } from 'react';
import ImportOnboardingOverlay, { ONBOARDING_KEY } from './ImportOnboardingOverlay';

export default function ImportSwipeSheet({
  transactions,
  initialIndex,
  isCreditCard,
  onUpdate,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const goTo = (index) => {
    if (index < 0 || index >= transactions.length) return;
    setCurrentIndex(index);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0) goTo(currentIndex + 1);
    else goTo(currentIndex - 1);
  };

  const trans = transactions[currentIndex];
  const isLast = currentIndex === transactions.length - 1;

  if (!trans) return null;

  return (
    <>
      {showOnboarding && <ImportOnboardingOverlay onDismiss={dismissOnboarding} />}

      {/* Backdrop (list dims behind sheet) */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[90vh]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-600" />
        </div>

        {/* Navigation header */}
        <div className="flex items-center gap-2.5 px-4 pt-2 pb-1">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
          >
            ‹
          </button>

          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isLast ? 'bg-emerald-500' : 'bg-gray-900 dark:bg-white'
                }`}
                style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
              />
            </div>
            <span
              className={`text-[11px] font-bold transition-colors ${
                isLast
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {isLast
                ? `${currentIndex + 1} de ${transactions.length} ✓`
                : `${currentIndex + 1} de ${transactions.length}`}
            </span>
          </div>

          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={isLast}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
          >
            ›
          </button>
        </div>

        {/* Scrollable content area — edit form goes here in Task 4 */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 min-h-0">
          <p className="text-sm text-gray-500 text-center mt-8">Edit form coming in Task 4</p>
        </div>

        {/* Footer: close button only on last card */}
        {isLast && (
          <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ImportSwipeSheet.jsx
git commit -m "feat: add ImportSwipeSheet navigation shell"
```

---

## Task 4: `ImportSwipeSheet` — full edit form

**Files:**
- Modify: `src/components/ImportSwipeSheet.jsx`

- [ ] **Step 1: Add settings/cards imports and the full edit form body**

Replace the entire content of `src/components/ImportSwipeSheet.jsx` with:

```jsx
// src/components/ImportSwipeSheet.jsx
import { useState, useRef, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import ImportOnboardingOverlay, { ONBOARDING_KEY } from './ImportOnboardingOverlay';

export default function ImportSwipeSheet({
  transactions,
  initialIndex,
  isCreditCard,
  onUpdate,
  onClose,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const touchStartX = useRef(null);
  const { categories, formatCurrency, language } = useSettings();

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const goTo = (index) => {
    if (index < 0 || index >= transactions.length) return;
    setCurrentIndex(index);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0) goTo(currentIndex + 1);
    else goTo(currentIndex - 1);
  };

  const trans = transactions[currentIndex];
  const isLast = currentIndex === transactions.length - 1;

  if (!trans) return null;

  const patch = (field, value) => onUpdate(trans._localId, { [field]: value });

  const typeLabel = (type) =>
    type === 'income'
      ? language === 'pt' ? 'ENTRADA' : 'INCOME'
      : language === 'pt' ? 'SAÍDA' : 'EXPENSE';

  return (
    <>
      {showOnboarding && <ImportOnboardingOverlay onDismiss={dismissOnboarding} />}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[90vh]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200 dark:bg-gray-600" />
        </div>

        {/* Navigation header */}
        <div className="flex items-center gap-2.5 px-4 pt-2 pb-1">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
          >
            ‹
          </button>

          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isLast ? 'bg-emerald-500' : 'bg-gray-900 dark:bg-white'
                }`}
                style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
              />
            </div>
            <span
              className={`text-[11px] font-bold transition-colors ${
                isLast
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {isLast
                ? `${currentIndex + 1} de ${transactions.length} ✓`
                : `${currentIndex + 1} de ${transactions.length}`}
            </span>
          </div>

          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={isLast}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xl font-black disabled:opacity-30 active:scale-95 transition-all text-gray-900 dark:text-white"
          >
            ›
          </button>
        </div>

        {/* Scrollable edit form */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 min-h-0">
          {/* Identity row */}
          <div className="flex items-start gap-2.5 mb-5">
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                trans.type === 'income'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40'
                  : 'bg-rose-100 dark:bg-rose-900/40'
              }`}
            >
              <svg
                className={`w-4 h-4 ${
                  trans.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {trans.type === 'income' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                )}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-gray-900 dark:text-white line-clamp-2 leading-snug">
                {trans._isGroup ? trans._baseDescription : trans.description}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p
                className={`text-lg font-black whitespace-nowrap ${
                  trans.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trans.type === 'income' ? '+' : '-'}
                {formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
              </p>
            </div>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3">
            {/* Description */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                {language === 'pt' ? 'Descrição' : 'Description'}
              </label>
              <input
                type="text"
                value={trans.description}
                onChange={(e) => patch('description', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Amount + Type */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                  {language === 'pt' ? 'Valor' : 'Amount'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={trans.amount}
                  onChange={(e) => patch('amount', parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              {!isCreditCard && (
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                    {language === 'pt' ? 'Tipo' : 'Type'}
                  </label>
                  <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700 rounded-xl gap-0.5">
                    <button
                      onClick={() => patch('type', 'expense')}
                      className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
                        trans.type === 'expense'
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-400'
                      }`}
                    >
                      {typeLabel('expense')}
                    </button>
                    <button
                      onClick={() => patch('type', 'income')}
                      className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
                        trans.type === 'income'
                          ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-400'
                      }`}
                    >
                      {typeLabel('income')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                {language === 'pt' ? 'Categoria' : 'Category'}
              </label>
              <div className="relative">
                <select
                  value={trans.category || ''}
                  onChange={(e) => patch('category', e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-9"
                >
                  <option value="">{language === 'pt' ? 'Sem categoria' : 'Uncategorized'}</option>
                  {(categories[trans.type] || []).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                {language === 'pt' ? 'Data' : 'Date'}
              </label>
              <input
                type="date"
                value={trans.date ? trans.date.split('T')[0] : ''}
                onChange={(e) => patch('date', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Include toggle */}
            <div className="flex items-center justify-between px-3.5 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {language === 'pt' ? 'Incluir na importação' : 'Include in import'}
              </span>
              <button
                onClick={() => patch('selected', !trans.selected)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  trans.selected ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-800 shadow transition-transform ${
                    trans.selected ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Fechar only on last card */}
        {isLast && (
          <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all shadow-xl shadow-emerald-600/20"
            >
              {language === 'pt' ? 'Fechar' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ImportSwipeSheet.jsx
git commit -m "feat: add ImportSwipeSheet full edit form"
```

---

## Task 5: `ImportModal` — new card layout

**Files:**
- Modify: `src/components/ImportModal.jsx`

This task replaces `TransactionRowContent` with the new card design (grouped by date, checkbox outside, category with ▾, no tap-to-toggle-type). Do not touch the import/submit logic — only the preview rendering.

- [ ] **Step 1: Add `groupByDate` import and replace `TransactionRowContent`**

At the top of `ImportModal.jsx`, add:
```js
import { groupByDate } from '../utils/groupByDate';
```

Remove the entire `TransactionRowContent` function (lines 48–189) and replace it with the new `ImportTransactionCard` component:

```jsx
function ImportTransactionCard({ trans, locale, language, formatCurrency, onToggleSelect, onOpen }) {
  const isUncategorized = !trans.category || trans.category === 'Sem categoria';

  return (
    <div className="flex items-center gap-2.5">
      {/* Checkbox — outside card */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(trans._localId); }}
        className={`w-[22px] h-[22px] rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
          trans.selected
            ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
            : trans.isDuplicate
              ? 'border-amber-300 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/30'
              : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600'
        }`}
      >
        {trans.selected && (
          <svg className="w-3 h-3 text-white dark:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Card — tapping opens edit */}
      <div
        onClick={() => onOpen(trans._localId)}
        className={`flex-1 p-3.5 rounded-2xl shadow-sm cursor-pointer transition-all active:scale-[.99] ${
          !trans.selected
            ? 'bg-gray-100 dark:bg-gray-900/50 opacity-60'
            : isUncategorized
              ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700'
              : 'bg-white dark:bg-gray-800'
        }`}
      >
        {/* Title row: type dot + title + value */}
        <div className="flex items-start gap-2.5">
          {/* Type dot — display only */}
          <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
            trans.type === 'income'
              ? 'bg-emerald-100 dark:bg-emerald-900/40'
              : 'bg-rose-100 dark:bg-rose-900/40'
          }`}>
            <svg className={`w-3 h-3 ${
              trans.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {trans.type === 'income' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              )}
            </svg>
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug">
              {trans._isGroup ? trans._baseDescription : trans.description}
            </p>
          </div>

          {/* Value */}
          <div className="flex-shrink-0 min-w-[72px] text-right">
            <p className={`text-sm font-black whitespace-nowrap ${
              trans.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {trans.type === 'income' ? '+' : '-'}
              {formatCurrency(trans._isGroup ? trans._totalAmount : trans.amount)}
            </p>
          </div>
        </div>

        {/* Category row */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight inline-flex items-center gap-1 ${
            isUncategorized
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
              : trans.type === 'income'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
          }`}>
            {trans.category || (language === 'pt' ? 'Sem categoria' : 'Uncategorized')}
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
          {trans.isDuplicate && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              trans.isAiDuplicate
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}>
              {trans.isAiDuplicate && '🤖 '}
              {language === 'pt' ? 'DUPLICADA' : 'DUPLICATE'}
            </span>
          )}
          {trans._isGroup && (
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
              {trans.installmentTotal}x
            </span>
          )}
          {trans.aiCategorized && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded">
              🤖 AI
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ImportModal.jsx
git commit -m "feat: replace TransactionRowContent with ImportTransactionCard"
```

---

## Task 6: `ImportModal` — grouped preview list + wire ImportSwipeSheet

**Files:**
- Modify: `src/components/ImportModal.jsx`

- [ ] **Step 1: Add `ImportSwipeSheet` import**

At the top of `ImportModal.jsx`, add:
```js
import ImportSwipeSheet from './ImportSwipeSheet';
```

Remove:
```js
import EditSingleTransactionModal from './EditSingleTransactionModal';
```

- [ ] **Step 2: Replace `editingTransaction` state with `swipeSheetIndex`**

Remove:
```js
const [editingTransaction, setEditingTransaction] = useState(null);
```

Add:
```js
const [swipeSheetIndex, setSwipeSheetIndex] = useState(null);
```

- [ ] **Step 3: Replace `openEditTransaction` and `saveDraftTransaction` with new versions**

Remove the entire `openEditTransaction` function (lines 496–507) and `saveDraftTransaction` function (lines 509–549) and replace with:

```js
const openSwipeSheet = (localId) => {
  const index = sortedTransactions.main.findIndex(t => t._localId === localId);
  if (index !== -1) setSwipeSheetIndex(index);
};

const patchDraftTransaction = (localId, patch) => {
  setTransactions(prev => {
    const target = prev.find(t => t._localId === localId);
    const groupId = target?.installmentGroupId;
    return prev.map(t => {
      if (t._localId === localId) return { ...t, ...patch };
      if (groupId && t.installmentGroupId === groupId) {
        const groupPatch = {};
        if ('category' in patch) groupPatch.category = patch.category;
        if ('type' in patch) { groupPatch.type = patch.type; groupPatch.category = 'Sem categoria'; }
        if ('selected' in patch) groupPatch.selected = patch.selected;
        return Object.keys(groupPatch).length ? { ...t, ...groupPatch } : t;
      }
      return t;
    });
  });
};
```

- [ ] **Step 4: Replace the preview step JSX with grouped-by-date layout**

Find the `{step === 'preview' && (` block (lines 682–723) and replace it entirely with:

```jsx
{step === 'preview' && (
  <div className="h-full flex flex-col gap-4">
    {/* Top bar */}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStep('upload')}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-tight"
        >
          ← {t('common.back')}
        </button>
        <span className="px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-xs font-bold uppercase">
          {sortedTransactions.main.length + sortedTransactions.duplicates.length}{' '}
          {language === 'pt' ? 'transações' : 'transactions'}
        </span>
      </div>
      {/* Select all / Clear */}
      <div className="flex gap-1.5">
        <button
          onClick={selectAllTransactions}
          className="px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-[11px] font-black uppercase tracking-tight"
        >
          {language === 'pt' ? 'Selecionar tudo' : 'Select all'}
        </button>
        <button
          onClick={deselectAllTransactions}
          className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-[11px] font-black uppercase tracking-tight text-gray-700 dark:text-gray-300"
        >
          {language === 'pt' ? 'Limpar' : 'Clear'}
        </button>
      </div>
    </div>

    <div ref={transactionsListRef} className="flex-1 overflow-y-auto min-h-0 pb-20">
      {groupByDate(sortedTransactions.main).map(({ date, transactions: group }) => (
        <div key={date} className="mb-4">
          {/* Date header */}
          <div className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 pb-2">
            {new Date(date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex flex-col gap-2">
            {group.map(trans => (
              <ImportTransactionCard
                key={trans._localId}
                trans={trans}
                locale={locale}
                language={language}
                formatCurrency={formatCurrency}
                onToggleSelect={toggleTransactionSelection}
                onOpen={openSwipeSheet}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Duplicates section */}
      {sortedTransactions.duplicates.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsDuplicatesExpanded(!isDuplicatesExpanded)}
            className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-2"
          >
            <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
              {language === 'pt' ? 'Duplicadas' : 'Duplicates'} ({sortedTransactions.duplicates.length})
            </span>
            <svg
              className={`w-4 h-4 text-amber-500 transition-transform ${isDuplicatesExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isDuplicatesExpanded && (
            <div className="flex flex-col gap-2">
              {sortedTransactions.duplicates.map(trans => (
                <ImportTransactionCard
                  key={trans._localId}
                  trans={trans}
                  locale={locale}
                  language={language}
                  formatCurrency={formatCurrency}
                  onToggleSelect={toggleTransactionSelection}
                  onOpen={openSwipeSheet}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 5: Replace `EditSingleTransactionModal` JSX at the bottom**

Remove:
```jsx
<EditSingleTransactionModal
  isOpen={Boolean(editingTransaction)}
  onClose={() => setEditingTransaction(null)}
  transaction={editingTransaction}
  onSaveDraft={saveDraftTransaction}
/>
```

Add before `</ModalWrapper>`:
```jsx
{swipeSheetIndex !== null && (
  <ImportSwipeSheet
    transactions={sortedTransactions.main}
    initialIndex={swipeSheetIndex}
    isCreditCard={importPaymentMethod === 'credit'}
    onUpdate={patchDraftTransaction}
    onClose={() => setSwipeSheetIndex(null)}
  />
)}
```

- [ ] **Step 6: Run the dev server and manually test**

```bash
npm run dev
```

Open `http://localhost:5173/app/dashboard`, navigate to Import, upload a CSV/XLS file, and verify:
- Transactions appear grouped by date with date headers
- Checkbox is outside the card to the left
- Tapping a card opens the bottom sheet
- ‹ › navigate between cards
- Swipe left/right on the sheet navigates
- Editing description/category/type/date updates the card in the list behind the sheet
- On first open, the onboarding overlay appears; after dismissal it never appears again
- On the last card, "Fechar" button appears and closes the sheet
- "Importar X transações" footer button still works and imports to Firestore
- Credit card import: tipo toggle is hidden in the sheet

- [ ] **Step 7: Run linter**

```bash
npm run lint
```

Fix any reported issues.

- [ ] **Step 8: Commit**

```bash
git add src/components/ImportModal.jsx
git commit -m "feat: wire ImportSwipeSheet into ImportModal with grouped date list"
```

---

## Task 7: Run tests, commit, push, deploy

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run src/
```

Expected: all tests PASS (including the new `groupByDate` tests)

- [ ] **Step 2: Production build — verify no errors**

```bash
npm run build
```

Expected: build completes with no errors

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Deploy to Firebase Hosting**

```bash
firebase deploy --only hosting
```

Expected: Deploy complete. URL: `https://realwise.com.br`
