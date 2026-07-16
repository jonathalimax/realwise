# Input UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish all input fields for consistency and mobile usability, improve the allocation slider, fix investment layer card layout, and add a contextual help system to every main page.

**Architecture:** Four independent areas — shared components first (PercentInput, PageHelp), then per-file audits, then slider and layout fixes. No business logic changes. All work goes on branch `feat/productization`.

**Tech Stack:** React 19, Tailwind CSS v4, react-number-format (already installed), no new dependencies.

---

## File Map

| File | Action |
|------|--------|
| `src/components/ui/PercentInput.jsx` | Create — shared percent input wrapping NumericFormat |
| `src/components/ui/PageHelp.jsx` | Create — floating ? FAB + bottom sheet help system |
| `src/components/ui/CurrencyInput.jsx` | Modify — minor: ensure value=0 never passes through |
| `src/pages/planner/AllocationTab.jsx` | Modify — replace native range with styled slider |
| `src/pages/planner/carteira/SublayerModal.jsx` | Modify — replace type="number" with NumericFormat/PercentInput, fix mobile |
| `src/pages/planner/InvestmentTab.jsx` | Modify — replace inline NumericFormat % fields with PercentInput |
| `src/pages/planner/RendaTab.jsx` | Modify — fix mobile overflow |
| `src/pages/planner/CarSimulatorTab.jsx` | Modify — replace type="number" with NumericFormat |
| `src/pages/planner/HouseSimulatorTab.jsx` | Modify — replace type="number" with NumericFormat |
| `src/pages/planner/carteira/LayerModal.jsx` | Modify — layer allocation list layout (stacked rows) |
| `src/pages/planner/PatrimonioTab.jsx` | Modify — input audit |
| `src/components/BillModal.jsx` | Modify — add CurrencyInput for amount, input audit |
| `src/components/TransactionForm.jsx` | Modify — input audit (already uses CurrencyInput) |
| `src/components/EditSingleTransactionModal.jsx` | Modify — input audit |
| `src/components/GoalsModal.jsx` | Modify — input audit |
| `src/components/CardsModal.jsx` | Modify — input audit |
| `src/components/InvestmentModal.jsx` | Modify — input audit |
| `src/components/SettingsModal.jsx` | Modify — email type already set, whatsapp inputMode |
| `src/pages/Dashboard.jsx` | Modify — add PageHelp |
| `src/pages/Transactions.jsx` | Modify — add PageHelp |
| `src/pages/Bills.jsx` | Modify — add PageHelp (above existing FAB) |
| `src/pages/Budget.jsx` | Modify — add PageHelp |
| `src/pages/Investments.jsx` | Modify — add PageHelp (above existing FAB) |
| `src/pages/Goals.jsx` | Modify — add PageHelp |
| `src/pages/planner/PlannerPage.jsx` | Modify — add PageHelp per active tab |

---

## Task 1: Create PercentInput shared component

**Files:**
- Create: `src/components/ui/PercentInput.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/ui/PercentInput.jsx
import { NumericFormat } from 'react-number-format';

export default function PercentInput({ value, onChange, className = '', decimalScale = 1, placeholder = '0 %', ...props }) {
  return (
    <NumericFormat
      value={value === 0 || value === undefined || value === null ? '' : value}
      onValueChange={(vals) => onChange(vals.floatValue ?? 0)}
      suffix=" %"
      decimalSeparator=","
      decimalScale={decimalScale}
      allowNegative={false}
      placeholder={placeholder}
      className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
        text-gray-900 dark:text-white placeholder-gray-400
        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
        transition-all duration-200 ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance
git add src/components/ui/PercentInput.jsx
git commit -m "feat: add PercentInput shared component"
```

---

## Task 2: Create PageHelp component

**Files:**
- Create: `src/components/ui/PageHelp.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/ui/PageHelp.jsx
import { useState } from 'react';

export default function PageHelp({ title, text, hasFab = false }) {
  const [open, setOpen] = useState(false);

  // hasFab=true → position above the + FAB (bottom-24), else bottom-6
  const fabPosition = hasFab ? 'bottom-24' : 'bottom-6';

  return (
    <>
      {/* Floating ? button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed ${fabPosition} right-6 z-40 w-10 h-10 rounded-full bg-gray-700 dark:bg-gray-600 border border-gray-600 dark:border-gray-500 text-gray-300 text-sm font-bold shadow-lg flex items-center justify-center hover:bg-gray-600 dark:hover:bg-gray-500 transition-colors`}
        aria-label="Como funciona"
      >
        ?
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl border-t border-gray-200 dark:border-gray-700 p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📖</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Como funciona</h3>
              {title && <span className="text-xs text-gray-400">— {title}</span>}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{text}</p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/PageHelp.jsx
