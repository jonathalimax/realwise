# Categorization Overhaul — Design Specification

**Date:** 2026-05-17
**Status:** Draft

---

## Overview

Three targeted changes to the categorization pipeline:

1. **Disable AI categorization** via feature flag — Gemini is unreliable and expensive.
2. **Move user correction rules to a shared Firestore project** so every client benefits from improvements made by any user.
3. **Replace null / "Outros" / "Pending Review" with "Sem categoria"** as the canonical unmatched-transaction state, backed by a real Firestore category document.

---

## 1. Disable AI Categorization

### Change

In `src/services/aiCategorizationService.js`, short-circuit `categorizeWithAI` (and `batchCategorizeWithAI`) at the top of the function:

```js
// Feature flag check — bypass Gemini until shared rules prove reliable
const USE_AI = clientConfig?.features?.useAICategorization === true;

export async function categorizeWithAI(description, userId, options = {}) {
  if (!USE_AI) return { category: 'Sem categoria', source: 'none' };
  // ... existing Gemini logic unchanged below
}

export async function batchCategorizeWithAI(transactions, userId, options = {}) {
  if (!USE_AI) return transactions.map(() => ({ category: 'Sem categoria', source: 'none' }));
  // ... existing batch logic unchanged below
}
```

The `useAICategorization` flag defaults to absent/false in every client JSON. No client config files need to change today — the flag is reserved for future re-enablement. The existing Gemini code and `aiQuota` quota-tracking remain intact.

`batchCategorizeWithAI` is called in `src/services/importers/index.js` during `categorizeParsedTransactions`. When bypassed it must still return an array of the same length as the input so the mapping logic downstream doesn't break.

---

## 2. Shared Categorization Rules Database

### Problem

`userCategorizationRules` in each client's Firestore means a correction made by user A in client X never reaches user B in client Y. The shared project (`moneywise-ad9ec`) already hosts cross-client data (leads, purchases, import issues).

### Data Model — Shared Firestore (`moneywise-ad9ec`)

```
sharedCategorizationRules/{ruleId}
  pattern        string   — normalized (output of extractPattern)
  category       string   — e.g. "Alimentação"
  source         "admin" | "user_correction"
  createdBy      string   — admin email or user email
  createdAt      timestamp
  updatedAt      timestamp
  usageCount     number   — incremented each time this rule matches a transaction
  isActive       boolean  — soft-delete flag
```

No `userId` field — rules are global by design.

### Read Path (import time)

1. At import start, `categorizeParsedTransactions` fetches all active shared rules from `moneywise-ad9ec` (one `getDocs` call, cached for the session).
2. These are combined with the existing `defaultCategorizationRules` constants, with shared rules taking priority (same priority=20 scheme as the old per-user rules).
3. Result: same `categorizeTransaction` call chain, same fallback to `"Sem categoria"`.

### Write Path (user manual correction)

When a user changes a transaction's category in the UI (any place that calls `saveUserCategorizationRule`), the correction is written to **both**:
- The existing per-client `userCategorizationRules` collection (unchanged — fast local lookup).
- The shared `sharedCategorizationRules` collection in `moneywise-ad9ec` (new write, best-effort — wrapped in try/catch so a shared-project outage never breaks the client app).

Write to shared rules uses a separate Firebase app instance initialized with `moneywise-ad9ec` credentials. The credentials are stored in each client's config JSON under `sharedFirebase` (already used for import issues — reuse the same initialized app reference exported from `src/firebase.js` as `sharedDb`).

### Migration

Existing `userCategorizationRules` documents are not automatically migrated to the shared collection. They remain active for their per-client users. A one-time admin script (`scripts/migrate-shared-rules.js`) can be run manually to copy high-`usedCount` rules if needed — out of scope for this spec.

---

## 3. "Sem categoria" as the Default Category

### Problem

The old "review-first" model (`2026-04-17-uncategorized-and-analytics.md`) proposed returning `null` from `categorizationService.js`. This created a two-state problem: `null` was sometimes treated as "uncategorized" and sometimes as "not yet assigned", leading to inconsistent UI rendering and Firestore queries.

### Decision

