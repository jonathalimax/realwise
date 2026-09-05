# Planner: Firestore Persistence + Default Values + Sistema Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage with Firestore persistence for the planner, update DEFAULT_STATE values to match the user's financial plan, and add a new "Sistema Financeiro" overview tab.

**Architecture:** `usePlannerState` is converted to use Firestore (`planner/{ownerId}`) as the source of truth, showing `DEFAULT_STATE` instantly on mount while Firestore loads, then hydrating. A new `SistemaTab` component renders the complete financial system overview with live cash flow data from the already-computed state. The existing tab structure in `PlannerPage` gains a "Sistema" tab at position 0.

**Tech Stack:** React 19, Firebase Firestore (`doc`, `getDoc`, `setDoc`), Tailwind CSS v4, existing `useAccess` hook for `ownerId`, existing `Shimmer` component.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `firestore.rules` | Modify | Add `planner/{userId}` security rule |
| `src/pages/planner/usePlannerState.js` | Modify | Replace localStorage with Firestore; update DEFAULT_STATE; export `isLoading` |
| `src/pages/planner/PlannerPage.jsx` | Modify | Consume `isLoading` for shimmer; add Sistema tab; reorder tabs |
| `src/pages/planner/SistemaTab.jsx` | Create | Read-only overview: layers, live cash flow, allocation vs target, golden rules, next steps |

---

## Task 1: Add Firestore security rule for planner

**Files:**
- Modify: `firestore.rules:56-59` (after the settings rule, same pattern)

- [ ] **Step 1: Open `firestore.rules` and add the planner rule**

Find the existing `settings` rule block (around line 56):
```
match /settings/{userId} {
  allow read: if request.auth != null && canReadData(userId);
  allow write: if request.auth != null && canWriteData(userId);
}
```

Add the following block directly after it:
```
// Planner collection - personal financial plan, scoped by userId
match /planner/{userId} {
  allow read: if request.auth != null && canReadData(userId);
  allow write: if request.auth != null && canWriteData(userId);
}
```

- [ ] **Step 2: Verify the file is valid by running lint**

```bash
npm run lint
```
Expected: no errors. If there are errors, they are unrelated to this change (the rules file is not linted by ESLint).

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rule for planner collection"
```

---

## Task 2: Migrate usePlannerState to Firestore + update DEFAULT_STATE

**Files:**
- Modify: `src/pages/planner/usePlannerState.js`

This is a full replacement of the persistence layer. All computed logic (`useMemo` blocks) stays unchanged — only the load/save mechanism and DEFAULT_STATE values change.

- [ ] **Step 1: Replace the entire file content**

Replace `src/pages/planner/usePlannerState.js` with:

```js
import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAccess } from '@/contexts/AccessContext';

