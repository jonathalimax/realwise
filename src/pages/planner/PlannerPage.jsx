import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="Planejador Financeiro" />
      <div className="max-w-5xl mx-auto space-y-4 p-4 md:p-6">
        {isLoading ? (
          <PlannerSkeleton />
        ) : (
          <>
            {activeTab === 'renda' && (
              <RendaTab
                state={state}
                update={update}
                liquidezFinal={liquidezFinal}
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
                updateCategoryBudgetPct={updateCategoryBudgetPct}
              />
            )}

            {activeTab === 'rastreamento' && (
              <RastreamentoTab selectedMonth={selectedMonth} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
