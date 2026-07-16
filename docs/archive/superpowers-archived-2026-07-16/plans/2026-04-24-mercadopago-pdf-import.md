# Mercado Pago PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to import Mercado Pago credit card PDF statements (faturas) with password support, client-side parsing, and installment expansion.

**Architecture:** A lazy-loaded `pdfjs-dist` extracts text from the PDF in the browser; a new pure-function parser converts the raw text to the same transaction shape used by CSV parsers; `ImportModal` detects PDF encryption and shows a password field only when needed.

**Tech Stack:** `pdfjs-dist` (lazy dynamic import), React state, existing `detectInstallment` / `generateInstallmentTransactions` from `src/services/installments.js`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/services/importers/pdfLoader.js` | Lazy-load pdfjs-dist, decrypt, extract raw text |
| Create | `src/services/importers/bankParsers/mercadopagoPdf.js` | Parse raw text into transactions[] |
| Create | `src/services/importers/bankParsers/mercadopagoPdf.test.js` | Unit tests for parser |
| Modify | `src/services/importers/index.js` | Add `pdf` branch to `parseFile()`, extract shared categorization helper |
| Modify | `src/components/ImportModal.jsx` | Accept PDF, detect encryption, inline password field, loading label |

---

## Task 1: Install pdfjs-dist

**Files:**
- Run in: repo root (`limas-finance/`)

- [ ] **Step 1: Install the dependency**

```bash
npm install pdfjs-dist
```

Expected: `pdfjs-dist` appears in `package.json` dependencies.

- [ ] **Step 2: Verify it resolves**

```bash
node -e "require('pdfjs-dist/package.json')" && echo "OK"
```

Expected: `OK`

---

## Task 2: Create `pdfLoader.js`

**Files:**
- Create: `src/services/importers/pdfLoader.js`

Lazy-loads `pdfjs-dist` on first call. Exposes `extractPdfText(file, password?)` which returns `{ text: string, requiresPassword: boolean }`.

- [ ] **Step 1: Create the file**

```js
// src/services/importers/pdfLoader.js
let pdfjsLib = null;

async function getPdfjsLib() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
  return pdfjsLib;
}

/**
 * Extract all text from a PDF file.
 * Returns { text, requiresPassword }.
 * @param {File} file
 * @param {string} [password]
 * @returns {Promise<{ text: string, requiresPassword: boolean }>}
 */
export async function extractPdfText(file, password) {
  const lib = await getPdfjsLib();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = lib.getDocument({
    data: new Uint8Array(arrayBuffer),
    password: password || '',
  });

  let pdfDoc;
  try {
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    if (err.name === 'PasswordException') {
      return { text: '', requiresPassword: true };
    }
    throw err;
  }

  const pageTexts = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(' '));
  }

  return { text: pageTexts.join('\n'), requiresPassword: false };
}
```

- [ ] **Step 2: Verify the file was created**

```bash
head -3 src/services/importers/pdfLoader.js
```

Expected: first line is `// src/services/importers/pdfLoader.js`

---

## Task 3: Create `mercadopagoPdf.js` parser — test first

**Files:**
- Create: `src/services/importers/bankParsers/mercadopagoPdf.test.js`
- Create: `src/services/importers/bankParsers/mercadopagoPdf.js`

The parser receives the raw text string and returns `Transaction[]` matching the shape of existing CSV parsers.

- [ ] **Step 1: Write the failing test**