export function countWeekdays(year, month) {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

const DEFAULT_STATE = {
  // Tab 1 - Dashboard
  rendaBruta: 10000,
  selectedPlannerMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  useMinScenario: true,
  simplesNacionalPct: 6,
  planoSaude: 300,
  contabilidade: 150,
  internet: 50,
  dizimoPct: 11,

  // Tab 2 - Allocation (64/28/8)
  necessidades: 64,
  poupanca: 28,
  desejos: 8,
  allocationOverrides: {},

  // USD Calculator
  hourlyRate: 25,
  hoursPerDay: 8,
  usdToBrl: 5.70,
  platformFeePct: 0.5,

  // Car Simulator
  carMonthlyPayment: 2111.30,
  carRemainingMonths: 52,
  carMonthlyRate: 3.9,
  carLastParcelasCount: 2,
  carInitialBoleto: 1600.28,

  // House Simulator
  propertyPrice: 900000,
  downPaymentPercent: 40,
  phase1MonthlySaving: 1791.05,
  phase2MonthlySaving: 3605.35,
  cdbMonthlyRate: 1.0,

  // Mortgage simulation
  mortgageAnnualRate: 11,
  mortgageTermYears: 30,

  // Savings & Reserves
  savingsRows: [
    { id: 'emergencia',    label: 'Fundo de Emergência',     phase1: 2070.84, phase2: 2070.84, tipo: 'Prioridade máxima',        onde: 'AstroPay 115% CDI',          returnPct: 1.0 },
    { id: 'aposentadoria', label: 'Aposentadoria',            phase1: 500,     phase2: 800,     tipo: 'Não pausar — renda futura', onde: 'Tesouro IPCA+ / FIIs',       returnPct: 0.9 },
    { id: 'casa',          label: 'Meta Entrada Casa',        phase1: 1757.58, phase2: 3000,    tipo: 'Meta 3 anos',               onde: 'CDB separado 115% CDI',      returnPct: 1.0 },
    { id: 'mae',           label: 'Reserva Mãe',              phase1: 500,     phase2: 500,     tipo: 'Fixo mensal',               onde: 'AstroPay / CDB liq. diária', returnPct: 1.0 },
    { id: 'manutencao',    label: 'Reserva Manutenção Carro', phase1: 250,     phase2: 250,     tipo: '÷12 do orçamento anual',    onde: 'CDB liquidez diária',        returnPct: 1.0 },
    { id: 'ipva',          label: 'Reserva IPVA',             phase1: 166.67,  phase2: 166.67,  tipo: '÷12',                       onde: 'CDB liquidez diária',        returnPct: 1.0 },
    { id: 'matricula',     label: 'Reserva Matrícula',        phase1: 83.33,   phase2: 83.33,   tipo: '÷12',                       onde: 'CDB liquidez diária',        returnPct: 1.0 },
    { id: 'filhos',        label: 'Filhos (Educação)',        phase1: 1500,    phase2: 2000,    tipo: 'Meta R$ 600k–1.2M',         onde: 'ETFs 70% / Renda Fixa 30%',  returnPct: 0.9 },
  ],

  // Planner start date (for month markers)
  plannerStartDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,

  // Patrimônio
  carCurrentValue: 60000,
  propertyAppreciationPct: 0.5,

  // Investment classes — aligned with financial plan (35/30/15/15/5)
  investmentClasses: [
    { name: 'Renda Fixa (CDB/Tesouro)', pct: 35, returnPct: 1.0, vehicle: 'Tesouro Selic / CDB 115% CDI' },
    { name: 'Exterior ETFs',            pct: 30, returnPct: 1.0, vehicle: 'IVVB11 (S&P 500)' },
    { name: 'FIIs',                     pct: 15, returnPct: 0.8, vehicle: 'MXRF11, HGLG11' },
    { name: 'Ações Dividendos',         pct: 15, returnPct: 0.7, vehicle: 'ITUB4, BBAS3' },
    { name: 'Cripto',                   pct:  5, returnPct: 1.5, vehicle: 'BTC 70% + ETH' },
  ],
};

function migrateState(saved) {
  const merged = { ...DEFAULT_STATE, ...saved };

  // Ensure all default savingsRows exist (handles new rows added to DEFAULT_STATE)
  const existingIds = new Set(merged.savingsRows.map(r => r.id));
  DEFAULT_STATE.savingsRows.forEach(defRow => {
    if (!existingIds.has(defRow.id)) {
      merged.savingsRows.push({ ...defRow });
    }
  });

  // Ensure returnPct is present on all rows
  merged.savingsRows = merged.savingsRows.map(row => {
    const def = DEFAULT_STATE.savingsRows.find(d => d.id === row.id);
    return { returnPct: def?.returnPct ?? 1.0, ...row };
  });

  return merged;
}

export const formatBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function usePlannerState() {
  const { ownerId } = useAccess();
  const [state, setState] = useState(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const debounceRef = useRef(null);

  // ── Load from Firestore on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!ownerId) return;
    const plannerRef = doc(db, 'planner', ownerId);
    getDoc(plannerRef)
      .then(snap => {
        if (snap.exists()) {
          setState(migrateState(snap.data()));
        }
        hasLoadedRef.current = true;
        setIsLoading(false);
      })
      .catch(() => {
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
  }, [ownerId]);

  // ── Debounced save to Firestore on every state change ─────────────────────
  useEffect(() => {
    if (!ownerId || !hasLoadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const plannerRef = doc(db, 'planner', ownerId);
      setDoc(plannerRef, state).catch(() => {});
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, ownerId]);

  const update = (key, value) => setState(prev => ({ ...prev, [key]: value }));

  const updateMonthAllocation = (field, value) => {
    const current = state.allocationOverrides?.[state.selectedPlannerMonth] ?? {
      necessidades: state.necessidades,
      poupanca: state.poupanca,
      desejos: state.desejos,
    };
    update('allocationOverrides', {
      ...state.allocationOverrides,
      [state.selectedPlannerMonth]: { ...current, [field]: value },
    });
  };

  const resetMonthAllocation = () => {
    const overrides = { ...state.allocationOverrides };
    delete overrides[state.selectedPlannerMonth];
    update('allocationOverrides', overrides);
  };

  // ── Income from USD params for selected month ────────────────────────────
  const selectedMonthIncome = useMemo(() => {
    const [y, m] = state.selectedPlannerMonth.split('-').map(Number);
    const bDays = countWeekdays(y, m);
    const grossUSD = state.hourlyRate * state.hoursPerDay * bDays;
    const netUSD = grossUSD * (1 - state.platformFeePct / 100);
    return { grossUSD, netUSD, netBRL: netUSD * state.usdToBrl, bDays };
  }, [state.selectedPlannerMonth, state.hourlyRate, state.hoursPerDay, state.usdToBrl, state.platformFeePct]);

  // ── Year min/max income (current year, 12 months) ───────────────────────
  const yearIncomeStats = useMemo(() => {
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
      const bDays = countWeekdays(year, i + 1);
      const netBRL = state.hourlyRate * state.hoursPerDay * bDays * (1 - state.platformFeePct / 100) * state.usdToBrl;
      return { month: i + 1, year, netBRL, bDays };
    });
    const sorted = [...months].sort((a, b) => a.netBRL - b.netBRL);
    return { months, minMonth: sorted[0], maxMonth: sorted[sorted.length - 1] };
  }, [state.hourlyRate, state.hoursPerDay, state.usdToBrl, state.platformFeePct]);

  // ── Active income ────────────────────────────────────────────────────────
  const computedRendaBruta = useMemo(() => {
    return state.useMinScenario ? yearIncomeStats.minMonth.netBRL : selectedMonthIncome.netBRL;
  }, [state.useMinScenario, yearIncomeStats, selectedMonthIncome]);

  // ── Dashboard computed ──────────────────────────────────────────────────
  const simplesValue = useMemo(
    () => computedRendaBruta * state.simplesNacionalPct / 100,
    [computedRendaBruta, state.simplesNacionalPct]
  );

  const despesasPJ = useMemo(
    () => state.planoSaude + state.contabilidade + state.internet,
    [state.planoSaude, state.contabilidade, state.internet]
  );

  const dizimoBase = useMemo(
    () => computedRendaBruta - simplesValue - despesasPJ,
    [computedRendaBruta, simplesValue, despesasPJ]
  );

  const dizimoValue = useMemo(
    () => dizimoBase * state.dizimoPct / 100,
    [dizimoBase, state.dizimoPct]
  );

  const liquidezFinal = useMemo(
    () => dizimoBase - dizimoValue,
    [dizimoBase, dizimoValue]
  );

  // ── Per-month allocation (overrides or global defaults) ─────────────────
  const monthAllocation = useMemo(() => {
    const override = state.allocationOverrides?.[state.selectedPlannerMonth];
    return {
      necessidades: override?.necessidades ?? state.necessidades,
      poupanca: override?.poupanca ?? state.poupanca,
      desejos: override?.desejos ?? state.desejos,
    };
  }, [state.allocationOverrides, state.selectedPlannerMonth, state.necessidades, state.poupanca, state.desejos]);

  // ── Allocation computed ─────────────────────────────────────────────────
  const necessidadesValue = useMemo(
    () => liquidezFinal * monthAllocation.necessidades / 100,
    [liquidezFinal, monthAllocation.necessidades]
  );

  const poupancaValue = useMemo(
    () => liquidezFinal * monthAllocation.poupanca / 100,
    [liquidezFinal, monthAllocation.poupanca]
  );

  const desejosValue = useMemo(
    () => liquidezFinal * monthAllocation.desejos / 100,
    [liquidezFinal, monthAllocation.desejos]
  );

  // ── Car simulation ──────────────────────────────────────────────────────
  const carSimulationRows = useMemo(() => {
    const { carMonthlyPayment, carRemainingMonths, carMonthlyRate, carLastParcelasCount, carInitialBoleto } = state;
    const rate = carMonthlyRate / 100;
    let remaining = carRemainingMonths;
    const rows = [];
    const maxIterations = 240;
    let month = 1;

    while (remaining > 1 + 1 && month <= maxIterations) {
      const fullBoleto = carInitialBoleto * Math.pow(1 + rate, month - 1);
      const isBoletoAlto = fullBoleto > carMonthlyPayment;
      const effectiveParcelas = isBoletoAlto ? 1 : carLastParcelasCount;
      const boleto = isBoletoAlto
        ? (carInitialBoleto / carLastParcelasCount) * Math.pow(1 + rate, month - 1)
        : fullBoleto;
      const total = carMonthlyPayment + boleto;
      remaining -= (1 + effectiveParcelas);
      rows.push({ month, parcela: carMonthlyPayment, boleto, total, remaining: Math.max(0, remaining), isBoletoAlto, effectiveParcelas });
      month++;
    }
    return rows;
  }, [state.carMonthlyPayment, state.carRemainingMonths, state.carMonthlyRate, state.carLastParcelasCount, state.carInitialBoleto]);

  // ── House simulation ────────────────────────────────────────────────────
  const houseSimulationRows = useMemo(() => {
    const { propertyPrice, downPaymentPercent, cdbMonthlyRate, savingsRows } = state;
    const casaRow = savingsRows.find(r => r.id === 'casa');
    const phase1MonthlySaving = casaRow ? casaRow.phase1 : 0;
    const phase2MonthlySaving = casaRow ? casaRow.phase2 : 0;
    const downPaymentTarget = propertyPrice * downPaymentPercent / 100;
    const phase1Duration = carSimulationRows.length;
    const rows = [];
    let balance = 0;
    let month = 1;

    while (balance < downPaymentTarget && month <= 360) {
      const contribution = month <= phase1Duration ? phase1MonthlySaving : phase2MonthlySaving;
      balance += contribution;
      const cdbYield = balance * cdbMonthlyRate / 100;
      balance += cdbYield;
      const pct = Math.min((balance / downPaymentTarget) * 100, 100);
      const phase = month <= phase1Duration ? 1 : 2;
      const isPhaseChange = month === phase1Duration + 1;
      rows.push({ month, phase, contribution, cdbYield, balance, pct, isPhaseChange });
      if (balance >= downPaymentTarget) break;
      month++;
    }
    return { rows, downPaymentTarget };
  }, [state.propertyPrice, state.downPaymentPercent, state.savingsRows, state.cdbMonthlyRate, carSimulationRows.length]);

  // ── Savings computed ───────────────────────────────────────────────────
  const savingsComputed = useMemo(() => {
    const { savingsRows, carInitialBoleto, carMonthlyPayment } = state;
    const poupancaPhase1 = poupancaValue;
    const poupancaPhase2 = poupancaValue + carMonthlyPayment;
    const fixedPhase1 = savingsRows.reduce((a, r) => a + r.phase1, 0) + carInitialBoleto;
    const fixedPhase2 = savingsRows.reduce((a, r) => a + r.phase2, 0);
    const livresPhase1 = poupancaPhase1 - fixedPhase1;
    const livresPhase2 = poupancaPhase2 - fixedPhase2;
    return { poupancaPhase1, poupancaPhase2, livresPhase1, livresPhase2 };
  }, [state.savingsRows, state.carInitialBoleto, state.carMonthlyPayment, poupancaValue]);

  // ── Investment projections ──────────────────────────────────────────────
  const investmentProjections = useMemo(() => {
    const PMT = savingsComputed.livresPhase2;
    const weightedMonthlyReturn = state.investmentClasses.reduce((acc, cls) => {
      return acc + (cls.pct / 100) * (cls.returnPct / 100);
    }, 0);
    return [5, 10, 15, 20].map(years => {
      const n = years * 12;
      const r = weightedMonthlyReturn;
      const FV = r > 0 ? PMT * (Math.pow(1 + r, n) - 1) / r : PMT * n;
      const annualEquivalent = (Math.pow(1 + r, 12) - 1) * 100;
      return { years, FV, annualEquivalent };
    });
  }, [savingsComputed.livresPhase2, state.investmentClasses]);

  // ── Per-row savings FV projections ─────────────────────────────────────
  const savingsRowsFV = useMemo(() => state.savingsRows.map(row => {
    const r = (row.returnPct ?? 1.0) / 100;
    const PMT = row.phase2;
    return {
      id: row.id,
      label: row.label,
      projections: [5, 10, 15, 20, 25, 30].map(years => {
        const n = years * 12;
        const FV = r > 0 ? PMT * (Math.pow(1 + r, n) - 1) / r : PMT * n;
        return { years, FV };
      }),
    };
  }), [state.savingsRows]);

  // ── Total patrimônio projection ─────────────────────────────────────────
  const totalPatrimonio = useMemo(() => {
    return [5, 10, 15, 20, 25, 30].map(years => {
      const n = years * 12;
      const weightedR = state.investmentClasses.reduce(
        (acc, cls) => acc + (cls.pct / 100) * (cls.returnPct / 100), 0
      );
      const PMT_livres = savingsComputed.livresPhase2;
      const livresFV = weightedR > 0 ? PMT_livres * (Math.pow(1 + weightedR, n) - 1) / weightedR : PMT_livres * n;
      const reservasFV = state.savingsRows.reduce((sum, row) => {
        const r = (row.returnPct ?? 1.0) / 100;
        const FV = r > 0 ? row.phase2 * (Math.pow(1 + r, n) - 1) / r : row.phase2 * n;
        return sum + FV;
      }, 0);
      const apoRow = state.savingsRows.find(r => r.id === 'aposentadoria');
      const apoFV = (() => {
        if (!apoRow) return 0;
        const r = (apoRow.returnPct ?? 0.9) / 100;
        return r > 0 ? apoRow.phase2 * (Math.pow(1 + r, n) - 1) / r : apoRow.phase2 * n;
      })();
      const carMonthlyDep = Math.pow(1 - 0.15, 1 / 12) - 1;
      const carroFV = Math.max(0, state.carCurrentValue * Math.pow(1 + carMonthlyDep, n));
      const dpMonths = houseSimulationRows.rows.length;
      const r = state.propertyAppreciationPct / 100;
      const imovelFV = n >= dpMonths ? state.propertyPrice * Math.pow(1 + r, n - dpMonths) : 0;
      return { years, livresFV, reservasFV, apoFV, carroFV, imovelFV, total: livresFV + reservasFV + carroFV + imovelFV };
    });
  }, [state.savingsRows, state.investmentClasses, state.carCurrentValue, state.propertyPrice, state.propertyAppreciationPct, savingsComputed.livresPhase2, houseSimulationRows.rows.length]);

  // ── Current plan month ───────────────────────────────────────────────────
  const currentPlanMonth = useMemo(() => {
    const [sy, sm] = state.plannerStartDate.split('-').map(Number);
    const now = new Date();
    const diff = (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm);
    return Math.max(1, diff + 1);
  }, [state.plannerStartDate]);

  // ── Selected month offset ────────────────────────────────────────────────
  const selectedMonthOffset = useMemo(() => {
    const [sy, sm] = state.plannerStartDate.split('-').map(Number);
    const [ty, tm] = state.selectedPlannerMonth.split('-').map(Number);
    return Math.max(1, (ty - sy) * 12 + (tm - sm) + 1);
  }, [state.plannerStartDate, state.selectedPlannerMonth]);

  // ── Phase detection for selected month ──────────────────────────────────
  const isPhase2ForSelectedMonth = useMemo(() => {
    return selectedMonthOffset > carSimulationRows.length;
  }, [selectedMonthOffset, carSimulationRows.length]);

  return {
    state,
    update,
    setState,
    isLoading,
    // Dashboard
    simplesValue,
    despesasPJ,
    dizimoBase,
    dizimoValue,
    liquidezFinal,
    // Allocation
    necessidadesValue,
    poupancaValue,
    desejosValue,
    // Simulations
    carSimulationRows,
    houseSimulationRows,
    investmentProjections,
    savingsComputed,
    savingsRowsFV,
    totalPatrimonio,
    currentPlanMonth,
    selectedMonthIncome,
    yearIncomeStats,
    computedRendaBruta,
    selectedMonthOffset,
    isPhase2ForSelectedMonth,
    monthAllocation,
    updateMonthAllocation,
    resetMonthAllocation,
  };
}
```

- [ ] **Step 2: Verify the file lints cleanly**

```bash
npm run lint
```
Expected: 0 errors. If `useAccess` import path fails, verify with:
```bash
grep -r "export.*useAccess" src/contexts/AccessContext.jsx
```
Expected output contains: `export.*useAccess` or `export function useAccess`.

- [ ] **Step 3: Start the dev server and verify planner loads**

```bash
npm run dev
```
Open `http://localhost:5173`, navigate to the planner. Expected:
- Planner renders immediately with default values
- After ~300-500ms, if you had any prior localStorage data, the page still works (Firestore has no document yet, so it uses DEFAULT_STATE)
- Changing any field (e.g., hourly rate) and reloading the page — after the 800ms debounce fires, the new value should persist on next reload

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/usePlannerState.js
git commit -m "feat: migrate planner state to Firestore with optimistic writes and updated defaults"
```

---

## Task 3: Add shimmer loading state and Sistema tab to PlannerPage

**Files:**
- Modify: `src/pages/planner/PlannerPage.jsx`

- [ ] **Step 1: Replace the entire file content**

Replace `src/pages/planner/PlannerPage.jsx` with:

```jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shimmer } from '@/components/ui/shimmer';
import usePlannerState from './usePlannerState';
import SistemaTab from './SistemaTab';
import DashboardTab from './DashboardTab';
import AllocationTab from './AllocationTab';
import SimulacoesTab from './SimulacoesTab';
import InvestmentTab from './InvestmentTab';
import GastosTab from './GastosTab';