git commit -m "feat: add PageHelp floating help component"
```

---

## Task 3: Improve allocation slider in AllocationTab

**Files:**
- Modify: `src/pages/planner/AllocationTab.jsx`

The current slider is a native `<input type="range">` with `accent-${c}-500`. Replace it with a styled wrapper that has a large thumb, gradient track, and drag hint label.

- [ ] **Step 1: Add slider CSS to index.css or as a style block**

Add these styles to `src/index.css` (or wherever global styles live — check for a `@layer` block):

```css
/* Styled range slider */
.styled-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 8px;
  border-radius: 9999px;
  outline: none;
  cursor: pointer;
}
.styled-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e2e8f0;
}
.styled-slider::-moz-range-thumb {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  cursor: grab;
  border: 2px solid #e2e8f0;
}
.styled-slider:active::-webkit-slider-thumb { cursor: grabbing; }
.styled-slider:active::-moz-range-thumb { cursor: grabbing; }
```

- [ ] **Step 2: Update the slider JSX inside the bucket cards map**

Find this block in `AllocationTab.jsx` (around line 168):
```jsx
<input
  type="range" min={0} max={100} step={1} value={pct}
  onChange={e => onChange(Number(e.target.value))}
  className={`w-full h-2 rounded-full appearance-none cursor-pointer accent-${c}-500`}
/>
```

Replace with:
```jsx
<div className="space-y-1">
  <input
    type="range" min={0} max={100} step={1} value={pct}
    onChange={e => onChange(Number(e.target.value))}
    style={{
      background: `linear-gradient(to right, var(--tw-gradient-from, #3b82f6) ${pct}%, #1e293b ${pct}%)`
    }}
    className="styled-slider w-full"
  />
  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 select-none px-1">
    <span>0%</span>
    <span className="opacity-60">← arraste →</span>
    <span>100%</span>
  </div>
</div>
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev` from the project root. Go to Planner → Alocação → Regra tab. Confirm:
- Slider thumb is large (32px), white circle
- Track fills from left to current value
- "← arraste →" label visible below
- Works on mobile viewport (DevTools)

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/pages/planner/AllocationTab.jsx
git commit -m "feat: improve allocation slider with styled thumb and drag hint"
```

---

## Task 4: Fix investment layer cards layout (Carteira tab)

**Files:**
- Modify: `src/pages/planner/carteira/LayerModal.jsx` (this file contains the layer allocation display in the Carteira tab — specifically the `WalletTab` component that renders the layer grid)

First check where the layer cards grid actually renders:

```bash
grep -rn "grid-cols-2\|layer.*card\|allocation.*layer" /Users/jonathalima/Developer/personal/limas-finance/src/pages/planner/carteira/ --include="*.jsx" | head -20
```

- [ ] **Step 1: Find the layer allocation grid**

Run:
```bash
grep -rn "grid-cols-2" /Users/jonathalima/Developer/personal/limas-finance/src/pages/planner/carteira/ --include="*.jsx"
```

This will identify the exact file and line rendering the side-by-side layer cards seen in Image #66.

- [ ] **Step 2: Replace grid-cols-2 with flex-col stacked rows**

Find the layer card grid (likely in `WalletTab.jsx` or similar). Replace the 2-column grid container:
```jsx
// BEFORE (2-col grid causing overflow)
<div className="grid grid-cols-2 gap-2">
  {layers.map(layer => (
    <div ...>
      <span>... layer.icon ...</span>
      <span className="truncate">... layer.label ...</span>
      <span>R$ {amount}</span>
      <input ... pct />
    </div>
  ))}
</div>
```

