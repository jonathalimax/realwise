import { useState, useRef } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import PageHeader from '../components/PageHeader';
import { Shimmer } from '../components/ui/shimmer';
import { useMonth } from '../contexts/MonthContext';
import usePlannerState from './planner/usePlannerState';
import RendaTab from './planner/RendaTab';
import AllocationTab from './planner/AllocationTab';

function PlannerSkeleton() {
  return (
    <div className="space-y-4">
      <Shimmer className="w-full h-48 rounded-2xl" />
      <Shimmer className="w-full h-32 rounded-2xl" />
      <Shimmer className="w-full h-32 rounded-2xl" />
    </div>
  );
}

function CollapsibleSection({ title, description, defaultOpen = true, open: controlledOpen, onToggle, children }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const toggle = onToggle ?? (() => setInternalOpen(prev => !prev));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            {title}
          </p>
          {description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-normal normal-case tracking-normal">
              {description}
            </p>
          )}
        </div>
        {isOpen
          ? <ChevronUpIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
          : <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
        }
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default function PlanningPage() {
  const { selectedMonth } = useMonth();
  const [rendaOpen, setRendaOpen] = useState(true);
  const rendaRef = useRef(null);

  const focusRenda = () => {
    setRendaOpen(true);
    setTimeout(() => {
      rendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

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
  } = usePlannerState();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="Planejamento" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 space-y-4">
        {isLoading ? (
          <PlannerSkeleton />
        ) : (
          <>
            {/* Section 1 — Renda */}
            <div ref={rendaRef}>
            <CollapsibleSection
              title="Renda"
              description="Salário bruto, deduções e renda líquida disponível."
              open={rendaOpen}
              onToggle={() => setRendaOpen(prev => !prev)}
            >
              <RendaTab
                state={state}
                update={update}
                activeVersion={activeVersion}
                liquidezFinal={liquidezFinal}
                updateSalarioBruto={updateSalarioBruto}
                updateSalarioDeductions={updateSalarioDeductions}
                copyFromPreviousMonth={copyFromPreviousMonth}
              />
            </CollapsibleSection>
            </div>

            {/* Section 2 — Orçamento */}
            <CollapsibleSection
              title="Orçamento"
              description="Divida a renda líquida entre Necessidades, Poupança e Desejos."
              defaultOpen={true}
            >
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
                onGoToRenda={focusRenda}
              />
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
}