function MonthNav({ value, onChange }) {
  const [y, m] = value.split('-').map(Number);
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = value === currentMonthKey;

  const prev = () => {
    const d = new Date(y, m - 2, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const next = () => {
    const d = new Date(y, m, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={prev}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-sm"
      >
        ‹
      </button>
      <button
        onClick={() => onChange(currentMonthKey)}
        title="Ir para o mês atual"
        className={`px-2 py-1 rounded-lg text-sm font-semibold min-w-[90px] text-center capitalize transition-colors ${
          isCurrentMonth
            ? 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        {label}
      </button>
      <button
        onClick={next}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-sm"
      >
        ›
      </button>
    </div>
  );
}

const TABS = [
  { value: 'sistema',     label: 'Sistema' },
  { value: 'dashboard',   label: 'Dashboard' },
  { value: 'allocation',  label: 'Alocação' },
  { value: 'gastos',      label: 'Gastos' },
  { value: 'investments', label: 'Investimentos' },
  { value: 'simulacoes',  label: 'Simulações' },
];

function PlannerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => (
          <Shimmer key={i} className="h-9 w-24 rounded-xl" />
        ))}
      </div>
      <Shimmer className="w-full h-48 rounded-2xl" />
      <Shimmer className="w-full h-32 rounded-2xl" />
      <Shimmer className="w-full h-32 rounded-2xl" />
    </div>
  );
}

export default function PlannerPage() {
  const planner = usePlannerState();
  const {
    state,
    update,
    isLoading,
    simplesValue,
    despesasPJ,
    dizimoBase,
    dizimoValue,
    liquidezFinal,
    necessidadesValue,
    poupancaValue,
    desejosValue,
    carSimulationRows,
    houseSimulationRows,
    investmentProjections,
    savingsComputed,
    savingsRowsFV,
    totalPatrimonio,
    selectedMonthIncome,
    yearIncomeStats,
    computedRendaBruta,
    selectedMonthOffset,
    isPhase2ForSelectedMonth,
    monthAllocation,
    updateMonthAllocation,
    resetMonthAllocation,
  } = planner;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planejador Financeiro</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Planejamento pessoal PJ — modele sua renda, investimentos e metas de médio prazo.
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Início do plano</label>
            <input
              type="month"
              value={state.plannerStartDate}
              onChange={e => update('plannerStartDate', e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Mês selecionado</label>
            <div className="flex items-center h-[34px]">
              <MonthNav
                value={state.selectedPlannerMonth}
                onChange={m => update('selectedPlannerMonth', m)}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sistema">
          <div className="overflow-x-auto pb-2">
            <TabsList className="w-max">
              {TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {isLoading ? (
            <PlannerSkeleton />
          ) : (
            <>
              <TabsContent value="sistema">
                <SistemaTab
                  state={state}
                  computedRendaBruta={computedRendaBruta}
                  simplesValue={simplesValue}
                  despesasPJ={despesasPJ}
                  dizimoValue={dizimoValue}
                  liquidezFinal={liquidezFinal}
                  necessidadesValue={necessidadesValue}
                  poupancaValue={poupancaValue}
                  desejosValue={desejosValue}
                />
              </TabsContent>

              <TabsContent value="dashboard">
                <DashboardTab
                  state={state}
                  update={update}
                  simplesValue={simplesValue}
                  despesasPJ={despesasPJ}
                  dizimoBase={dizimoBase}
                  dizimoValue={dizimoValue}
                  liquidezFinal={liquidezFinal}
                  computedRendaBruta={computedRendaBruta}
                  selectedMonthIncome={selectedMonthIncome}
                  yearIncomeStats={yearIncomeStats}
                />
              </TabsContent>

              <TabsContent value="allocation">
                <AllocationTab
                  state={state}
                  liquidezFinal={liquidezFinal}
                  necessidadesValue={necessidadesValue}
                  poupancaValue={poupancaValue}
                  desejosValue={desejosValue}
                  monthAllocation={monthAllocation}
                  updateMonthAllocation={updateMonthAllocation}
                  resetMonthAllocation={resetMonthAllocation}
                  selectedMonth={state.selectedPlannerMonth}
                />
              </TabsContent>

              <TabsContent value="gastos">
                <GastosTab
                  selectedMonth={state.selectedPlannerMonth}
                  liquidezFinal={liquidezFinal}
                  necessidadesValue={necessidadesValue}
                  desejosValue={desejosValue}
                  poupancaValue={poupancaValue}
                />
              </TabsContent>

              <TabsContent value="simulacoes">
                <SimulacoesTab
                  state={state}
                  update={update}
                  selectedMonthIncome={selectedMonthIncome}
                  yearIncomeStats={yearIncomeStats}
                  carSimulationRows={carSimulationRows}
                  houseSimulationRows={houseSimulationRows}
                  selectedMonthOffset={selectedMonthOffset}
                  isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
                  totalPatrimonio={totalPatrimonio}
                  savingsComputed={savingsComputed}
                />
              </TabsContent>

              <TabsContent value="investments">
                <InvestmentTab
                  state={state}
                  update={update}
                  poupancaValue={poupancaValue}
                  savingsComputed={savingsComputed}
                  savingsRowsFV={savingsRowsFV}
                  isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
                  selectedMonthOffset={selectedMonthOffset}
                  livresPhase2={savingsComputed.livresPhase2}
                  investmentProjections={investmentProjections}
                  liquidezFinal={liquidezFinal}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint and verify**

```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 3: Verify in browser**

With `npm run dev` running, open the planner. Expected:
- Tab bar shows: Sistema | Dashboard | Alocação | Gastos | Investimentos | Simulações
- "Sistema" tab is selected by default and shows a spinner/shimmer for ~300-500ms then renders content (Task 4 implements SistemaTab — for now you'll see an import error until Task 4 is done)
- All other tabs still work as before

**Note:** The app will show a build error for missing `SistemaTab` until Task 4 is complete. That's expected — implement Task 4 immediately after this.

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/PlannerPage.jsx
git commit -m "feat: add Sistema tab and Firestore loading shimmer to PlannerPage"
```

---

## Task 4: Create SistemaTab — financial system overview

**Files:**
- Create: `src/pages/planner/SistemaTab.jsx`

- [ ] **Step 1: Create the file**

Create `src/pages/planner/SistemaTab.jsx` with the following content:

```jsx
import { formatBRL } from './usePlannerState';

const LAYER_STYLES = {
  red:    { card: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800',       icon: 'bg-red-100 dark:bg-red-800',    title: 'text-red-700 dark:text-red-300',    text: 'text-red-600 dark:text-red-400' },
  blue:   { card: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',   icon: 'bg-blue-100 dark:bg-blue-800',  title: 'text-blue-700 dark:text-blue-300',  text: 'text-blue-600 dark:text-blue-400' },
  green:  { card: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', icon: 'bg-emerald-100 dark:bg-emerald-800', title: 'text-emerald-700 dark:text-emerald-300', text: 'text-emerald-600 dark:text-emerald-400' },
  purple: { card: 'bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800', icon: 'bg-violet-100 dark:bg-violet-800', title: 'text-violet-700 dark:text-violet-300', text: 'text-violet-600 dark:text-violet-400' },
  orange: { card: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800', icon: 'bg-orange-100 dark:bg-orange-800', title: 'text-orange-700 dark:text-orange-300', text: 'text-orange-600 dark:text-orange-400' },
};

const LAYERS = [
  { icon: '🛡️', label: 'Proteção',    color: 'red',    text: 'Seguro vida R$ 6M — cobre morte, invalidez e doenças graves. Protege a família em qualquer cenário.' },
  { icon: '💧', label: 'Liquidez',    color: 'blue',   text: 'Reserva de emergência — meta R$ 120.000 (6 meses). Onde: Tesouro Selic / CDB liquidez diária.' },
  { icon: '📈', label: 'Crescimento', color: 'green',  text: 'Investimentos mensais — aporte base R$ 4k, variável até R$ 6k+. Horizonte longo, consistência acima de timing.' },
  { icon: '🏠', label: 'Patrimônio',  color: 'purple', text: 'Casa própria (meta entrada em ~3 anos) + carro. Ativos reais com apreciação de longo prazo.' },
  { icon: '👨‍👩‍👧‍👦', label: 'Legado',      color: 'orange', text: 'Educação dos filhos — meta R$ 600k–1.2M. Holding familiar quando patrimônio atingir R$ 300–500k.' },
];

const REGRAS = [
  'Investir antes de gastar',
  'Não subir custo fixo',
  'Revisar anualmente',
  'Manter consistência acima de timing',
  'Diversificação global',
];

const PROXIMOS_PASSOS = [
  { label: 'Aumentar aporte',  status: 'Em progresso', note: null,                     statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { label: 'Reduzir custo',    status: 'Em progresso', note: null,                     statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  { label: 'Criar holding',    status: 'Pendente',      note: 'Trigger: R$ 300–500k',  statusColor: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  { label: 'Expandir renda',   status: 'Em progresso', note: null,                     statusColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
];

// Inline mini bar for allocation comparison
function AllocationBar({ label, values }) {
  const colors = ['bg-blue-400', 'bg-emerald-400', 'bg-orange-400'];
  const names = ['Necessidades', 'Poupança', 'Desejos'];
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {values.map((v, i) => (
          <div key={i} className={`${colors[i]} transition-all`} style={{ width: `${v}%` }} title={`${names[i]}: ${v}%`} />
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {values.map((v, i) => (
          <span key={i} className="text-xs text-gray-400 tabular-nums">{v}%</span>
        ))}
      </div>
    </div>
  );
}

function CashFlowRow({ label, value, type, indent }) {
  const isDeduction = type === 'deduction';
  const isTotal = type === 'total';
  const isAlloc = type === 'allocation';

  return (
    <div className={`flex items-center justify-between py-2 ${isTotal ? 'border-t-2 border-violet-500 mt-1 pt-3' : 'border-t border-gray-100 dark:border-gray-700'} ${indent ? 'pl-4' : ''}`}>
      <div className="flex items-center gap-2">
        {isDeduction && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold shrink-0">−</span>
        )}
        {isAlloc && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">→</span>
        )}
        <span className={`text-sm ${isTotal ? 'font-bold text-gray-900 dark:text-white' : isAlloc ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {label}
        </span>
      </div>
      <span className={`text-sm tabular-nums font-semibold ${
        isTotal
          ? 'text-violet-600 dark:text-violet-400 text-base'
          : isDeduction
            ? 'text-red-500 dark:text-red-400'
            : isAlloc
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-900 dark:text-white'
      }`}>
        {formatBRL.format(value)}
      </span>
    </div>
  );
}

export default function SistemaTab({
  state,
  computedRendaBruta,
  simplesValue,
  despesasPJ,
  dizimoValue,
  liquidezFinal,
  necessidadesValue,
  poupancaValue,
  desejosValue,
}) {
  return (
    <div className="space-y-4">

      {/* ① Visão Geral */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Visão Geral
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Sistema financeiro para proteger a família, construir patrimônio e alcançar
          <span className="font-semibold text-violet-600 dark:text-violet-400"> independência financeira (~R$ 20k/mês)</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Curto prazo', value: '2–3 anos',   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800' },
            { label: 'Médio prazo', value: '5–10 anos',  color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800' },
            { label: 'Longo prazo', value: '15–25 anos', color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl px-3 py-2 ${color}`}>
              <p className="text-xs font-medium opacity-70">{label}</p>
              <p className="text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ② Arquitetura em Camadas */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Arquitetura em Camadas
        </h3>
        <div className="space-y-2">
          {LAYERS.map(({ icon, label, color, text }) => {
            const s = LAYER_STYLES[color];
            return (
              <div key={label} className={`rounded-xl p-3 border ${s.card} flex gap-3 items-start`}>
                <div className={`rounded-lg p-1.5 text-base shrink-0 ${s.icon}`}>{icon}</div>
                <div>
                  <p className={`text-sm font-semibold ${s.title}`}>{label}</p>
                  <p className={`text-xs mt-0.5 ${s.text}`}>{text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ③ Fluxo de Caixa — live */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Fluxo de Caixa
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {state.useMinScenario ? 'Cenário mínimo anual' : `Mês selecionado: ${state.selectedPlannerMonth}`}
        </p>
        <div>
          <CashFlowRow label="Renda Bruta (computada)" value={computedRendaBruta} type="income" />
          <CashFlowRow label={`Simples Nacional (${state.simplesNacionalPct}%)`} value={simplesValue} type="deduction" />
          <CashFlowRow label="Despesas PJ" value={despesasPJ} type="deduction" />
          <CashFlowRow label={`Dízimo (${state.dizimoPct}%)`} value={dizimoValue} type="deduction" />
          <CashFlowRow label="Liquidez Final" value={liquidezFinal} type="total" />
          <CashFlowRow label={`Necessidades (${state.necessidades}%)`} value={necessidadesValue} type="allocation" indent />
          <CashFlowRow label={`Poupança (${state.poupanca}%)`} value={poupancaValue} type="allocation" indent />
          <CashFlowRow label={`Desejos (${state.desejos}%)`} value={desejosValue} type="allocation" indent />
        </div>
      </div>

      {/* ④ Distribuição Atual vs Meta */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Distribuição: Atual vs Meta
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AllocationBar
            label="Atual"
            values={[state.necessidades, state.poupanca, state.desejos]}
          />
          <AllocationBar
            label="Meta"
            values={[56, 32, 8]}
          />
        </div>
        <div className="flex gap-4 mt-3">
          {[
            { label: 'Necessidades', color: 'bg-blue-400' },
            { label: 'Poupança',     color: 'bg-emerald-400' },
            { label: 'Desejos',      color: 'bg-orange-400' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ⑤ Regras de Ouro */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Regras de Ouro
        </h3>
        <ol className="space-y-2">
          {REGRAS.map((regra, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{regra}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ⑥ Próximos Passos */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Próximos Passos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PROXIMOS_PASSOS.map(({ label, status, note, statusColor }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
            >
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: 0 errors.

- [ ] **Step 3: Verify in browser**

With `npm run dev` running:
1. Navigate to the planner. The "Sistema" tab is selected by default.
2. Verify all 6 sections render: Visão Geral, Arquitetura em Camadas, Fluxo de Caixa, Distribuição, Regras de Ouro, Próximos Passos.
3. Verify the cash flow section shows live numbers (matches numbers in the Dashboard tab).
4. Change a field in Dashboard (e.g., toggle min/max scenario) → go back to Sistema → cash flow numbers update.
5. Resize the browser to mobile width (375px) → all cards stack correctly, no horizontal overflow.
6. Reload the page → after shimmer, your last-changed values are restored from Firestore (wait ~300-500ms after reload).

- [ ] **Step 4: Commit**

```bash
git add src/pages/planner/SistemaTab.jsx
git commit -m "feat: add Sistema Financeiro tab with layers, live cash flow, allocation comparison, and next steps"
```

---

## Task 5: Deploy Firestore rules

**Files:**
- `firestore.rules` (already updated in Task 1)

- [ ] **Step 1: Deploy rules to Firebase**

```bash
firebase deploy --only firestore:rules
```
Expected output: `✔  Deploy complete!`

If you get a "not logged in" error, run:
```bash
firebase login
```
Then re-run the deploy command.

- [ ] **Step 2: Verify rules are live**

Open the Firebase Console → Firestore → Rules tab. Confirm the `planner/{userId}` rule is visible.

- [ ] **Step 3: Final smoke test**

1. Open the deployed app (or local dev with Firestore emulator).
2. Change `hourlyRate` in the Dashboard tab to a new value (e.g., 30).
3. Wait 1 second for debounce to fire.
4. Hard-reload the page (Cmd+Shift+R / Ctrl+Shift+R).
5. Expected: after the shimmer clears, `hourlyRate` shows 30, not the default 25.

- [ ] **Step 4: Final commit**

```bash
git add firestore.rules
git commit -m "chore: deploy Firestore rules for planner collection" --allow-empty
```
(The rules file was already committed in Task 1 — this step just documents that deploy happened.)