Replace with full-width stacked rows:
```jsx
<div className="flex flex-col gap-2">
  {layers.map(layer => (
    <div
      key={layer.id}
      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 gap-3"
      style={{ borderColor: layer.color }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg flex-shrink-0">{layer.icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{layer.label}</div>
          <div className="text-xs text-violet-500 dark:text-violet-400 font-medium tabular-nums">
            {formatBRL.format(layerMonthlyAmount(layer))}/mês
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <PercentInput
          value={layer.pct}
          onChange={v => onUpdateLayerPct(layer.id, v)}
          decimalScale={0}
          className="w-20 text-sm text-right"
          placeholder="0 %"
        />
        <button onClick={() => onEditLayer(layer)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-2">✎</button>
        <button onClick={() => onDeleteLayer(layer)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
      </div>
    </div>
  ))}
</div>
```

> Note: Adapt prop names (`layerMonthlyAmount`, `onUpdateLayerPct`, `onEditLayer`, `onDeleteLayer`) to match what the actual component uses — check the file first.

- [ ] **Step 3: Add PercentInput import to the file**

```jsx
import PercentInput from '@/components/ui/PercentInput';
```

- [ ] **Step 4: Verify in browser**

Go to Planner → Carteira. Check that layer rows are full-width, no overflow on long amounts, readable on mobile.

- [ ] **Step 5: Commit**

```bash
git add src/pages/planner/carteira/
git commit -m "feat: switch investment layer cards to full-width stacked rows"
```

---

## Task 5: Fix SublayerModal — replace type="number" inputs

**Files:**
- Modify: `src/pages/planner/carteira/SublayerModal.jsx`

Currently uses `<input type="number">` for returnPct, taxRate, pct, value, goalTarget — these show spinner arrows and don't format as BRL/percent.

- [ ] **Step 1: Add imports**

At top of file, add:
```jsx
import { NumericFormat } from 'react-number-format';
import CurrencyInput from '@/components/ui/CurrencyInput';
import PercentInput from '@/components/ui/PercentInput';
```

- [ ] **Step 2: Replace returnPct input** (currently `<input type="number" value={returnPct} ...>`)

```jsx
<NumericFormat
  value={returnPct === '0' || returnPct === '' ? '' : returnPct}
  onValueChange={vals => setReturnPct(String(vals.floatValue ?? 0))}
  decimalSeparator=","
  decimalScale={3}
  suffix=" %/mês"
  allowNegative={false}
  placeholder="1,000 %/mês"
  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
/>
```

- [ ] **Step 3: Replace taxRate input**

```jsx
<NumericFormat
  value={taxRate === '0' || taxRate === '' ? '' : taxRate}
  onValueChange={vals => setTaxRate(String(vals.floatValue ?? 0))}
  decimalSeparator=","
  decimalScale={0}
  suffix=" %"
  allowNegative={false}
  placeholder="15 %"
  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
/>
```

- [ ] **Step 4: Replace pct input (% da camada mode)**

```jsx
<NumericFormat
  value={pct === '0' || pct === '' ? '' : pct}
  onValueChange={vals => setPct(String(vals.floatValue ?? 0))}
  decimalSeparator=","
  decimalScale={0}
  suffix=" %"
  allowNegative={false}
  placeholder="0 %"
  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
/>
```

- [ ] **Step 5: Replace value input (Valor fixo mode) and goalTarget input with CurrencyInput**

For the `mode === 'value'` branch:
```jsx
<CurrencyInput
  value={parseFloat(value) || 0}
  onChange={v => setValue(String(v))}
  placeholder="R$ 500,00"
/>
```

For goalTarget:
```jsx
<CurrencyInput
  value={parseFloat(goalTarget) || 0}
  onChange={v => setGoalTarget(String(v))}
  placeholder="R$ 120.000,00"
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/planner/carteira/SublayerModal.jsx
git commit -m "fix: replace type=number inputs in SublayerModal with formatted inputs"
```

---

## Task 6: Input audit — planner tabs (Renda, Car, House, Investment, Patrimonio)

**Files:**
- Modify: `src/pages/planner/RendaTab.jsx`
- Modify: `src/pages/planner/CarSimulatorTab.jsx`
- Modify: `src/pages/planner/HouseSimulatorTab.jsx`
- Modify: `src/pages/planner/InvestmentTab.jsx`
- Modify: `src/pages/planner/PatrimonioTab.jsx`

- [ ] **Step 1: InvestmentTab — replace inline NumericFormat % fields with PercentInput**

In `InvestmentTab.jsx`, the `ClassRow` component has two NumericFormat fields (pct and returnPct). Replace them:

