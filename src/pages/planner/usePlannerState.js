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
    {
      id: 'emergencia', label: 'Fundo de Emergência', layer: 'liquidez',
      phase1: 2070.84, phase2: 2070.84, tipo: 'Prioridade máxima', returnPct: 1.0,
      goalTarget: 120000, manualBalance: 0,
      instruments: [
        { name: 'Tesouro Selic 2027',            type: 'Renda Fixa', alloc: 50 },
        { name: 'CDB liq. diária 110% CDI',      type: 'Renda Fixa', alloc: 50 },
      ],
    },
    {
      id: 'aposentadoria', label: 'Independência Financeira', layer: 'crescimento',
      phase1: 500, phase2: 800, tipo: 'Não pausar — renda futura', returnPct: 0.9,
      goalTarget: 6000000, manualBalance: 0,
      instruments: [
        { name: 'Tesouro IPCA+ 2040',    type: 'Renda Fixa', alloc: 35 },
        { name: 'IVVB11 (S&P 500 ETF)',  type: 'ETF',        alloc: 25 },
        { name: 'MXRF11 (Maxi Renda)',   type: 'FII',        alloc: 15 },
        { name: 'HGLG11 (Patria Log)',   type: 'FII',        alloc: 15 },
        { name: 'XPML11 (XP Malls)',     type: 'FII',        alloc: 10 },
      ],
    },
    {
      id: 'casa', label: 'Meta Entrada Casa', layer: 'patrimonio',
      phase1: 1757.58, phase2: 3000, tipo: 'Meta ~3 anos', returnPct: 1.0,
      goalTarget: 400000, manualBalance: 0,
      instruments: [
        { name: 'CDB 110% CDI liq. diária', type: 'Renda Fixa', alloc: 70 },
        { name: 'Tesouro Selic 2027',        type: 'Renda Fixa', alloc: 30 },
      ],
    },
    {
      id: 'filhos', label: 'Filhos (Educação)', layer: 'legado',
      phase1: 1500, phase2: 2000, tipo: 'Meta R$ 800k', returnPct: 0.9,
      goalTarget: 800000, manualBalance: 0,
      instruments: [
        { name: 'IVVB11 (S&P 500 ETF)',  type: 'ETF',        alloc: 50 },
        { name: 'BOVA11 (Ibovespa ETF)', type: 'ETF',        alloc: 20 },
        { name: 'Tesouro IPCA+ 2050',    type: 'Renda Fixa', alloc: 30 },
      ],
    },
    {
      id: 'mae', label: 'Reserva Mãe', layer: 'liquidez',
      phase1: 500, phase2: 500, tipo: 'Fixo mensal', returnPct: 1.0,
      goalTarget: 0, manualBalance: 0,
      instruments: [
        { name: 'AstroPay / CDB liq. diária', type: 'Renda Fixa', alloc: 100 },
      ],
    },
    {
      id: 'manutencao', label: 'Reserva Manutenção Carro', layer: 'liquidez',
      phase1: 250, phase2: 250, tipo: '÷12 do orçamento anual', returnPct: 1.0,
      goalTarget: 3000, manualBalance: 0,
      instruments: [
        { name: 'CDB liq. diária 110% CDI', type: 'Renda Fixa', alloc: 100 },
      ],
    },
    {
      id: 'ipva', label: 'Reserva IPVA', layer: 'liquidez',
      phase1: 166.67, phase2: 166.67, tipo: '÷12', returnPct: 1.0,
      goalTarget: 2000, manualBalance: 0,
      instruments: [
        { name: 'CDB liq. diária 110% CDI', type: 'Renda Fixa', alloc: 100 },
      ],
    },
    {
      id: 'matricula', label: 'Reserva Matrícula', layer: 'liquidez',
      phase1: 125, phase2: 125, tipo: '÷12', returnPct: 1.0,
      goalTarget: 1500, manualBalance: 0,
      instruments: [
        { name: 'CDB liq. diária 110% CDI', type: 'Renda Fixa', alloc: 100 },
      ],
    },
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

  // Ensure all default fields are present on each row (handles schema migrations)
  merged.savingsRows = merged.savingsRows.map(row => {
    const def = DEFAULT_STATE.savingsRows.find(d => d.id === row.id);
    return {
      returnPct:   def?.returnPct   ?? 1.0,
      goalTarget:  def?.goalTarget  ?? 0,
      manualBalance: def?.manualBalance ?? 0,
      label:       def?.label       ?? row.label,
      layer:       def?.layer       ?? 'liquidez',
      instruments: def?.instruments ?? [],
      ...row,
    };
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
  const { ownerId, loading: accessLoading } = useAccess();
  const [state, setState] = useState(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const debounceRef = useRef(null);

  // ── Resolve loading when AccessContext finishes but ownerId is still null ─
  useEffect(() => {
    if (!accessLoading && !ownerId) {
      Promise.resolve().then(() => {
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
    }
  }, [accessLoading, ownerId]);

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
