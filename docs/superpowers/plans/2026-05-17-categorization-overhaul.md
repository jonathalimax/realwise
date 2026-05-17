# Categorization Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable AI categorization via feature flag, migrate user correction rules to a shared Firestore project, and replace null/"Outros" fallback with "Sem categoria" as the canonical unmatched-transaction state.

**Architecture:** Short-circuit `aiCategorizationService.js` with a feature flag. Add a write path to `moneywise-ad9ec` shared Firestore from `categorizationService.js`. Change the fallback return in `categorizationService.js` and all downstream callers from null to "Sem categoria". Seed a "Sem categoria" category document on first import per user.

**Tech Stack:** React 19, Firebase Firestore (client SDK + secondary app instance), Vitest (pure function tests), Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-05-17-categorization-overhaul-design.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/services/aiCategorizationService.js` | Short-circuit `categorizeWithAI` and `batchCategorizeWithAI` with feature flag |
| Modify | `src/services/categorizationService.js` | Change fallback to "Sem categoria"; improve `extractPattern`; add shared-rule write |
| Modify | `src/firebase.js` | Export `sharedDb` (secondary Firebase app for `moneywise-ad9ec`) |
| Modify | `src/services/importers/index.js` | Seed "Sem categoria" category doc after import; pass `clientConfig` to `categorizeParsedTransactions` |
| Modify | `src/pages/Transactions.jsx` | Replace "Pending Review"/"To Review" filter with "Sem categoria" filter |
| Modify | `src/components/TransactionList.jsx` | Replace `!category` indicator with `category === 'Sem categoria'` indicator |
| Modify | `src/services/categorizationService.test.js` | Add new `extractPattern` test cases |

---

## Task 1: Short-Circuit AI Categorization with Feature Flag

**Files:**
- Modify: `src/services/aiCategorizationService.js`

- [ ] **Step 1: Open the file and locate `categorizeWithAI` and `batchCategorizeWithAI`**

Read `src/services/aiCategorizationService.js`. Find the exported functions `categorizeWithAI` and `batchCategorizeWithAI` (search for `export async function categorize`).

- [ ] **Step 2: Add the feature flag bypass to `categorizeWithAI`**

At the very top of `categorizeWithAI`, before any Gemini logic, add:

```js
export async function categorizeWithAI(description, userId, options = {}) {
  // Feature flag: bypass Gemini until shared rules are reliable
  const useAI = options.clientConfig?.features?.useAICategorization === true;
  if (!useAI) {
    return { category: 'Sem categoria', source: 'none' };
  }
  // ... rest of existing function unchanged
```

- [ ] **Step 3: Add the feature flag bypass to `batchCategorizeWithAI`**

Find `batchCategorizeWithAI`. At the top, add:

```js
export async function batchCategorizeWithAI(transactions, userId, options = {}) {
  // Feature flag: bypass Gemini until shared rules are reliable
  const useAI = options.clientConfig?.features?.useAICategorization === true;
  if (!useAI) {
    return transactions.map(() => ({ category: 'Sem categoria', source: 'none' }));
  }
  // ... rest of existing function unchanged
```

Note: the return must be an array of the same length as `transactions`. The `.map` above guarantees this.

- [ ] **Step 4: Verify the caller passes options correctly**

Open `src/services/importers/index.js`. Find the call to `batchCategorizeWithAI`. Confirm `options` is passed through. The call likely looks like:

```js
const aiResults = await batchCategorizeWithAI(transactions, userId, options);
```

If `options` is not passed or doesn't include `clientConfig`, that will be fixed in Task 5. For now just verify the signature matches.

- [ ] **Step 5: Commit**

```bash
git add src/services/aiCategorizationService.js
git commit -m "feat: bypass AI categorization via useAICategorization feature flag"
```

---

## Task 2: Improve `extractPattern` Regex

**Files:**
- Modify: `src/services/categorizationService.js`
- Modify: `src/services/categorizationService.test.js`

- [ ] **Step 1: Write failing tests for the new pattern cases**

Open `src/services/categorizationService.test.js`. Add these test cases (in the existing `extractPattern` describe block):

```js
describe('extractPattern — noise removal improvements', () => {
  test('strips PIX asterisk-prefixed short ID', () => {
    expect(extractPattern('PIX JOAO *12345 05/04')).toBe('PIX JOAO');
  });

  test('strips trailing 2-digit/2-digit date fragments', () => {
    expect(extractPattern('PIX JOAO 05/04')).toBe('PIX JOAO');
  });

  test('strips asterisk-prefixed alphanumeric merchant suffix', () => {
    expect(extractPattern('IFOOD*ABC123')).toBe('IFOOD');
  });

  test('strips transfer noise words at start', () => {
    expect(extractPattern('TRANSF PIX RESTAURANTE BOM')).toBe('PIX RESTAURANTE BOM');
  });

  test('truncates to first segment if result exceeds 50 chars', () => {
    const long = 'MERCADO PAGO MUITO LONGO NOME DO ESTABELECIMENTO AQUI BRASIL';
    const result = extractPattern(long);
    expect(result.length).toBeLessThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/services/categorizationService.test.js
```

Expected: multiple FAIL lines for the new cases.

- [ ] **Step 3: Implement the regex improvements in `extractPattern`**

In `src/services/categorizationService.js`, inside `extractPattern`, add these rules **after** the existing UUID removal and **before** the whitespace cleanup:

```js
// Strip asterisk-prefixed merchant suffixes: IFOOD*ABC123 → IFOOD
pattern = pattern.replace(/\*[A-Z0-9]{4,}/g, '');

// Strip short trailing date fragments not caught by full-date regex: " 05/04"
pattern = pattern.replace(/\s+\d{2}\/\d{2}$/g, '');

// Strip transfer noise words at the start of the pattern
pattern = pattern.replace(/^(TRANSF|TED|DOC|PAGAMENTO|RECEBIDO)\s+/g, '');

// Strip asterisk-prefixed short IDs anywhere: *12345
pattern = pattern.replace(/\s*\*\d{4,}/g, '');
```

Then, **after** the whitespace cleanup (`pattern.replace(/\s+/g, ' ').trim()`), add the truncation:

```js
// Truncate oversized patterns to first meaningful segment
if (pattern.length > 50) {
  const firstSegment = pattern.split(/\s{2,}|-/)[0].trim();
  pattern = firstSegment.length >= 3 ? firstSegment : pattern.substring(0, 50);
}
```

- [ ] **Step 4: Run all categorization tests**

```bash
npx vitest run src/services/categorizationService.test.js
```

Expected: ALL tests PASS including old ones.

- [ ] **Step 5: Commit**

```bash
git add src/services/categorizationService.js src/services/categorizationService.test.js
git commit -m "feat: improve extractPattern — strip PIX noise, asterisk suffixes, transfer words"
```

---

## Task 3: Change Fallback to "Sem categoria"

**Files:**
- Modify: `src/services/categorizationService.js`
- Modify: `src/constants/defaultCategorizationRules.js` (if fallback lives there)

- [ ] **Step 1: Find where the fallback category is returned**

Search for where null, "Outros", or "Diversos" is returned as a fallback:

```bash
grep -n "return null\|Outros\|Diversos\|Pending Review" src/services/categorizationService.js src/constants/defaultCategorizationRules.js
```

- [ ] **Step 2: Replace every fallback return with "Sem categoria"**

For each match, change the fallback. The pattern will be something like:

```js
// BEFORE (any of these):
return null;
return { category: null, ... };
return { category: 'Outros', ... };
return { category: 'Diversos', ... };

// AFTER:
return { category: 'Sem categoria', type: 'expense', source: 'none' };
```

Check `src/constants/defaultCategorizationRules.js` for the `categorizeTransaction` function's final return/default branch. Change it to return `'Sem categoria'` (not null, not "Outros").

- [ ] **Step 3: Also fix `aiCategorizationService.js` fallback**

Search for where `categorizeWithAI` returns `null` on confidence-below-threshold or Gemini failure:

```bash
grep -n "return.*null\|category.*null" src/services/aiCategorizationService.js
```

Change any `{ category: null, source: 'none' }` to `{ category: 'Sem categoria', source: 'none' }`.

- [ ] **Step 4: Run all tests to check for regressions**

```bash
npx vitest run src/
```

Expected: all pass. If any test asserts `category === null` or `category === 'Outros'`, update the assertion to `'Sem categoria'`.

- [ ] **Step 5: Commit**

```bash
git add src/services/categorizationService.js src/constants/defaultCategorizationRules.js src/services/aiCategorizationService.js
git commit -m "feat: replace null/Outros fallback with 'Sem categoria' as canonical uncategorized state"
```

---

## Task 4: Export `sharedDb` from `src/firebase.js`

**Files:**
- Modify: `src/firebase.js`
- Read first: `public/clients/app.json` (to see the shape of client config)

- [ ] **Step 1: Understand the existing Firebase initialization pattern**

Read `src/firebase.js`. Find the `initializeFirebase(config)` function and the exported `auth`, `db`, `storage`, `functions` live bindings.

Also check: is there already a secondary app instance for `moneywise-ad9ec`? Search:

```bash
grep -n "moneywise\|sharedDb\|secondaryApp\|initializeApp" src/firebase.js
```

- [ ] **Step 2: Add shared Firebase app initialization**

The shared project credentials are already used for import issues (check `src/services/importIssueService.js` to see how it connects). Reuse the same pattern.

If `sharedDb` doesn't already exist in `src/firebase.js`, add it. The shared config should be stored in a constant (not per-client JSON, since it's always the same project):

```js
// At the top of firebase.js, after imports:
const SHARED_FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",           // moneywise-ad9ec credentials
  authDomain: "moneywise-ad9ec.firebaseapp.com",
  projectId: "moneywise-ad9ec",
  storageBucket: "moneywise-ad9ec.appspot.com",
  messagingSenderId: "...",
  appId: "...",
};

// Initialize secondary app (only once):
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const sharedApp = getApps().find(a => a.name === 'shared') 
  ?? initializeApp(SHARED_FIREBASE_CONFIG, 'shared');

export const sharedDb = getFirestore(sharedApp);
```

**Important:** get the actual credentials from `src/services/importIssueService.js` or wherever the shared project is already referenced — do NOT make up credentials.

- [ ] **Step 3: Verify `sharedDb` is importable**

```bash
grep -rn "sharedDb\|moneywise" src/services/
```

Confirm that wherever the shared project is already used (e.g., `importIssueService.js`), the same `sharedDb` can be used.

- [ ] **Step 4: Commit**

```bash
git add src/firebase.js
git commit -m "feat: export sharedDb for moneywise-ad9ec shared Firestore access"
```

---

## Task 5: Write User Corrections to Shared Rules

**Files:**
- Modify: `src/services/categorizationService.js`

- [ ] **Step 1: Import `sharedDb` in `categorizationService.js`**

Add to the imports at the top of `src/services/categorizationService.js`:

```js
import { sharedDb } from '../firebase';
import { collection as sharedCollection, query as sharedQuery, where as sharedWhere,
         getDocs as sharedGetDocs, addDoc as sharedAddDoc, updateDoc as sharedUpdateDoc,
         doc as sharedDoc, increment as sharedIncrement, serverTimestamp } from 'firebase/firestore';
```

(You can use the same imported Firestore functions as the per-client db — they work with any db instance.)

- [ ] **Step 2: Add `writeSharedRule` helper**

After the existing imports, add:

```js
async function writeSharedRule(pattern, category, userEmail) {
  if (!pattern || !category || category === 'Sem categoria') return;
  try {
    const rulesRef = sharedCollection(sharedDb, 'sharedCategorizationRules');
    const q = sharedQuery(rulesRef, sharedWhere('pattern', '==', pattern));
    const snap = await sharedGetDocs(q);

    if (!snap.empty) {
      await sharedUpdateDoc(sharedDoc(sharedDb, 'sharedCategorizationRules', snap.docs[0].id), {
        category,
        usageCount: sharedIncrement(1),
        updatedAt: serverTimestamp(),
      });
    } else {
      await sharedAddDoc(rulesRef, {
        pattern,
        category,
        source: 'user_correction',
        createdBy: userEmail || 'unknown',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        usageCount: 1,
        isActive: true,
      });
    }
  } catch (err) {
    // Best-effort — never block the user flow
    console.warn('[categorizationService] Failed to write shared rule:', err);
  }
}
```

- [ ] **Step 3: Call `writeSharedRule` from `saveUserCategorizationRule`**

In `saveUserCategorizationRule`, after the existing per-client rule write succeeds, add:

```js
// Best-effort write to shared rules so all clients benefit
await writeSharedRule(pattern, category, null); // userId is not the user's email; pass null
```

If the function has access to the user's email, pass it. Otherwise `null` is fine — `createdBy` will be `'unknown'`.

- [ ] **Step 4: Commit**

```bash
git add src/services/categorizationService.js
git commit -m "feat: write user category corrections to shared moneywise-ad9ec rules collection"
```

---

## Task 6: Read Shared Rules at Import Time

**Files:**
- Modify: `src/services/importers/index.js`

- [ ] **Step 1: Add `loadSharedCategorizationRules` function**

In `src/services/importers/index.js` (or a new file `src/services/sharedRulesService.js` if cleaner), add:

```js
import { sharedDb } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export async function loadSharedCategorizationRules() {
  try {
    const rulesRef = collection(sharedDb, 'sharedCategorizationRules');
    const q = query(rulesRef, where('isActive', '==', true), orderBy('usageCount', 'desc'), limit(1000));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        keywords: [data.pattern],
        category: data.category,
        type: data.type || 'expense',
        priority: 20,
        isSharedRule: true,
      };
    });
  } catch (err) {
    console.warn('[importers] Failed to load shared rules:', err);
    return [];
  }
}
```

- [ ] **Step 2: Call `loadSharedCategorizationRules` in `categorizeParsedTransactions`**

In `src/services/importers/index.js`, find `categorizeParsedTransactions`. Before the categorization loop, load shared rules alongside per-user rules:

```js
async function categorizeParsedTransactions(transactions, userId, options = {}) {
  // Load rules from both per-user and shared collections
  const [userRules, sharedRules] = await Promise.all([
    userId ? loadUserCategorizationRules(userId) : Promise.resolve([]),
    loadSharedCategorizationRules(),
  ]);
  const allRules = [...userRules, ...sharedRules]; // user rules take precedence (loaded first, higher usedCount)

  // ... rest of existing categorization logic, replace `userRules` with `allRules`
```

- [ ] **Step 3: Pass `clientConfig` through to AI bypass**

Also in `categorizeParsedTransactions`, ensure `options.clientConfig` is available when `batchCategorizeWithAI` is called. The `options` object should already carry this through from `parseFile` → `categorizeParsedTransactions`. If not, update the caller in `ImportModal.jsx` to pass `clientConfig` in options.

- [ ] **Step 4: Commit**

```bash
git add src/services/importers/index.js
git commit -m "feat: load shared categorization rules from moneywise-ad9ec at import time"
```

---

## Task 7: Seed "Sem categoria" Category Document

**Files:**
- Modify: `src/services/importers/index.js`

- [ ] **Step 1: Find where categories are stored**

Search for how the app reads and writes categories:

```bash
grep -rn "categories\|category" src/contexts/SettingsContext.jsx | head -30
```

Determine the Firestore path for a user's categories. It will be something like `settings/{userId}` with a `categories` field, or a subcollection. Note the exact path.

- [ ] **Step 2: Add `seedSemCategoria` function**

Add to `src/services/importers/index.js` (or a utilities file):

```js
async function seedSemCategoria(userId) {
  if (!userId) return;
  try {
    // Adjust this path to match the real categories storage location
    // Example: if categories are stored in settings/{userId}.categories array:
    const settingsRef = doc(db, 'settings', userId);
    const snap = await getDoc(settingsRef);
    const categories = snap.data()?.categories || [];
    const alreadyExists = categories.some(c =>
      (typeof c === 'string' ? c : c.name) === 'Sem categoria'
    );
    if (alreadyExists) return;

    await updateDoc(settingsRef, {
      categories: [...categories, {
        name: 'Sem categoria',
        color: '#6b7280',
        icon: 'help-circle',
        type: 'both',
        isSystem: true,
      }]
    });
  } catch (err) {
    console.warn('[importers] Failed to seed Sem categoria:', err);
  }
}
```

**Important:** The exact implementation of this function depends on the real categories data model. Before implementing, read `src/contexts/SettingsContext.jsx` to find the correct Firestore path and document structure. Adjust the function body accordingly.

- [ ] **Step 3: Call `seedSemCategoria` during import save**

In the import save flow (where transactions are written to Firestore after the confirmation modal), call:

```js
await seedSemCategoria(userId); // fire-and-forget is fine
```

This is idempotent — it checks for existence before writing.

- [ ] **Step 4: Commit**

```bash
git add src/services/importers/index.js
git commit -m "feat: seed 'Sem categoria' category document on first import per user"
```

---

## Task 8: Update UI — Replace "Pending Review" with "Sem categoria" Filter

**Files:**
- Modify: `src/pages/Transactions.jsx`
- Modify: `src/components/TransactionList.jsx` (if it has its own filter)

- [ ] **Step 1: Find all "Pending Review" / null-category references**

```bash
grep -rn "Pending Review\|To Review\|To review\|pendingReview\|category.*null\|!category\|category === null" src/pages/ src/components/
```

- [ ] **Step 2: Replace filter logic in `Transactions.jsx`**

Find the filter that shows uncategorized transactions. Change:

```js
// BEFORE (any of these):
transactions.filter(t => !t.category)
transactions.filter(t => t.category === null)
transactions.filter(t => t.category === 'Pending Review')

// AFTER:
transactions.filter(t => t.category === 'Sem categoria')
```

Change the filter label in the UI from "To Review" / "Pending Review" / "Sem Categoria" to **"Sem categoria"** (exact string, lowercase 'c').

- [ ] **Step 3: Replace null-category badge in `TransactionList.jsx`**

Find the badge/indicator that shows when a transaction has no category. Change:

```jsx
// BEFORE:
{!transaction.category && <Badge color="yellow">Revisar</Badge>}
// or:
{transaction.category === null && <span>Needs Category</span>}

// AFTER:
{transaction.category === 'Sem categoria' && (
  <span className="text-xs text-gray-400 dark:text-gray-500">Sem categoria</span>
)}
```

The indicator should be subtle (gray) since "Sem categoria" is a normal state, not a warning.

- [ ] **Step 4: Run the dev server and visually check**

```bash
npm run dev
```

Navigate to `http://localhost:5173/app/transactions`. Verify:
- The "Sem categoria" filter exists and works.
- No "Pending Review" or "To Review" labels remain.
- Transactions with `category === 'Sem categoria'` show the gray indicator.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Transactions.jsx src/components/TransactionList.jsx
git commit -m "feat: replace Pending Review UI with Sem categoria filter and indicator"
```
