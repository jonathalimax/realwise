import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shimmer } from '@/components/ui/shimmer';
import usePlannerState from './usePlannerState';
import RendaTab from './RendaTab';
import AllocationTab from './AllocationTab';
import CarteiraTab from './carteira';

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
  { value: 'renda',      label: 'Renda',    icon: '💰' },
  { value: 'allocation', label: 'Alocação', icon: '📐' },
  { value: 'carteira',   label: 'Carteira', icon: '💼' },
];

function PlannerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
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
  const [activeTab, setActiveTab] = useState('renda');
  const [showSettings, setShowSettings] = useState(false);
  const {
    state,
    update,
    isLoading,
    liquidezFinal,
    updateCategoryBudgetPct,
    necessidadesValue,
    poupancaValue,
    desejosValue,
    monthAllocation,
    updateMonthAllocation,
    resetMonthAllocation,
  } = planner;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 pb-24 sm:pb-6">
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
              Configure sua renda e planeje como alocar cada real.
            </p>
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
          <div className="hidden sm:block overflow-x-auto pb-2">
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
              <TabsContent value="renda">
                <RendaTab
                  state={state}
                  update={update}
                  liquidezFinal={liquidezFinal}
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

              <TabsContent value="carteira">
                <CarteiraTab
                  state={state}
                  update={update}
                  poupancaValue={poupancaValue}
                  selectedMonth={state.selectedPlannerMonth}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* ── Mobile bottom nav (hidden on sm+) ──────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex safe-area-inset-bottom">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              activeTab === tab.value
                ? 'text-violet-600 dark:text-violet-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
