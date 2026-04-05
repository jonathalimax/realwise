import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shimmer } from '@/components/ui/shimmer';
import usePlannerState from './usePlannerState';
import SistemaTab from './SistemaTab';
import CarteiraTab from './CarteiraTab';
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
  { value: 'carteira',    label: 'Carteira' },
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

              <TabsContent value="carteira">
                <CarteiraTab
                  state={state}
                  update={update}
                  isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
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