```jsx
import PercentInput from '@/components/ui/PercentInput';

// In ClassRow, replace the two NumericFormat fields:
// pct field:
<PercentInput
  value={cls.pct}
  onChange={v => onChange(index, 'pct', v)}
  decimalScale={0}
  placeholder="0 %"
  className="w-full text-sm"
/>

// returnPct field:
<PercentInput
  value={cls.returnPct}
  onChange={v => onChange(index, 'returnPct', v)}
  decimalScale={2}
  placeholder="0,00 %"
  className="w-full text-sm"
/>
```

Also replace the savings rows `returnPct` NumericFormat (around line 349):
```jsx
<PercentInput
  value={row.returnPct ?? 1.0}
  onChange={v => updateRow(row.id, 'returnPct', v)}
  decimalScale={2}
  placeholder="1,00 %"
  className="w-full text-sm text-right"
/>
```

- [ ] **Step 2: RendaTab — fix mobile overflow**

In `RendaTab.jsx`, find any flex row containing inputs and ensure `min-w-0` is on the input wrapper:

```jsx
// Find flex rows like:
<div className="flex items-center gap-2">
  <NumericFormat ... className="w-20 ..." />
  ...
</div>

// Ensure the parent has min-w-0 if it's inside a flex container:
<div className="flex items-center gap-2 min-w-0">
  <div className="min-w-0 flex-1">
    <NumericFormat ... className="w-full ..." />
  </div>
</div>
```

Read the file first: `cat src/pages/planner/RendaTab.jsx` — then apply `min-w-0` to any flex children that contain inputs.

- [ ] **Step 3: CarSimulatorTab — read file and replace type="number"**

Run:
```bash
cat /Users/jonathalima/Developer/personal/limas-finance/src/pages/planner/CarSimulatorTab.jsx
```

For each `<input type="number">` that represents a currency amount, replace with `<CurrencyInput>`. For percent fields, replace with `<PercentInput>`. Add imports at top:
```jsx
import CurrencyInput from '@/components/ui/CurrencyInput';
import PercentInput from '@/components/ui/PercentInput';
```

- [ ] **Step 4: HouseSimulatorTab — same audit as CarSimulatorTab**

```bash
cat /Users/jonathalima/Developer/personal/limas-finance/src/pages/planner/HouseSimulatorTab.jsx
```

Apply same pattern: `type="number"` → `CurrencyInput` or `PercentInput` based on field purpose.

- [ ] **Step 5: PatrimonioTab — read and audit**

```bash
cat /Users/jonathalima/Developer/personal/limas-finance/src/pages/planner/PatrimonioTab.jsx
```

Replace any bare `type="number"` inputs.

- [ ] **Step 6: Commit**

```bash
git add src/pages/planner/
git commit -m "fix: replace type=number inputs in planner tabs with formatted components"
```

---

## Task 7: Input audit — modals (Bills, Goals, Cards, Investments, EditTransaction, Settings)

**Files:**
- Modify: `src/components/BillModal.jsx`
- Modify: `src/components/GoalsModal.jsx`
- Modify: `src/components/CardsModal.jsx`
- Modify: `src/components/InvestmentModal.jsx`
- Modify: `src/components/EditSingleTransactionModal.jsx`
- Modify: `src/components/SettingsModal.jsx`

- [ ] **Step 1: Read each file and identify bare numeric inputs**

```bash
grep -n "type=\"number\"\|type=\"text\".*amount\|type=\"text\".*value" \
  /Users/jonathalima/Developer/personal/limas-finance/src/components/BillModal.jsx \
  /Users/jonathalima/Developer/personal/limas-finance/src/components/GoalsModal.jsx \
  /Users/jonathalima/Developer/personal/limas-finance/src/components/CardsModal.jsx \
  /Users/jonathalima/Developer/personal/limas-finance/src/components/InvestmentModal.jsx \
  /Users/jonathalima/Developer/personal/limas-finance/src/components/EditSingleTransactionModal.jsx
```

- [ ] **Step 2: BillModal — ensure amount field uses CurrencyInput**

BillModal has a `amount` field. If it uses `<input type="number">` or `<input type="text">` for the amount, replace with:
```jsx
import CurrencyInput from './ui/CurrencyInput';

// Replace amount input:
<CurrencyInput
  value={formData.amount || 0}
  onChange={v => setFormData(p => ({ ...p, amount: v }))}
  placeholder="R$ 0,00"
/>
```

