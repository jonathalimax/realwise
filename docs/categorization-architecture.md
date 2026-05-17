# Categorization Architecture

How Realwise auto-categorizes imported bank transactions.

---

## Overview

Every transaction imported from a bank statement goes through a **three-layer pipeline** before it's saved to Firestore. Layers run in priority order — if a higher-priority layer produces a match, the lower layers are skipped.

```
Raw transaction description
         │
         ▼
  ┌─────────────────────────┐  priority 20 (user rules)
  │  1. Per-user rules       │  userCategorizationRules/{userId}
  │     + Shared rules       │  sharedCategorizationRules (moneywise-ad9ec)
  └──────────┬──────────────┘
             │ no match
             ▼
  ┌─────────────────────────┐  priority 8–15 (built-in keyword rules)
  │  2. Default rules        │  src/constants/defaultCategorizationRules.js
  └──────────┬──────────────┘
             │ no match
             ▼
  ┌─────────────────────────┐
  │  3. Fallback             │  → "Sem categoria"
  └─────────────────────────┘
```

AI categorization (Gemini) is **disabled by default**. It can be re-enabled per client via the `useAICategorization` feature flag in the client config JSON.

---

## Layer 1 — Learned Rules (Priority 20)

### Per-user rules (`userCategorizationRules`)

Every time a user manually changes a transaction's category in the UI, the app extracts a normalized pattern from the description and saves a rule to the client's Firestore:

```
userCategorizationRules/{ruleId}
  userId       string
  pattern      string   — normalized (see extractPattern below)
  category     string
  type         "income" | "expense"
  usedCount    number   — incremented on each match
  isActive     boolean
```

These are loaded at import time (up to 500, ordered by `usedCount` desc) and injected as custom rules with **priority 20**, higher than any default rule.

### Shared rules (`sharedCategorizationRules`)

Located in the shared Firebase project (`moneywise-ad9ec`). Same schema minus `userId`. When a user corrects a category, the correction is **also written here** (best-effort, never blocks the user). Every client reads from this collection at import time, so a correction made by one user immediately benefits all others.

```
sharedCategorizationRules/{ruleId}
  pattern      string
  category     string
  source       "admin" | "user_correction"
  usageCount   number
  isActive     boolean
```

**Read path:** `loadSharedCategorizationRules()` fetches all active shared rules once per import session.

**Write path:** `writeSharedRule(pattern, category)` in `categorizationService.js` — wrapped in try/catch, never throws.

---

## Layer 2 — Default Rules (Priority 8–15)

Defined in `src/constants/defaultCategorizationRules.js` as a static array of rule objects:

```js
{
  keywords: ['IFOOD', 'UBER EATS', 'RAPPI', ...],
  category: 'Alimentação',
  type: 'expense',
  priority: 10
}
```

### Priority scale

| Priority | Used for |
|---|---|
| 15 | Income categories (Salário, Freelance) — must not be overridden by expense rules |
| 14 | High-confidence income (Investimentos, Reembolso) |
| 13 | Other income |
| 10 | Standard expense categories |
| 9 | Subscriptions (overlaps with many services — slightly lower to avoid false positives) |
| 8 | Generic catch-alls |

### Matching algorithm (`categorizeTransaction`)

1. Merge custom rules (per-user + shared, priority 20) with default rules.
2. Sort all rules by `priority` descending.
3. For each rule, normalize the description: uppercase + NFD accent-strip.
4. For each keyword in the rule: check if the normalized description **includes** the normalized keyword. Keyword ending in `*` matches as a prefix (e.g., `UBER*` matches `UBER TRIP`, `UBER EATS`).
5. First match wins — return `{ category, type, matchedKeyword, confidence: 1.0 }`.
6. If no rule matches → return `null` (caller converts to `"Sem categoria"`).

---

## Pattern Extraction (`extractPattern`)

Before saving a user correction as a rule, the raw description is normalized into a reusable pattern. This prevents storing overly specific strings that won't match future transactions.

**Steps applied (in order):**

