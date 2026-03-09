import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import usePlannerState from './usePlannerState';
import DashboardTab from './DashboardTab';
import AllocationTab from './AllocationTab';
import SavingsTab from './SavingsTab';
import UsdCalculatorTab from './UsdCalculatorTab';
import CarSimulatorTab from './CarSimulatorTab';
import HouseSimulatorTab from './HouseSimulatorTab';
import InvestmentTab from './InvestmentTab';
import PatrimonioTab from './PatrimonioTab';
import GastosTab from './GastosTab';

const TABS = [
  { value: 'dashboard',   label: 'Dashboard' },
  { value: 'allocation',  label: 'Alocação' },
  { value: 'gastos',      label: 'Gastos' },
  { value: 'savings',     label: 'Reservas' },
  { value: 'usd',         label: 'Câmbio USD' },
  { value: 'car',         label: 'Carro' },
  { value: 'house',       label: 'Imóvel' },
  { value: 'investments', label: 'Investimentos' },
  { value: 'patrimonio',  label: 'Patrimônio' },
];

export default function PlannerPage() {
  const planner = usePlannerState();
  const {
    state,
    update,
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
    currentPlanMonth,
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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard">
          {/* Scrollable tab list for mobile */}
          <div className="overflow-x-auto pb-2">
            <TabsList className="w-max">
              {TABS.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            <DashboardTab
              state={state}
              update={update}
              simplesValue={simplesValue}
              despesasPJ={despesasPJ}
              dizimoBase={dizimoBase}
              dizimoValue={dizimoValue}
              liquidezFinal={liquidezFinal}
            />
          </TabsContent>

          <TabsContent value="allocation">
            <AllocationTab
              state={state}
              update={update}
              liquidezFinal={liquidezFinal}
              necessidadesValue={necessidadesValue}
              poupancaValue={poupancaValue}
              desejosValue={desejosValue}
            />
          </TabsContent>

          <TabsContent value="gastos">
            <GastosTab />
          </TabsContent>

          <TabsContent value="savings">
            <SavingsTab
              state={state}
              update={update}
              savingsComputed={savingsComputed}
              poupancaValue={poupancaValue}
            />
          </TabsContent>

          <TabsContent value="usd">
            <UsdCalculatorTab state={state} update={update} />
          </TabsContent>

          <TabsContent value="car">
            <CarSimulatorTab
              state={state}
              update={update}
              carSimulationRows={carSimulationRows}
              currentPlanMonth={currentPlanMonth}
            />
          </TabsContent>

          <TabsContent value="house">
            <HouseSimulatorTab
              state={state}
              update={update}
              houseSimulationRows={houseSimulationRows}
              currentPlanMonth={currentPlanMonth}
            />
          </TabsContent>

          <TabsContent value="investments">
            <InvestmentTab
              state={state}
              update={update}
              poupancaValue={poupancaValue}
              livresPhase2={savingsComputed.livresPhase2}
              investmentProjections={investmentProjections}
              liquidezFinal={liquidezFinal}
            />
          </TabsContent>

          <TabsContent value="patrimonio">
            <PatrimonioTab
              state={state}
              update={update}
              totalPatrimonio={totalPatrimonio}
              savingsComputed={savingsComputed}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