- [ ] **Step 3: GoalsModal — ensure target and current amount fields use CurrencyInput**

GoalsModal already imports CurrencyInput. Verify both amount fields pass `value={0}` check — the component already handles `value === 0 → ''` so just ensure no zero default is hard-coded in state initial values.

Check state init:
```jsx
// BEFORE (may show 0 in field)
const [targetAmount, setTargetAmount] = useState(0);
// AFTER (use null/undefined so CurrencyInput shows placeholder)
const [targetAmount, setTargetAmount] = useState(null);
```

Then in the CurrencyInput call, pass `value={targetAmount ?? 0}`.

- [ ] **Step 4: CardsModal — read and audit**

```bash
cat /Users/jonathalima/Developer/personal/limas-finance/src/components/CardsModal.jsx | grep -A5 "type=\"number\"\|limit\|credit"
```

Replace any limit/credit amount fields with CurrencyInput.

- [ ] **Step 5: InvestmentModal — read and audit**

```bash
cat /Users/jonathalima/Developer/personal/limas-finance/src/components/InvestmentModal.jsx | grep -A5 "type=\"number\"\|amount\|return"
```

Replace currency fields with CurrencyInput, percent fields with PercentInput.

- [ ] **Step 6: EditSingleTransactionModal — read and audit**

```bash
cat /Users/jonathalima/Developer/personal/limas-finance/src/components/EditSingleTransactionModal.jsx | grep -A5 "type=\"number\"\|amount"
```

Replace amount field with CurrencyInput if not already.

- [ ] **Step 7: SettingsModal — add inputMode to WhatsApp/phone field**

In `SettingsModal.jsx`, find the WhatsApp number input (around line 432):
```jsx
// BEFORE
<input type="text" ... />
// AFTER — adds numeric keyboard on mobile
<input type="tel" inputMode="numeric" ... />
```

The email field (line ~574) already has `type="email"` — leave it.

- [ ] **Step 8: Fix mobile overflow — add min-w-0 to all modal form fields**

In every modal above, find flex containers holding inputs and add `min-w-0` to the input wrapper div:
```jsx
// Any pattern like:
<div className="flex gap-2">
  <input className="w-32 ..." />

// Becomes:
<div className="flex gap-2 min-w-0">
  <input className="w-full min-w-0 ..." />
```

- [ ] **Step 9: Commit**

```bash
git add src/components/BillModal.jsx src/components/GoalsModal.jsx src/components/CardsModal.jsx \
  src/components/InvestmentModal.jsx src/components/EditSingleTransactionModal.jsx src/components/SettingsModal.jsx
git commit -m "fix: input audit on modals — CurrencyInput, PercentInput, mobile overflow, semantic types"
```

---

## Task 8: Add PageHelp to all main pages

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Transactions.jsx`
- Modify: `src/pages/Bills.jsx`
- Modify: `src/pages/Budget.jsx`
- Modify: `src/pages/Investments.jsx`
- Modify: `src/pages/Goals.jsx`
- Modify: `src/pages/planner/PlannerPage.jsx`

- [ ] **Step 1: Dashboard.jsx — add PageHelp**

Dashboard already has a FAB menu at `fixed bottom-6 right-6`. Add PageHelp above it. In `Dashboard.jsx`:

```jsx
import PageHelp from '@/components/ui/PageHelp';

// Add just before the closing </> of the return:
<PageHelp
  title="Dashboard"
  text="Visão geral das suas finanças. Acompanhe saldo, receitas e despesas do mês selecionado. Use as setas para navegar entre os meses."
  hasFab={true}
/>
```

- [ ] **Step 2: Transactions.jsx — add PageHelp**

```jsx
import PageHelp from '@/components/ui/PageHelp';

// Add before closing tag:
<PageHelp
  title="Transações"
  text="Registre e filtre suas movimentações. Categorize cada transação para acompanhar onde seu dinheiro vai. Use o + para adicionar manualmente ou importe um extrato."
  hasFab={false}
/>
```

> Note: Check if Transactions has a + FAB — if yes, set `hasFab={true}`.

- [ ] **Step 3: Bills.jsx — add PageHelp above existing FAB**

Bills has a + FAB at `fixed bottom-6 right-6`. Set `hasFab={true}` so the ? sits at `bottom-24`.

```jsx
import PageHelp from '@/components/ui/PageHelp';

