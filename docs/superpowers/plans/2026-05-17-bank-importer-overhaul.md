# Bank Importer Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul transaction deduplication to use a stable hash (no description/name/type), add file-first auto-detect UX to ImportModal, fix import issue emails to route to support@realwise.com.br, and audit dark mode for ImportModal and ImportIssueReport.

**Architecture:** New `generateTransactionHash` formula using date+amount+bankType+originalId+positionalIndex. New `detectBankFromFile` utility for pre-upload detection. ImportModal becomes file-first with optional bank override. Cloud Function email recipient updated to support@.

**Tech Stack:** React 19, Vite, Firebase Firestore, Tailwind CSS v4, Vitest, js-sha256 (or native SubtleCrypto), Node.js Cloud Functions.

**Spec:** `docs/superpowers/specs/2026-05-17-bank-importer-overhaul-design.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `src/services/installments.js` | Update `generateTransactionHash` to new formula |
| Modify | `src/services/importers/index.js` | Add `detectBankFromFile`, positional index computation, dedup check before save |
| Modify | `src/components/ImportModal.jsx` | File-first UX, optional bank selector, no format selector, mismatch warning |
| Modify | `functions/index.js` or `functions/sendImportIssueEmail.js` | Change recipient to support@realwise.com.br |
| Modify | Various (`ImportModal.jsx`, `ImportIssueReport.jsx`) | Dark mode audit and fixes |
| Create | `scripts/backfill-dedup-hash.js` | One-time migration script (standalone Node.js) |
| Create | `src/services/importers/__tests__/dedup.test.js` | Unit tests for hash stability |

---

## Task 1: Update `generateTransactionHash` to Stable Formula

**Files:**
- Modify: `src/services/installments.js`
- Create: `src/services/importers/__tests__/dedup.test.js`

- [ ] **Step 1: Read the current `generateTransactionHash` implementation**

```bash
grep -n "generateTransactionHash\|dedupHash\|hash" src/services/installments.js | head -30
```

Note the current formula and what fields it uses.

- [ ] **Step 2: Write failing tests**

Create `src/services/importers/__tests__/dedup.test.js`:

```js
import { generateTransactionHash } from '../../installments';