```js
// src/services/importers/bankParsers/mercadopagoPdf.test.js
import { describe, it, expect } from 'vitest';
import { parseMercadoPagoPdf } from './mercadopagoPdf';

const SAMPLE_TEXT = `
Jonatha Pereira Lima
Emitido em: 10/04/2026
Vence em
14/04/2026
Vencimento: 14/04/2026
Detalhes de consumo
Data Movimentações Valor em R$
10/03 Pagamento da fatura de março/2026 R$ 83,02
Data Movimentações Valor em R$
23/11 EC *7PRODUTOS Parcela 5 de 8 R$ 24,03
17/03 MERCADOLIVRE*2PRODUTOS R$ 236,16
21/03 MERCADOLIVRE*3PRODUTOS R$ 82,70
21/03 MERCADOLIVRE*3PRODUTOS Parcela 1 de 5 R$ 97,98
08/04 MERCADOLIVRE*2PRODUTOS R$ 61,50
Total R$ 502,37
`;

describe('parseMercadoPagoPdf', () => {
  it('skips payment rows', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    const hasPayment = txs.some((t) =>
      t.description.toLowerCase().includes('pagamento da fatura')
    );
    expect(hasPayment).toBe(false);
  });

  it('parses 5 purchase rows', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    expect(txs).toHaveLength(5);
  });

  it('all transactions are expenses', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    expect(txs.every((t) => t.type === 'expense')).toBe(true);
  });

  it('parses amount correctly', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    const ml = txs.find(
      (t) => t.description === 'MERCADOLIVRE*2PRODUTOS' && Math.abs(t.amount - 236.16) < 0.01
    );
    expect(ml).toBeTruthy();
  });

  it('infers same year when transaction month <= due month', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    const mar = txs.find(
      (t) => t.description === 'MERCADOLIVRE*2PRODUTOS' && Math.abs(t.amount - 236.16) < 0.01
    );
    expect(new Date(mar.date).getFullYear()).toBe(2026);
    expect(new Date(mar.date).getMonth()).toBe(2); // March = index 2
  });

  it('infers prior year when transaction month > due month', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    const nov = txs.find((t) => t.description.includes('EC *7PRODUTOS'));
    expect(new Date(nov.date).getFullYear()).toBe(2025);
    expect(new Date(nov.date).getMonth()).toBe(10); // November = index 10
  });

  it('preserves installment text in description', () => {
    const txs = parseMercadoPagoPdf(SAMPLE_TEXT);
    const installment = txs.find((t) => t.description.includes('Parcela 1 de 5'));
    expect(installment).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/importers/bankParsers/mercadopagoPdf.test.js
```

Expected: FAIL — `Cannot find module './mercadopagoPdf'`

- [ ] **Step 3: Implement the parser**

```js
// src/services/importers/bankParsers/mercadopagoPdf.js

/**
 * Parse Mercado Pago credit card PDF (fatura) raw text.
 * @param {string} text - Full text from extractPdfText()
 * @returns {Array<{date: string, amount: number, type: string, description: string, originalId: string}>}
 */
export function parseMercadoPagoPdf(text) {
  const dueDate = extractDueDate(text);
  const rows = extractTransactionRows(text);

  return rows
    .filter((row) => !row.description.toLowerCase().startsWith('pagamento da fatura'))
    .map((row) => ({
      date: inferDate(row.day, row.month, dueDate),
      amount: row.amount,
      type: 'expense',
      description: row.description,
      originalId: '',
    }));
}

function extractDueDate(text) {
  const match = text.match(/(?:Vence em|Vencimento:)\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
  return { month: parseInt(match[2], 10), year: parseInt(match[3], 10) };
}

// Matches: "17/03 SOME DESCRIPTION R$ 1.234,56"
const ROW_PATTERN = /(\d{2})\/(\d{2})\s+(.+?)\s+R\$\s*([\d.,]+)/g;

function extractTransactionRows(text) {
  const rows = [];
  for (const match of text.matchAll(ROW_PATTERN)) {
    const amount = parseBrazilianNumber(match[4]);
    if (amount <= 0) continue;
    rows.push({
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      description: match[3].trim(),
      amount,
    });
  }
  return rows;
}

function inferDate(day, month, dueDate) {
  const year = month > dueDate.month ? dueDate.year - 1 : dueDate.year;
  return new Date(year, month - 1, day).toISOString();
}

function parseBrazilianNumber(str) {
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/importers/bankParsers/mercadopagoPdf.test.js
```

Expected: all 7 tests PASS

---

## Task 4: Wire PDF branch into `parseFile()` in `index.js`

**Files:**
- Modify: `src/services/importers/index.js`

- [ ] **Step 1: Add imports at the top of `index.js`**

After the existing import block, add:

```js
import { parseMercadoPagoPdf } from './bankParsers/mercadopagoPdf';
import { extractPdfText } from './pdfLoader';
```

- [ ] **Step 2: Extract the shared categorization + installment + AI pipeline into a private function**