| Step | Example input → output |
|---|---|
| Uppercase + NFD accent removal | `"Pix João"` → `"PIX JOAO"` |
| Remove dates (`dd/mm/yyyy`, etc.) | `"PIX JOAO 05/04/2026"` → `"PIX JOAO"` |
| Remove time (`HH:MM`) | `"COMPRA 14:32"` → `"COMPRA"` |
| Remove installment indicators (`PARCELA 1/12`) | `"AMAZON 1/12"` → `"AMAZON"` |
| Remove 6+ digit IDs | `"PIX 123456789"` → `"PIX"` |
| Remove UUIDs | stripped |
| Remove city/state suffix (`- SAO PAULO SP`) | stripped |
| Strip `*`-prefixed merchant suffixes | `"IFOOD*ABC123"` → `"IFOOD"` |
| Strip trailing `dd/mm` fragments | `"PIX JOAO 05/04"` → `"PIX JOAO"` |
| Strip leading transfer noise words | `"TRANSF PIX JOAO"` → `"PIX JOAO"` |
| Strip `*`-prefixed short IDs | `"PIX JOAO *12345"` → `"PIX JOAO"` |
| Truncate to 50 chars (first segment) | very long descriptions capped |
| Collapse whitespace | `"PIX  JOAO"` → `"PIX JOAO"` |

---

## The "Sem categoria" State

`"Sem categoria"` is a **real category**, not a null/unknown sentinel.

- `categorizationService.js` returns `"Sem categoria"` (not `null`) when no layer matches.
- A `"Sem categoria"` Firestore category document is seeded for each user on their first import (gray color, `isSystem: true`).
- The UI shows a gray indicator on transactions with this category and exposes a `category === "Sem categoria"` filter on the Transactions page.
- It never appears as a budget target.

---

## AI Categorization (Disabled)

`aiCategorizationService.js` wraps the Gemini 2.0 Flash Lite API. It is **bypassed by default** via a feature flag check at the top of both `categorizeWithAI` and `batchCategorizeWithAI`:

```js
const useAI = options.clientConfig?.features?.useAICategorization === true;
if (!useAI) return { category: 'Sem categoria', source: 'none' };
```

To re-enable for a specific client, add to their `public/clients/{clientId}.json`:

```json
{
  "features": {
    "useAICategorization": true
  }
}
```

When enabled, the AI layer runs **after** Layer 1 (learned rules) and **before** the fallback — only for transactions that didn't match any keyword rule. Results below a confidence threshold of 0.6 are treated as no-match.

---

## Import Pipeline

The full flow during a bank statement import:

```
parseFile(file, bankType, userId, options)
    │
    ├─ parseCSV / parseExcel / parseOfx / extractPdfText
    │
    ▼
categorizeParsedTransactions(transactions, userId, options)
    │
    ├─ loadUserCategorizationRules(userId)       ← per-user Firestore
    ├─ loadSharedCategorizationRules()           ← shared Firestore (moneywise-ad9ec)
    │
    ├─ for each transaction:
    │      categorizeTransaction(description, [...userRules, ...sharedRules])
    │      → hit?  use that category + source
    │      → miss? category = "Sem categoria"
    │
    ├─ assignPositionalIndices(transactions)     ← for dedup hash stability
    ├─ generateTransactionHash(...)              ← date|amount|bankType|originalId|index
    │
    ▼
ImportModal confirmation — user reviews, can reassign categories
    │
    ▼
filterDuplicates(transactions, userId)          ← Firestore dedupHash query
    │
    ▼
Batch write to Firestore (transactions collection)
    │
    ▼
saveUserCategorizationRule (on manual correction)
    ├─ write to userCategorizationRules (per-client)
    └─ writeSharedRule (shared project, best-effort)
```

---

## Files Reference

| File | Role |
|---|---|
| `src/constants/defaultCategorizationRules.js` | Static keyword → category rules with priorities |
| `src/services/categorizationService.js` | `extractPattern`, `saveUserCategorizationRule`, `writeSharedRule`, `loadUserCategorizationRules` |
| `src/services/aiCategorizationService.js` | Gemini integration (bypassed by default) |
| `src/services/importers/index.js` | `categorizeParsedTransactions`, `loadSharedCategorizationRules`, dedup hash assignment |
| `src/contexts/SettingsContext.jsx` | `ALL_CATEGORIES_BY_LANG`, `DEFAULT_CATEGORIES_BY_LANG` — predefined category lists |
| `src/firebase.js` | `sharedDb` — secondary Firebase app instance for `moneywise-ad9ec` |