`"Sem categoria"` is a real, named category. It must:
- Exist as a Firestore document in every client's `settings/{userId}.categories` or the shared categories collection (per existing app architecture).
- Display with a gray color / neutral icon in all category lists and transaction lists.
- Never appear as a budget target.
- Be filterable in `TransactionList` with a `category === "Sem categoria"` filter (replaces any "Pending Review" / "To Review" filter).

### Changes to `categorizationService.js`

`categorizeTransaction` currently returns the first matching rule's category, or falls through to the last `default` branch which may return `"Outros"`. Change: the fallback must return `"Sem categoria"` explicitly:

```js
// At end of categorizeTransaction:
return { category: 'Sem categoria', type: 'expense', source: 'none' };
```

Remove any branch that returns `null`, `undefined`, or `"Outros"` as a fallback.

### "Sem categoria" category document

During the import save flow (when transactions are written to Firestore), check whether a `"Sem categoria"` category document exists for this user. If not, create it:

```js
// Pseudo — exact collection path depends on how settings/categories are stored
{
  name: 'Sem categoria',
  color: '#6b7280',   // Tailwind gray-500
  icon: 'help-circle',
  type: 'both',       // can appear on income or expense
  isSystem: true,     // prevents deletion
  createdAt: serverTimestamp()
}
```

This is a best-effort write (fire-and-forget, wrapped in try/catch). It runs once per user per import — cheap.

### UI Impact

- **TransactionList / Transactions.jsx:** Replace any `!category` or `category === null` filter with `category === 'Sem categoria'`. Update the filter label to "Sem categoria".
- **Remove "Pending Review" / "To Review" UI states** — any badge, tab, section, or filter using those labels must be changed to show "Sem categoria" instead.
- **Category selector:** "Sem categoria" must appear in the dropdown but visually distinguished (gray, at the top of the list or in a special section labeled "Sem categoria"), so users can see it and reassign quickly.
- **Dashboard / charts:** Transactions categorized as "Sem categoria" should be included in totals but visually highlighted (gray) so users notice them. Do not hide them from summaries.

---

## 4. Improved `extractPattern`

The current implementation in `categorizationService.js` already handles dates, installments, and long UUIDs. The following gaps remain:

1. **PIX sender names with trailing short IDs** — `PIX JOAO *12345 05/04` → strip `*` followed by digits, strip trailing `\d{2}/\d{2}` date fragments that didn't get caught by the existing date regex.
2. **Transfer noise words** — words like `TRANSF`, `TED`, `DOC`, `PAGAMENTO`, `RECEBIDO` at the start of a PIX description often precede the actual merchant/person name. They should be stripped for pattern purposes.
3. **Short numeric suffixes** after merchant names** — `IFOOD*ABC123` → `IFOOD`. Strip `\*[A-Z0-9]{4,}` suffixes.
4. **Trim to first meaningful segment** — after all noise removal, if the result is still >50 chars, truncate to the first word segment (split on `-` or multiple spaces) to avoid overly specific patterns.

These are additive regex changes inside `extractPattern`. The existing tests in `categorizationService.test.js` must still pass; add new test cases for the four patterns above.

---

## Scope

**In scope:**
- Bypass `categorizeWithAI` / `batchCategorizeWithAI` with feature flag.
- Write corrections to shared Firestore.
- Read shared rules at import time.
- Change fallback to `"Sem categoria"` everywhere.
- Seed `"Sem categoria"` category document on first use.
- Update filter labels in `TransactionList` / `Transactions.jsx`.
- Improve `extractPattern` regex.
- Unit tests for `extractPattern` changes.

**Out of scope:**
- Re-enabling AI categorization.
- Admin UI to manage shared rules (future).
- Migrating existing `userCategorizationRules` to shared collection.
- Analytics on categorization effectiveness (prior spec — not revived here).

---

## Risks

| Risk | Mitigation |
|---|---|
| Shared Firestore write fails (network, auth) | Best-effort only — wrapped in try/catch, never blocks user flow |
| Shared rules conflict with per-client rule names | Shared rules use the same `pattern` string; if two rules share the same pattern but different category, the first-match wins. Admin can delete stale shared rules via Firestore console until a management UI is built. |
| "Sem categoria" category document uses wrong collection path | Look up where existing categories are stored (settings doc, subcollection, or top-level) before implementing the seed write |
| Transactions already stored as `null` or `"Outros"` | Not backfilled — only new imports affected. A migration script can be added later if needed. |
