import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHelp from '@/components/ui/PageHelp';
import { Shimmer } from '@/components/ui/shimmer';
import { useMonth } from '@/contexts/MonthContext';
import PageHeader from '@/components/PageHeader';
import usePlannerState from './usePlannerState';
import RendaTab from './RendaTab';
import AllocationTab from './AllocationTab';
import RastreamentoTab from './RastreamentoTab';

function PlannerSkeleton() {
  return (
    <div className="space-y-4">
      <Shimmer className="w-full h-48 rounded-2xl" />
      <Shimmer className="w-full h-32 rounded-2xl" />
      <Shimmer className="w-full h-32 rounded-2xl" />
    </div>
  );
}

const PLANNER_HELP = {
  renda: 'Informe seu salário líquido. Ele é a base de todos os cálculos do planejador. Se tiver descontos em folha, ative o modo detalhado nas configurações.',
  allocation: 'Defina a divisão ideal entre Necessidades, Poupança e Desejos. Arraste o controle para ajustar os percentuais. O total deve ser 100%.',
  rastreamento: 'Acompanhe quanto do seu orçamento foi utilizado em cada categoria no mês selecionado.',
};

export default function PlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedMonth } = useMonth();
  const planner = usePlannerState();

  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab');
    return tab === 'alocacao' ? 'allocation'
      : tab === 'rastreamento' ? 'rastreamento'
      : 'renda';
  }, [searchParams]);

  // Keep setSearchParams in scope so sidebar nav links keep working
  void setSearchParams;

  const {
    state,
    update,
    isLoading,
    activeVersion,
    liquidezFinal,
    updateSalarioBruto,
    updateSalarioDeductions,
    categoryBudgetsPct,
    updateCategoryBudgetPct,
    necessidadesValue,
    poupancaValue,
    desejosValue,
    monthAllocation,
    updateMonthAllocation,
    resetMonthAllocation,
    copyFromPreviousMonth,
  } = planner;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="Planejador Financeiro" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 space-y-4">
        {isLoading ? (
          <PlannerSkeleton />
        ) : (
          <>
            {activeTab === 'renda' && (
              <RendaTab
                state={state}
                update={update}
                activeVersion={activeVersion}
                liquidezFinal={liquidezFinal}
                updateSalarioBruto={updateSalarioBruto}
                updateSalarioDeductions={updateSalarioDeductions}
                copyFromPreviousMonth={copyFromPreviousMonth}
              />
            )}

            {activeTab === 'allocation' && (
              <AllocationTab
                state={state}
                liquidezFinal={liquidezFinal}
                necessidadesValue={necessidadesValue}
                poupancaValue={poupancaValue}
                desejosValue={desejosValue}
                monthAllocation={monthAllocation}
                updateMonthAllocation={updateMonthAllocation}
                resetMonthAllocation={resetMonthAllocation}
                selectedMonth={selectedMonth}
                categoryBudgetsPct={categoryBudgetsPct}
                updateCategoryBudgetPct={updateCategoryBudgetPct}
                copyFromPreviousMonth={copyFromPreviousMonth}
              />
            )}

            {activeTab === 'rastreamento' && (
              <RastreamentoTab selectedMonth={selectedMonth} />
            )}
          </>
        )}
      </div>
      <PageHelp
        title="Planejador"
        text={PLANNER_HELP[activeTab] ?? 'Use as abas para navegar entre as seções do planejador financeiro.'}
        hasFab={false}
      />
    </div>
  );
}