<PageHelp
  title="Contas"
  text="Controle suas contas a pagar. Marque como paga quando quitar e receba lembretes por e-mail antes do vencimento. Contas recorrentes se repetem automaticamente."
  hasFab={true}
/>
```

- [ ] **Step 4: Budget.jsx — add PageHelp**

```jsx
import PageHelp from '@/components/ui/PageHelp';

<PageHelp
  title="Orçamento"
  text="Defina limites de gasto por categoria. A barra mostra quanto você já usou do orçamento do mês. Quando chegar a 100%, você atingiu o limite definido."
  hasFab={false}
/>
```

- [ ] **Step 5: Investments.jsx — add PageHelp above existing FAB**

Investments has a + FAB. Set `hasFab={true}`.

```jsx
import PageHelp from '@/components/ui/PageHelp';

<PageHelp
  title="Investimentos"
  text="Acompanhe seus ativos reais. Registre o valor atual e o retorno de cada investimento. O total é atualizado conforme você adiciona ou edita ativos."
  hasFab={true}
/>
```

- [ ] **Step 6: Goals.jsx — add PageHelp**

```jsx
import PageHelp from '@/components/ui/PageHelp';

// Check if Goals has a + FAB and set hasFab accordingly
<PageHelp
  title="Objetivos"
  text="Defina metas financeiras e acompanhe o progresso. Vincule transações a um objetivo para registrar contribuições automaticamente."
  hasFab={true}
/>
```

- [ ] **Step 7: PlannerPage.jsx — add PageHelp per active tab**

Read `PlannerPage.jsx` to understand how tabs are managed (likely a `activeTab` state). Add PageHelp with tab-specific text:

```jsx
import PageHelp from '@/components/ui/PageHelp';

const PLANNER_HELP = {
  renda: 'Informe seu salário líquido. Ele é a base de todos os cálculos do planejador. Se tiver descontos em folha, ative o modo detalhado nas configurações.',
  alocacao: 'Defina a divisão ideal entre Necessidades, Poupança e Desejos. Arraste o controle para ajustar os percentuais. O total deve ser 100%.',
  carteira: 'Configure suas camadas de investimento e veja projeções de patrimônio ao longo do tempo. Cada camada representa um objetivo ou tipo de ativo.',
  investimento: 'Monte a carteira de investimentos livres e veja quanto ela pode crescer. Defina as classes de ativos e os percentuais de cada uma.',
  simulacoes: 'Simule cenários financeiros como compra de carro ou imóvel. Preencha os dados para ver prazos e impacto no seu orçamento.',
};

// Inside return, before closing tag:
<PageHelp
  title="Planejador"
  text={PLANNER_HELP[activeTab] ?? 'Use as abas para navegar entre as seções do planejador financeiro.'}
  hasFab={false}
/>
```

- [ ] **Step 8: Verify all pages in browser**

- Open each page and tap the ? button
- Confirm bottom sheet opens with correct text
- Confirm on pages with + FAB, the ? sits above it (not overlapping)
- Test on mobile viewport in DevTools

- [ ] **Step 9: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/Transactions.jsx src/pages/Bills.jsx \
  src/pages/Budget.jsx src/pages/Investments.jsx src/pages/Goals.jsx \
  src/pages/planner/PlannerPage.jsx
git commit -m "feat: add PageHelp contextual help to all main pages"
```

---

## Task 9: Final verification, push, and deploy

- [ ] **Step 1: Run lint**

```bash
cd /Users/jonathalima/Developer/personal/limas-finance
npm run lint
```

Fix any lint errors before proceeding.

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/
```

Expected: all tests pass (these are pure function tests — none touch the UI changes).

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: clean build, no type errors.

- [ ] **Step 4: Push to remote**

```bash
git push origin feat/productization
```

- [ ] **Step 5: Deploy to Firebase Hosting**

```bash
firebase deploy --only hosting
```

Expected: `Hosting URL: https://moneywise.web.app`

- [ ] **Step 6: Smoke test on production**

Open `https://mymoneywise.web.app/{clientId}/dashboard` on mobile and desktop. Verify:
- Money inputs show BRL format with placeholder, never start at 0
- Allocation sliders have large thumb and drag labels
- Investment layer rows are full-width, no overflow
- ? button appears on all main pages, opens help sheet
- ? is above + FAB on Investments, Bills, Dashboard

