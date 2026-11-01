import { useState, useEffect, useRef, useMemo } from 'react';
import { useAccess } from '@/contexts/AccessContext';
import { useMonth } from '@/contexts/MonthContext';
import { computeTotalIncome } from './rendaCalc.js';
import { plannerResource } from '@/lib/api/resources/planner';

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
  // Tab 1 - Renda
  salarioBruto: 10000,
  salarioDeductions: [
    { id: 'inss', label: 'INSS', type: 'pct', amount: 7.5 },
    { id: 'irpf', label: 'IRPF', type: 'pct', amount: 27.5 },
  ],
  salarioBenefits: [],

  // Legacy fields (will be migrated to plannerVersions)
  rendaBruta: 10000,
  selectedPlannerMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  useMinScenario: true,
  simplesNacionalPct: 6,
  planoSaude: 300,
  contabilidade: 150,
  internet: 50,

  // Category budget percentages — { [categoryName]: pct (% of liquidezFinal) }
  categoryBudgetsPct: {},

  // Tab 2 - Allocation (70/20/10)
  necessidades: 70,
  poupanca: 20,
  desejos: 10,
  allocationOverrides: {},

  // New Versioned State
  plannerVersions: [],

  // USD Calculator
  hourlyRate: 25,
  hoursPerDay: 8,
  usdToBrl: 5.70,
  platformFeePct: 0.5,
  // ... rest of state stays same

  // Car Simulator
  carMonthlyPayment: 2111.30,
  carRemainingMonths: 52,
  carMonthlyRate: 3.9,
  carLastParcelasCount: 1,
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
    {
      id: 'carAntecipacao', label: 'Antecipar Carro', layer: 'patrimonio',
      phase1: 0, phase2: 500, tipo: 'Quitar financiamento antecipado', returnPct: 1.0,
      goalTarget: 0, manualBalance: 0,
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

  // Investment classes — mode:'pct' = dynamic (livresValue × pct/100), mode:'value' = fixed phase amounts
  investmentClasses: [
    { name: 'Renda Fixa (CDB/Tesouro)', pct: 44, phase1: 455,  phase2: 2000, returnPct: 1.0, vehicle: 'Tesouro IPCA+ 2040 / CDB 110% CDI', mode: 'pct', positions: [] },
    { name: 'Exterior ETFs',            pct: 30, phase1: 390,  phase2: 1350, returnPct: 1.0, vehicle: 'IVVB11 (S&P 500)',                   mode: 'pct', positions: [] },
    { name: 'FIIs',                     pct: 16, phase1: 195,  phase2: 700,  returnPct: 0.8, vehicle: 'MXRF11, HGLG11, XPML11',             mode: 'pct', positions: [] },
    { name: 'Ações Dividendos',         pct: 10, phase1: 195,  phase2: 450,  returnPct: 0.7, vehicle: 'BOVA11 / ITUB4, BBAS3',              mode: 'pct', positions: [] },
    { name: 'Cripto',                   pct:  0, phase1: 65,   phase2: 0,    returnPct: 1.5, vehicle: 'BTC 70% + ETH',                      mode: 'pct', positions: [] },
  ],

  // Wallet versions — used by CarteiraTab only.
  walletVersions: [{
    from: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    layers: [
      {
        id: 'protecao', label: 'Proteção', icon: '🛡️', colorKey: 'blue',
        description: 'Reservas de emergência e proteção financeira.',
        pct: 30,
        sublayers: [
          {
            id: 'reserva-emergencia', label: 'Reserva de Emergência', icon: '🛡️',
            type: 'Renda Fixa', bank: '',
            description: 'CDB liq. diária / Tesouro Selic',
            mode: 'value', pct: 0, value: 0,
            goalTarget: 0, manualBalance: 0,
            returnPct: 1.0, taxRate: 15, instruments: [],
          },
        ],
      },
    ],
  }],
};