The inline block after the bank-type `switch` in `parseFile()` (from `let userRules = []` down to the final `return processedTransactions`) is currently duplicated nowhere, but the PDF path needs it too. Cut it out and place it as a named helper at the bottom of the file:

```js
async function categorizeParsedTransactions(transactions, userId, options) {
  const { apiKey, categories: availableCategories } = options;

  let userRules = [];
  if (userId) {
    try {
      userRules = await loadUserCategorizationRules(userId);
    } catch (err) {
      console.error('Error loading user categorization rules:', err);
    }
  }

  const processedTransactions = [];
  const uncategorizedTransactions = [];
  const processedInstallmentGroups = new Set();

  for (const t of transactions) {
    const categorization = categorizeTransaction(t.description, userRules);
    const installmentInfo = detectInstallment(t.description);

    const isUncategorized =
      !categorization ||
      categorization.category === 'Diversos' ||
      categorization.category === 'Other' ||
      categorization.category === 'Outros';

    const baseTransaction = {
      ...t,
      category: categorization?.category || 'Sem categoria',
      type: t.type || categorization?.type,
      autoCategory: !!categorization && !isUncategorized,
      isUserRule: categorization?.isUserRule || false,
      needsAI: isUncategorized,
      hash: generateTransactionHash(t),
    };

    if (installmentInfo) {
      const groupId = generateInstallmentGroupId(baseTransaction);
      if (processedInstallmentGroups.has(groupId)) continue;
      processedInstallmentGroups.add(groupId);
      baseTransaction.installmentGroupId = groupId;
      const installmentTransactions = generateInstallmentTransactions(
        baseTransaction,
        installmentInfo.current,
        installmentInfo.total
      );
      installmentTransactions.forEach((installment, index) => {
        installment.hash = generateTransactionHash(installment);
        installment.autoGenerated = index > 0;
        if (index === 0 && isUncategorized) uncategorizedTransactions.push(installment);
        processedTransactions.push(installment);
      });
    } else {
      if (isUncategorized) uncategorizedTransactions.push(baseTransaction);
      processedTransactions.push(baseTransaction);
    }
  }

  if (apiKey && uncategorizedTransactions.length > 0 && availableCategories) {
    try {
      const aiResults = await batchCategorizeWithAI(uncategorizedTransactions, {
        categories: availableCategories,
        userId,
        apiKey,
        fallbackFn: null,
      });
      processedTransactions.forEach((t) => {
        if (t.needsAI && aiResults.has(t.description)) {
          const r = aiResults.get(t.description);
          t.category = r.category;
          t.autoCategory = true;
          t.aiCategorized = r.source === 'ai' || r.source === 'cache';
          t.categoryConfidence = r.confidence;
        }
        delete t.needsAI;
      });
      const installmentGroups = {};
      processedTransactions.forEach((t) => {
        if (t.installmentGroupId && t.aiCategorized)
          installmentGroups[t.installmentGroupId] = t.category;
      });
      processedTransactions.forEach((t) => {
        if (t.installmentGroupId && installmentGroups[t.installmentGroupId] && !t.aiCategorized) {
          t.category = installmentGroups[t.installmentGroupId];
          t.autoCategory = true;
        }
      });
    } catch (err) {
      console.error('AI categorization failed:', err);
    }
  }

  processedTransactions.forEach((t) => {
    delete t.needsAI;
    let catSource;
    if (t.aiCategorized) catSource = 'ai';
    else if (t.isUserRule) catSource = 'user_rule';
    else if (t.autoCategory) catSource = 'default_rule';
    else catSource = null;
    t.metadata = {
      catSource,
      catConfidence: catSource === 'ai' ? (t.categoryConfidence ?? null) : null,
      isCorrected: false,
      originalCategory: t.category ?? null,
    };
  });

  return processedTransactions;
}
```

Then in the existing CSV/Excel path, replace the entire inline pipeline block with:

```js
return await categorizeParsedTransactions(transactions, userId, options);
```

- [ ] **Step 3: Add the PDF branch to the file-extension check**

Find:
```js
if (fileExtension === 'csv') {
  data = await parseCSV(file);
} else if (['xlsx', 'xls'].includes(fileExtension)) {
  data = await parseExcel(file);
} else {
  throw new Error('Unsupported file format. Please use CSV or Excel files.');
}
```

