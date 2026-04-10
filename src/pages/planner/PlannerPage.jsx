import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shimmer } from '@/components/ui/shimmer';
import usePlannerState from './usePlannerState';
import SistemaTab from './SistemaTab';
import CarteiraTab from './carteira';
import DashboardTab from './DashboardTab';
import AllocationTab from './AllocationTab';

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
  { value: 'sistema',    label: 'Sistema',   icon: '🧭' },
  { value: 'carteira',   label: 'Carteira',  icon: '💼' },
  { value: 'dashboard',  label: 'Dashboard', icon: '📊' },
  { value: 'allocation', label: 'Alocação',  icon: '📐' },
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
  const [activeTab, setActiveTab] = useState('sistema');
  const [showSettings, setShowSettings] = useState(false);
  const {
    state,
    update,
    isLoading,
    simplesValue,
    despesasPJ,
    liquidezFinal,
    updateCategoryBudgetPct,
    necessidadesValue,
    poupancaValue,
    desejosValue,
    selectedMonthIncome,
    yearIncomeStats,
    computedRendaBruta,
    monthAllocation,
    updateMonthAllocation,
    resetMonthAllocation,
  } = planner;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* ── Mobile header (hidden on sm+) ────────────────────────── */}
        <div className="flex items-center gap-2 sm:hidden">
          <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-white truncate">
            Planejador
          </h1>
          <MonthNav
            value={state.selectedPlannerMonth}
            onChange={m => update('selectedPlannerMonth', m)}
          />
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-base"
            aria-label="Configurações do plano"
          >
            ⚙️
          </button>
        </div>

        {/* ── Desktop header (hidden on mobile) ──────────────────────── */}
        <div className="hidden sm:flex flex-col sm:flex-row sm:items-end gap-3">
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

        {/* ── Settings bottom sheet (mobile only) ────────────────────── */}
        {showSettings && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:hidden bg-black/40"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-6 shadow-2xl border-t border-gray-200 dark:border-gray-700"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Configurações</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
                >
                  ×
                </button>
              </div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Início do plano
              </label>
              <input
                type="month"
                value={state.plannerStartDate}
                onChange={e => update('plannerStartDate', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                  liquidezFinal={liquidezFinal}
                  necessidadesValue={necessidadesValue}
                  poupancaValue={poupancaValue}
                  desejosValue={desejosValue}
                />
              </TabsContent>

              <TabsContent value="carteira">
                <CarteiraTab
                  state={state}
                  update={update}
                  poupancaValue={poupancaValue}
                  selectedMonth={state.selectedPlannerMonth}
                />
              </TabsContent>

              <TabsContent value="dashboard">
                <DashboardTab
                  state={state}
                  update={update}
                  simplesValue={simplesValue}
                  despesasPJ={despesasPJ}
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
                  updateCategoryBudgetPct={updateCategoryBudgetPct}
                />
              </TabsContent>

            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