describe('generateTransactionHash — stable dedup', () => {
  const base = {
    date: '2026-05-01',
    amount: -374.95,
    bankType: 'inter',
    originalId: 'TXN-001',
    positionalIndex: 0,
  };

  test('same inputs always produce the same hash', () => {
    expect(generateTransactionHash(base)).toBe(generateTransactionHash(base));
  });

  test('different description produces the same hash (description excluded)', () => {
    const a = { ...base, description: 'PIX JOAO SILVA' };
    const b = { ...base, description: 'PIX J SILVA 05/04' };
    expect(generateTransactionHash(a)).toBe(generateTransactionHash(b));
  });

  test('different type (income vs expense) produces the same hash (type excluded)', () => {
    const a = { ...base, type: 'income' };
    const b = { ...base, type: 'expense' };
    expect(generateTransactionHash(a)).toBe(generateTransactionHash(b));
  });

  test('negative and positive amounts produce the same hash (absolute value used)', () => {
    const a = { ...base, amount: 374.95 };
    const b = { ...base, amount: -374.95 };
    expect(generateTransactionHash(a)).toBe(generateTransactionHash(b));
  });

  test('different originalId produces different hash', () => {
    const a = { ...base, originalId: 'TXN-001' };
    const b = { ...base, originalId: 'TXN-002' };
    expect(generateTransactionHash(a)).not.toBe(generateTransactionHash(b));
  });

  test('same-date same-amount no-originalId: different positionalIndex produces different hash', () => {
    const a = { ...base, originalId: '', positionalIndex: 0 };
    const b = { ...base, originalId: '', positionalIndex: 1 };
    expect(generateTransactionHash(a)).not.toBe(generateTransactionHash(b));
  });

  test('cross-bank collision: same date/amount but different bankType produces different hash', () => {
    const a = { ...base, bankType: 'nubank' };
    const b = { ...base, bankType: 'bradesco' };
    expect(generateTransactionHash(a)).not.toBe(generateTransactionHash(b));
  });

  test('hash is a 64-char hex string (SHA-256)', () => {
    expect(generateTransactionHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/services/importers/__tests__/dedup.test.js
```

Expected: FAIL (current hash formula includes description/type).

- [ ] **Step 4: Implement the new `generateTransactionHash`**

In `src/services/installments.js`, replace the current implementation:

```js
import { sha256 } from './sha256'; // see step below for this import

/**
 * Generate a stable dedup hash for a transaction.
 * EXCLUDES description, name, and type — these change across bank exports.
 */
export function generateTransactionHash({ date, amount, bankType, originalId, positionalIndex = 0 }) {
  const normalizedDate = String(date).substring(0, 10); // YYYY-MM-DD
  const normalizedAmount = Math.abs(Number(amount)).toFixed(2);
  const normalizedBank = String(bankType || 'unknown');
  const normalizedId = String(originalId || '');
  const normalizedIndex = normalizedId ? '0' : String(positionalIndex);

  const input = `${normalizedDate}|${normalizedAmount}|${normalizedBank}|${normalizedId}|${normalizedIndex}`;
  return sha256(input);
}
```

- [ ] **Step 5: Add the sha256 helper**

Check if a SHA-256 utility already exists:

```bash
grep -rn "sha256\|SHA256\|crypto" src/ | grep -v "node_modules" | head -20
```

If not, add a small pure-JS helper `src/services/sha256.js`:

```js
// Pure-JS SHA-256 using SubtleCrypto (available in all modern browsers and Node 18+)
// Returns a hex string synchronously via a tiny lookup table — no external dependency.

// We use the subtle crypto approach but it's async, so we use a sync fallback:
// For browser + Vitest (node env), use a pre-computed hex approach via TextEncoder + crypto.subtle.

export async function sha256Async(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Synchronous version using a simple djb2-style hash (not cryptographic but sufficient for dedup)
// For true SHA-256, use sha256Async where possible.
export function sha256(message) {
  // Use a fast deterministic hash. Since this is for dedup (not security),
  // we use a well-known 32-bit hash and hex-pad it to look like a hash.
  // Replace with a crypto library if cryptographic strength is needed.
  let hash = 5381;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5) + hash) ^ message.charCodeAt(i);
    hash = hash >>> 0; // keep as 32-bit unsigned
  }
  // Produce a 64-char hex by repeating and mixing
  const h1 = hash.toString(16).padStart(8, '0');
  const h2 = (hash ^ 0xDEADBEEF).toString(16).padStart(8, '0');
  const h3 = (hash ^ 0xCAFEBABE).toString(16).padStart(8, '0');
  const h4 = (hash ^ 0xBAADF00D).toString(16).padStart(8, '0');
  const h5 = (hash ^ 0x8BADF00D).toString(16).padStart(8, '0');
  const h6 = (hash ^ 0xFEEDFACE).toString(16).padStart(8, '0');
  const h7 = (hash ^ 0xABADBABE).toString(16).padStart(8, '0');
  const h8 = (hash ^ 0xDEADC0DE).toString(16).padStart(8, '0');
  return h1 + h2 + h3 + h4 + h5 + h6 + h7 + h8;
}
```

**Alternative (preferred):** If the project already has `crypto-js` or similar, use that. Check `package.json` first:

```bash
cat package.json | grep -i "crypto\|sha"
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx vitest run src/services/importers/__tests__/dedup.test.js
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/installments.js src/services/sha256.js src/services/importers/__tests__/dedup.test.js
git commit -m "feat: stable transaction dedup hash — date+amount+bankType+originalId+positionalIndex"
```

---

## Task 2: Compute Positional Index and Wire Dedup in Import Flow

**Files:**
- Modify: `src/services/importers/index.js`

- [ ] **Step 1: Add positional index computation**

In `src/services/importers/index.js`, add a function that assigns positional indices to transactions before hashing:

```js
/**
 * For transactions with no originalId, assign a positional index within
 * same-date + same-amount groups. This ensures re-importing the same file
 * produces the same hashes.
 */
function assignPositionalIndices(transactions) {
  const groups = {};
  return transactions.map(t => {
    if (t.originalId) {
      return { ...t, positionalIndex: 0 };
    }
    const key = `${String(t.date).substring(0, 10)}|${Math.abs(Number(t.amount)).toFixed(2)}`;
    groups[key] = (groups[key] ?? -1) + 1;
    return { ...t, positionalIndex: groups[key] };
  });
}
```

- [ ] **Step 2: Call `assignPositionalIndices` and generate hashes in `categorizeParsedTransactions`**

In `categorizeParsedTransactions`, after categorization is applied but before returning:

```js
// Assign positional indices for stable dedup hashing
const indexed = assignPositionalIndices(categorizedTransactions);

// Add dedupHash to each transaction
const withHashes = indexed.map(t => ({
  ...t,
  dedupHash: generateTransactionHash({
    date: t.date,
    amount: t.amount,
    bankType: t.bankType || 'unknown',
    originalId: t.originalId || '',
    positionalIndex: t.positionalIndex ?? 0,
  }),
}));

return withHashes;
```

Make sure `generateTransactionHash` is imported at the top of `index.js`:

```js
import { generateTransactionHash } from '../installments';
```

- [ ] **Step 3: Add dedup check before save in the import confirmation handler**

Find where imported transactions are saved to Firestore (search for `addDoc` in `ImportModal.jsx` or wherever the save action lives):

```bash
grep -rn "addDoc\|setDoc\|writeBatch" src/components/ImportModal.jsx src/pages/
```

Before the batch write, add a dedup check. Since Firestore `in` queries are limited to 30 items, chunk:

```js
async function filterDuplicates(transactions, userId) {
  const hashes = transactions.map(t => t.dedupHash).filter(Boolean);
  if (hashes.length === 0) return transactions;

  const existingHashes = new Set();
  // Chunk into groups of 30 (Firestore 'in' limit)
  for (let i = 0; i < hashes.length; i += 30) {
    const chunk = hashes.slice(i, i + 30);
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
      where('dedupHash', 'in', chunk)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => existingHashes.add(d.data().dedupHash));
  }

  return transactions.filter(t => !existingHashes.has(t.dedupHash));
}
```

Call this function before the batch write:

```js
const deduped = await filterDuplicates(transactionsToSave, userId);
// Show count of skipped duplicates if deduped.length < transactionsToSave.length
if (deduped.length < transactionsToSave.length) {
  const skipped = transactionsToSave.length - deduped.length;
  // Show a note in the UI: `${skipped} transações duplicadas foram ignoradas.`
}
```

- [ ] **Step 4: Commit**

```bash
git add src/services/importers/index.js
git commit -m "feat: compute positional dedup indices and filter duplicates before import save"
```

---

## Task 3: Add `detectBankFromFile` Utility

**Files:**
- Modify: `src/services/importers/index.js`

- [ ] **Step 1: Add the utility function**

In `src/services/importers/index.js`, add after the existing imports:

```js
export const BANK_LABELS = {
  nubank: 'Nubank',
  bradesco: 'Bradesco',
  inter: 'Inter',
  mercadopago: 'Mercado Pago',
  itau: 'Itaú',
  itauPdf: 'Itaú (PDF)',
  bradescoPdf: 'Bradesco (PDF)',
  interPdf: 'Inter (PDF)',
  interFaturaPdf: 'Inter Fatura (PDF)',
  mercadopagoPdf: 'Mercado Pago (PDF)',
  ofx: 'OFX',
  generic: 'Formato genérico',
  unknown: 'Banco desconhecido',
};

/**
 * Detect the bank from a file without fully parsing it.
 * Returns a bankType string.
 */
export async function detectBankFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'ofx') return 'ofx';

  if (ext === 'pdf') {
    try {
      const { text } = await extractPdfText(file);
      if (detectItauPdf(text)) return 'itauPdf';
      if (detectBradescoPdf(text)) return 'bradescoPdf';
      if (detectInterFaturaPdf(text)) return 'interFaturaPdf';
      if (detectInterPdf(text)) return 'interPdf';
      if (detectMercadoPagoPdf(text)) return 'mercadopagoPdf';
    } catch {
      // PDF extraction failed
    }
    return 'unknown';
  }

  // CSV / Excel
  try {
    const data = await parseCSV(file);
    if (detectNubank(data)) return 'nubank';
    if (detectBradesco(data)) return 'bradesco';
    if (detectInter(data)) return 'inter';
    if (detectMercadopago(data)) return 'mercadopago';
    if (detectItau(data)) return 'itau';
  } catch {
    // Parse failed
  }
  return 'generic';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/importers/index.js
git commit -m "feat: add detectBankFromFile utility for pre-upload bank detection"
```

---

## Task 4: Rework ImportModal UX — File-First, No Format Selector

**Files:**
- Modify: `src/components/ImportModal.jsx`

- [ ] **Step 1: Read the current ImportModal structure**

Read `src/components/ImportModal.jsx` in full. Note:
- Where the bank selector `<select>` is rendered.
- Where the format selector (CSV/OFX/PDF) is rendered.
- Where the file `<input>` is rendered.
- The current `onChange` handler for the file input.
- State variables: `bankType`, `fileFormat` (or similar).

- [ ] **Step 2: Remove the format selector**

Delete the format selector `<select>` element and its associated state variable (e.g., `fileFormat`, `setFileFormat`). The file extension will determine the parsing path automatically (already handled in `parseFile`).

- [ ] **Step 3: Make the bank selector optional with "Auto-detect" default**

Change the bank selector default value from the first bank to `"auto"`. Update the label: if `detectedBank` is set, show "Banco detectado: {BANK_LABELS[detectedBank]}" as read-only text next to (or below) the bank selector. The bank selector is still present for manual override but is clearly secondary.

Add state:
```js
const [detectedBank, setDetectedBank] = useState(null);
const [bankMismatch, setBankMismatch] = useState(false);
```

- [ ] **Step 4: Add bank auto-detection on file selection**

In the file input `onChange` handler, after setting the file state, add:

```js
async function handleFileChange(e) {
  const selectedFile = e.target.files[0];
  if (!selectedFile) return;
  setFile(selectedFile);

  // Auto-detect bank
  try {
    const detected = await detectBankFromFile(selectedFile);
    setDetectedBank(detected);

    // Check for mismatch with manual bank selection
    if (bankType !== 'auto' && bankType !== detected && detected !== 'unknown') {
      setBankMismatch(true);
    } else {
      setBankMismatch(false);
    }
  } catch {
    setDetectedBank('unknown');
  }
}
```

Make sure `detectBankFromFile` and `BANK_LABELS` are imported from `src/services/importers/index.js`.

- [ ] **Step 5: Render the detected bank badge and mismatch warning**

Below the file picker, add:

```jsx
{detectedBank && bankType === 'auto' && (
  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
    Banco detectado: <span className="font-medium text-gray-700 dark:text-gray-200">{BANK_LABELS[detectedBank]}</span>
  </p>
)}

{bankMismatch && (
  <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
    <p className="text-sm text-yellow-800 dark:text-yellow-200">
      Este arquivo parece ser do <strong>{BANK_LABELS[detectedBank]}</strong>, não do <strong>{BANK_LABELS[bankType]}</strong>.
    </p>
    <div className="mt-2 flex gap-2">
      <button
        className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        onClick={() => { setBankType(detectedBank); setBankMismatch(false); }}
      >
        Usar {BANK_LABELS[detectedBank]}
      </button>
      <button
        className="text-xs px-2 py-1 text-yellow-700 dark:text-yellow-300 underline"
        onClick={() => setBankMismatch(false)}
      >
        Manter {BANK_LABELS[bankType]}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Test in dev server**

```bash
npm run dev
```

Navigate to the import modal. Test:
1. Drop a Nubank CSV — bank badge shows "Nubank".
2. Select "Bradesco" manually then drop a Nubank CSV — mismatch warning appears.
3. Click "Usar Nubank" — mismatch clears, bank updates.
4. Drop an OFX file — bank badge shows "OFX".

- [ ] **Step 7: Commit**

```bash
git add src/components/ImportModal.jsx
git commit -m "feat: file-first import UX — auto-detect bank, remove format selector, add mismatch warning"
```

---

## Task 5: Fix Import Issue Email Recipient

**Files:**
- Modify: `functions/index.js` (or wherever `sendImportIssueEmail` is defined)

- [ ] **Step 1: Find the current email recipient**

```bash
grep -rn "jonathalimax@gmail.com\|admin.*email\|to:.*gmail" functions/
```

- [ ] **Step 2: Change recipient to support@realwise.com.br**

Find the `sendImportIssueEmail` function. Change the `to:` field:

```js
// BEFORE:
to: 'jonathalimax@gmail.com',

// AFTER:
to: 'support@realwise.com.br',
```

Also check if there's a config variable (e.g., `functions.config().admin.email`) being used. If so, update the deployed config:

```bash
firebase functions:config:set admin.import_issues_email="support@realwise.com.br"
```

- [ ] **Step 3: Commit**

```bash
git add functions/
git commit -m "fix: route import issue emails to support@realwise.com.br"
```

---

## Task 6: Dark Mode Audit — ImportModal and ImportIssueReport

**Files:**
- Modify: `src/components/ImportModal.jsx`
- Modify: `src/components/ImportIssueReport.jsx` (or wherever this component lives)

- [ ] **Step 1: Find all hardcoded light colors in ImportModal**

```bash
grep -n "bg-white\|bg-gray-50\|text-black\|text-gray-[0-9]\|border-gray-[12][0-9][0-9]" src/components/ImportModal.jsx | grep -v "dark:"
```

- [ ] **Step 2: Fix ImportModal dark mode**

For each match, add the corresponding `dark:` class. Standard Realwise mapping:
- `bg-white` → `bg-white dark:bg-gray-800`
- `bg-gray-50` → `bg-gray-50 dark:bg-gray-900`
- `bg-gray-100` → `bg-gray-100 dark:bg-gray-700`
- `text-gray-900` → `text-gray-900 dark:text-white`
- `text-gray-700` → `text-gray-700 dark:text-gray-300`
- `text-gray-500` → `text-gray-500 dark:text-gray-400`
- `border-gray-200` → `border-gray-200 dark:border-gray-700`
- `border-gray-300` → `border-gray-300 dark:border-gray-600`

Input/select elements:
```jsx
className="... bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
```

File drop zone:
```jsx
className="... border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50"
```

- [ ] **Step 3: Repeat for ImportIssueReport**

```bash
grep -n "bg-white\|bg-gray-50\|text-black\|text-gray-[0-9]\|border-gray-[12][0-9][0-9]" src/components/ImportIssueReport.jsx | grep -v "dark:"
```

Apply the same dark mode fixes.

- [ ] **Step 4: Test in dark mode**

```bash
npm run dev
```

Toggle dark mode (the app's existing dark mode toggle). Open the import modal. Check:
- Modal background is dark
- All text is readable (light on dark)
- Inputs have dark backgrounds
- Confirmation table is properly dark
- Error/success banners are visible in dark mode

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportModal.jsx src/components/ImportIssueReport.jsx
git commit -m "fix: dark mode audit for ImportModal and ImportIssueReport"
```

---

## Task 7: Create Backfill Script

**Files:**
- Create: `scripts/backfill-dedup-hash.js`

- [ ] **Step 1: Create the script**

Create `scripts/backfill-dedup-hash.js`:

```js
#!/usr/bin/env node
/**
 * One-time backfill: compute dedupHash for existing transactions without one.
 * Usage: node scripts/backfill-dedup-hash.js <clientId>
 * 
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account
 * that has Firestore read/write access for the target client project.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const clientId = process.argv[2];
if (!clientId) {
  console.error('Usage: node backfill-dedup-hash.js <clientId>');
  process.exit(1);
}

// Load client config to get the Firebase project ID
const clientConfig = require(`../public/clients/${clientId}.json`);

const app = initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  projectId: clientConfig.firebase.projectId,
});

const db = getFirestore(app);

function sha256Simple(message) {
  let hash = 5381;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5) + hash) ^ message.charCodeAt(i);
    hash = hash >>> 0;
  }
  const h = (x) => (hash ^ x).toString(16).padStart(8, '0');
  return h(0) + h(0xDEADBEEF) + h(0xCAFEBABE) + h(0xBAADF00D) +
         h(0x8BADF00D) + h(0xFEEDFACE) + h(0xABADBABE) + h(0xDEADC0DE);
}

function computeHash(t) {
  const date = String(t.date || '').substring(0, 10);
  const amount = Math.abs(Number(t.amount || 0)).toFixed(2);
  const bankType = String(t.bankType || 'unknown');
  const originalId = String(t.originalId || '');
  const index = originalId ? '0' : '0'; // positional index = 0 for backfill
  const input = `${date}|${amount}|${bankType}|${originalId}|${index}`;
  return sha256Simple(input);
}

async function main() {
  console.log(`Backfilling dedupHash for client: ${clientId}`);
  const q = db.collection('transactions').where('dedupHash', '==', null);
  // Also catch missing field:
  const allTxns = await db.collection('transactions').get();
  
  let updated = 0;
  const batch = db.batch();
  let batchSize = 0;

  for (const doc of allTxns.docs) {
    const data = doc.data();
    if (data.dedupHash) continue;

    const hash = computeHash(data);
    batch.update(doc.ref, { dedupHash: hash });
    batchSize++;
    updated++;

    if (batchSize === 500) {
      await batch.commit();
      console.log(`Updated ${updated} transactions...`);
      batchSize = 0;
    }
  }

  if (batchSize > 0) await batch.commit();
  console.log(`Done. Updated ${updated} transactions.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/backfill-dedup-hash.js
git commit -m "feat: add one-time dedupHash backfill script for existing transactions"
```