Replace with:
```js
if (fileExtension === 'csv') {
  data = await parseCSV(file);
} else if (['xlsx', 'xls'].includes(fileExtension)) {
  data = await parseExcel(file);
} else if (fileExtension === 'pdf') {
  const { text, requiresPassword } = await extractPdfText(file, options.pdfPassword);
  if (requiresPassword) {
    const err = new Error('PDF_PASSWORD_REQUIRED');
    err.code = 'PDF_PASSWORD_REQUIRED';
    throw err;
  }
  const transactions = parseMercadoPagoPdf(text);
  return await categorizeParsedTransactions(transactions, userId, options);
} else {
  throw new Error('Unsupported file format. Please use CSV, Excel, or PDF files.');
}
```

Note: the PDF branch returns early — `data` and the bank-type switch below it are only reached for CSV/Excel.

- [ ] **Step 4: Verify build compiles**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors

---

## Task 5: Update `ImportModal.jsx`

**Files:**
- Modify: `src/components/ImportModal.jsx`

- [ ] **Step 1: Add state for PDF password**

In the `useState` declarations block near the top of the component, add:

```js
const [pdfPassword, setPdfPassword] = useState('');
const [requiresPdfPassword, setRequiresPdfPassword] = useState(false);
```

- [ ] **Step 2: Reset PDF state on file change**

In `handleFileSelect` (around line 364), after `setFile(selectedFile)` and `setError('')`, add:

```js
setPdfPassword('');
setRequiresPdfPassword(false);
```

Also add the same two lines inside the `onClick` of the remove-file button (the one that calls `setFile(null)`).

- [ ] **Step 3: Pass `pdfPassword` to `parseFile()` and handle the password error**

In `handleParse()`, update the `aiOptions` object:

```js
const aiOptions = geminiApiKey ? {
  apiKey: geminiApiKey,
  categories: categories,
} : {};

if (pdfPassword) aiOptions.pdfPassword = pdfPassword;
```

And in the `catch` block of `handleParse()`, add before the generic `setError`:

```js
} catch (err) {
  if (err.code === 'PDF_PASSWORD_REQUIRED') {
    setRequiresPdfPassword(true);
    setLoading(false);
    return;
  }
  setError(err.message || 'Erro ao processar o arquivo.');
  setLoading(false);
}
```

- [ ] **Step 4: Update file input to accept PDF, update helper text**

Find (line ~1049):
```jsx
accept=".csv,.xlsx,.xls"
```
Replace with:
```jsx
accept=".csv,.xlsx,.xls,.pdf"
```

Find the nearby helper text `CSV, XLS, XLSX` (line ~1045) and change to:
```
CSV, XLS, XLSX, PDF
```

- [ ] **Step 5: Add inline password field after the file picker block**

After the closing `</div>` of the green file-selected block (around line 1031, the one ending with the remove button), add:

```jsx
{requiresPdfPassword && (
  <div className="mt-3 flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {language === 'pt' ? 'Senha do PDF' : 'PDF Password'}
    </label>
    <input
      type="password"
      value={pdfPassword}
      onChange={(e) => setPdfPassword(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleParse()}
      placeholder={language === 'pt' ? 'Digite a senha...' : 'Enter password...'}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      autoFocus
    />
  </div>
)}
```

- [ ] **Step 6: Update the loading label for PDFs**

Find the loading spinner label in the JSX (search for `Processando` or similar). Add a PDF-specific label:

```jsx
{file?.name?.toLowerCase().endsWith('.pdf') ? (language === 'pt' ? 'Lendo PDF...' : 'Reading PDF...') : (language === 'pt' ? 'Processando...' : 'Processing...')}
```

Replace whatever static string currently appears there with the above expression.

- [ ] **Step 7: Test in dev server**

```bash
npm run dev
```

1. Open the import modal
2. Select `Fatura_MP_20260414.pdf` — no password field should appear yet
3. Click Import — password field should now appear inline below the file name
4. Type `05616` and press Enter — transactions list should load
5. Confirm "Pagamento da fatura" row is absent
6. Confirm installment rows like `EC *7PRODUTOS Parcela 5 de 8` are expanded into multiple transactions

---

## Task 6: Lint check

- [ ] **Step 1: Run linter**

```bash
npm run lint
```

Expected: no new errors.