function migrateState(saved) {
  const merged = { ...DEFAULT_STATE, ...saved };

  // 1. Initial Migration to plannerVersions if empty
  if (!merged.plannerVersions?.length) {
    const startMonth = merged.plannerStartDate ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    merged.plannerVersions = [{
      from: startMonth,
      salarioBruto: merged.salarioBruto ?? 10000,
      salarioDeductions: merged.salarioDeductions ?? DEFAULT_STATE.salarioDeductions,
      salarioBenefits: merged.salarioBenefits ?? DEFAULT_STATE.salarioBenefits,
      allocation: {
        necessidades: merged.necessidades ?? 70,
        poupanca: merged.poupanca ?? 20,
        desejos: merged.desejos ?? 10,
      },
      categoryBudgetsPct: merged.categoryBudgetsPct ?? {},
    }];

    // Migrate overrides if they exist
    Object.entries(merged.allocationOverrides || {}).forEach(([m, ov]) => {
      // For simplicity in migration, we can just treat each override as its own version 
      // but only if it's different from the base. 
      // However, the new logic handles versioning better.
      // Let's just ensure the base is solid.
    });
  }

  // Ensure all default savingsRows exist
  const existingIds = new Set(merged.savingsRows.map(r => r.id));
  DEFAULT_STATE.savingsRows.forEach(defRow => {
    if (!existingIds.has(defRow.id)) {
      merged.savingsRows.push({ ...defRow });
    }
  });

  // ... (keep existing migrations for savingsRows, investmentClasses, etc.)
  // Ensure phase1/phase2/mode/positions are present on all investmentClasses
  if (merged.investmentClasses) {
    merged.investmentClasses = merged.investmentClasses.map(cls => {
      const def = DEFAULT_STATE.investmentClasses.find(d => d.name === cls.name);
      return {
        phase1:    def?.phase1    ?? 0,
        phase2:    def?.phase2    ?? 0,
        mode:      def?.mode      ?? 'pct',
        positions: def?.positions ?? [],
        ...cls,
      };
    });
  }

  // Migrate savingsRows + investmentClasses → walletVersions if absent
  if (!merged.walletVersions?.length) {
    const startMonth = merged.plannerStartDate ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // Group savingsRows by layer
    const byLayer = {};
    (merged.savingsRows ?? []).forEach(row => {
      const layerId = row.layer ?? 'liquidez';
      if (!byLayer[layerId]) byLayer[layerId] = [];
      const ICONS = { emergencia: '🛡️', filhos: '👶', casa: '🏠', mae: '❤️', manutencao: '🔧', ipva: '🚗', matricula: '📚', carAntecipacao: '⏭️' };
      byLayer[layerId].push({
        id: row.id,
        label: row.label,
        icon: ICONS[row.id] ?? '💰',
        type: 'Renda Fixa',
        bank: '',
        description: (row.instruments ?? []).map(i => i.name).join(' / '),
        mode: 'value',
        pct: 0,
        value: row.phase1 ?? 0,
        goalTarget: row.goalTarget ?? 0,
        manualBalance: row.manualBalance ?? 0,
        returnPct: row.returnPct ?? 1.0,
        taxRate: 15,
        instruments: row.instruments ?? [],
      });
    });

    // Build crescimento sublayers from investmentClasses
    const CLASS_ICONS = { 'Renda Fixa (CDB/Tesouro)': '📈', 'Exterior ETFs': '🌍', 'FIIs': '🏢', 'Ações Dividendos': '💹', 'Cripto': '₿' };
    const CLASS_TYPES = { 'Renda Fixa (CDB/Tesouro)': 'Renda Fixa', 'Exterior ETFs': 'ETF', 'FIIs': 'FII', 'Ações Dividendos': 'Ações', 'Cripto': 'Cripto' };
    const crescimentoSublayers = (merged.investmentClasses ?? []).map(cls => ({
      id: `cls-${cls.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: cls.name,
      icon: CLASS_ICONS[cls.name] ?? '📊',
      type: CLASS_TYPES[cls.name] ?? 'Misto',
      bank: '',
      description: cls.vehicle ?? '',
      mode: cls.mode ?? 'pct',
      pct: cls.pct ?? 0,
      value: cls.phase1 ?? 0,
      goalTarget: 0,
      manualBalance: 0,
      returnPct: cls.returnPct ?? 1.0,
      taxRate: 15,
      instruments: (cls.positions ?? []).map(p => ({ name: p.name, type: p.type ?? 'Outro', alloc: p.alloc ?? 0 })),
    }));

    const LAYER_DEFS = [
      { id: 'liquidez',    label: 'Liquidez',    icon: '💧', colorKey: 'blue',    pct: 30, description: 'Reservas líquidas e de emergência — acesso imediato.' },
      { id: 'crescimento', label: 'Crescimento', icon: '📈', colorKey: 'emerald', pct: 40, description: 'Composição de longo prazo — consistência acima de timing.' },
      { id: 'patrimonio',  label: 'Patrimônio',  icon: '🏠', colorKey: 'violet',  pct: 20, description: 'Ativos reais — casa e carro com apreciação de longo prazo.' },
      { id: 'legado',      label: 'Legado',      icon: '👨‍👩‍👧‍👦', colorKey: 'orange',  pct: 10, description: 'Impacto intergeracional — educação dos filhos e holding familiar.' },
    ];

    merged.walletVersions = [{
      from: startMonth,
      layers: LAYER_DEFS.map(def => ({
        id: def.id,
        label: def.label,
        icon: def.icon,
        colorKey: def.colorKey,
        description: def.description,
        pct: def.pct,
        sublayers: def.id === 'crescimento'
          ? crescimentoSublayers
          : (byLayer[def.id] ?? []),
      })),
    }];
  }

  return merged;
}

const DEFAULT_MONTH_DATA = {
  salarioBruto: 0,
  salarioDeductions: [],
  salarioBenefits: [],
  allocation: { necessidades: 70, poupanca: 20, desejos: 10 },
  categoryBudgetsPct: {}
};

/**
 * Returns the version for a specific month or defaults.
 */
export function getActivePlannerVersion(versions, month) {
  return versions?.find(v => v.from === month) || DEFAULT_MONTH_DATA;
}

/**
 * Strictly updates only the specified month.
 */
export function updatePlannerForMonth(versions, month, patchFn) {
  const existingIdx = versions.findIndex(v => v.from === month);
  
  if (existingIdx !== -1) {
    return versions.map((v, i) => i === existingIdx ? { ...v, ...patchFn(v) } : v);
  }

  // Create new entry for this month starting from defaults
  const newEntry = {
    ...DEFAULT_MONTH_DATA,
    from: month,
    ...patchFn(DEFAULT_MONTH_DATA),
  };
  return [...versions, newEntry];
}

export const formatBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function usePlannerState() {
  const { ownerId, loading: accessLoading } = useAccess();
  const { selectedMonth: globalSelectedMonth } = useMonth();
  const [state, setState] = useState(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const debounceRef = useRef(null);

  const update = (key, value) => setState(prev => ({ ...prev, [key]: value }));

  // ── Sync with global selectedMonth ────────────────────────────────────────
  useEffect(() => {
    if (globalSelectedMonth && globalSelectedMonth !== state.selectedPlannerMonth) {
      update('selectedPlannerMonth', globalSelectedMonth);
    }
  }, [globalSelectedMonth, state.selectedPlannerMonth]);

  // ── Resolve loading when AccessContext finishes but ownerId is still null ─
  useEffect(() => {
    if (!accessLoading && !ownerId) {
      Promise.resolve().then(() => {
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
    }
  }, [accessLoading, ownerId]);

  // ── Load the planner state on mount ───────────────────────────────────────
  useEffect(() => {
    if (!ownerId) return;
    plannerResource.get()
      .then((data) => {
        const saved = data?.state || data || {};
        if (saved && Object.keys(saved).length > 0) {
          setState(migrateState(saved));
        } else {
          setState(migrateState({}));
        }
        hasLoadedRef.current = true;
        setIsLoading(false);
      })
      .catch(() => {
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
  }, [ownerId]);

  // ── Debounced save to API on every state change ───────────────────────────
  useEffect(() => {
    if (!ownerId || !hasLoadedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      plannerResource.update({ state }).catch(() => {});
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, ownerId]);

  // ── Active version for the selected month ────────────────────────────────
  const activeVersion = useMemo(() => {
    return getActivePlannerVersion(state.plannerVersions, state.selectedPlannerMonth);
  }, [state.plannerVersions, state.selectedPlannerMonth]);

  // ── Versioned Setters (Cascading) ────────────────────────────────────────
  const updatePlannerVersion = (patchFn) => {
    const nextVersions = updatePlannerForMonth(state.plannerVersions, state.selectedPlannerMonth, patchFn);
    update('plannerVersions', nextVersions);
  };

  const updateMonthAllocation = (field, value) => {
    updatePlannerVersion(v => ({
      allocation: { ...v.allocation, [field]: value }
    }));
  };

  /** Replaces the whole needs / savings / wants split at once (presets), so three field writes cannot race. */
  const setMonthAllocation = (allocation) => {
    updatePlannerVersion(() => ({ allocation: { ...allocation } }));
  };

  const updateSalarioBruto = (value) => {
    updatePlannerVersion(() => ({ salarioBruto: value }));
  };

  const updateSalarioDeductions = (next) => {
    updatePlannerVersion(() => ({ salarioDeductions: next }));
  };

  const updateSalarioBenefits = (next) => {
    updatePlannerVersion(() => ({ salarioBenefits: next }));
  };

  const updateCategoryBudgetPct = (category, pct) => {
    updatePlannerVersion(v => ({
      categoryBudgetsPct: { ...v.categoryBudgetsPct, [category]: pct }
    }));
  };

  const resetMonthAllocation = () => {
    updatePlannerVersion(v => ({
      allocation: { ...DEFAULT_MONTH_DATA.allocation },
      categoryBudgetsPct: { ...DEFAULT_MONTH_DATA.categoryBudgetsPct }
    }));
  };

  const copyFromPreviousMonth = () => {
    const [y, m] = state.selectedPlannerMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevData = state.plannerVersions.find(v => v.from === prevKey);

    if (prevData) {
      updatePlannerVersion(() => ({
        salarioBruto: prevData.salarioBruto,
        salarioDeductions: JSON.parse(JSON.stringify(prevData.salarioDeductions ?? [])),
        salarioBenefits: JSON.parse(JSON.stringify(prevData.salarioBenefits ?? [])),
        allocation: JSON.parse(JSON.stringify(prevData.allocation ?? {})),
        categoryBudgetsPct: JSON.parse(JSON.stringify(prevData.categoryBudgetsPct ?? {})),
      }));
      return true;
    } else {
      alert('Nenhum dado encontrado para o mês anterior.');
      return false;
    }
  };

  // ── Income from USD params (kept for legacy/specific UI needs) ───────────
  const selectedMonthIncome = useMemo(() => {
    const [y, m] = state.selectedPlannerMonth.split('-').map(Number);
    const bDays = countWeekdays(y, m);
    const grossUSD = state.hourlyRate * state.hoursPerDay * bDays;
    const netUSD = grossUSD * (1 - state.platformFeePct / 100);
    return { grossUSD, netUSD, netBRL: netUSD * state.usdToBrl, bDays };
  }, [state.selectedPlannerMonth, state.hourlyRate, state.hoursPerDay, state.usdToBrl, state.platformFeePct]);

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

  // ── Dashboard computed (Version-aware) ──────────────────────────────────
  const liquidezFinal = useMemo(() => {
    if (!activeVersion) return 0;
    return computeTotalIncome(activeVersion.salarioBruto, activeVersion.salarioDeductions, activeVersion.salarioBenefits);
  }, [activeVersion]);

  const monthAllocation = useMemo(() => {
    return activeVersion?.allocation ?? { necessidades: 70, poupanca: 20, desejos: 10 };
  }, [activeVersion]);

  const categoryBudgetsPct = useMemo(() => {
    return activeVersion?.categoryBudgetsPct ?? {};
  }, [activeVersion]);

  const computedRendaBruta = useMemo(() => {
    return state.useMinScenario ? yearIncomeStats.minMonth.netBRL : selectedMonthIncome.netBRL;
  }, [state.useMinScenario, yearIncomeStats, selectedMonthIncome]);

  const simplesValue = useMemo(() => computedRendaBruta * state.simplesNacionalPct / 100, [computedRendaBruta, state.simplesNacionalPct]);
  const despesasPJ = useMemo(() => state.planoSaude + state.contabilidade + state.internet, [state.planoSaude, state.contabilidade, state.internet]);

  // ── Allocation computed ─────────────────────────────────────────────────
  const necessidadesValue = useMemo(() => liquidezFinal * monthAllocation.necessidades / 100, [liquidezFinal, monthAllocation.necessidades]);
  const poupancaValue = useMemo(() => liquidezFinal * monthAllocation.poupanca / 100, [liquidezFinal, monthAllocation.poupanca]);
  const desejosValue = useMemo(() => liquidezFinal * monthAllocation.desejos / 100, [liquidezFinal, monthAllocation.desejos]);

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
    activeVersion,
    // Renda
    liquidezFinal,
    updateSalarioBruto,
    updateSalarioDeductions,
    updateSalarioBenefits,
    // Legacy dashboard computed
    simplesValue,
    despesasPJ,
    // Category budgets
    categoryBudgetsPct,
    updateCategoryBudgetPct,
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
    setMonthAllocation,
    resetMonthAllocation,
    copyFromPreviousMonth,
  };
}
