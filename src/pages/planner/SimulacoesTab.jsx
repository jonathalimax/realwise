import { useState } from 'react';
import UsdCalculatorTab from './UsdCalculatorTab';
import CarSimulatorTab from './CarSimulatorTab';
import HouseSimulatorTab from './HouseSimulatorTab';
import PatrimonioTab from './PatrimonioTab';

const SUB_TABS = [
  { value: 'usd',       label: 'Câmbio USD' },
  { value: 'car',       label: 'Carro' },
  { value: 'house',     label: 'Imóvel' },
  { value: 'patrimonio', label: 'Patrimônio' },
];

export default function SimulacoesTab({
  state,
  update,
  selectedMonthIncome,
  yearIncomeStats,
  carSimulationRows,
  houseSimulationRows,
  selectedMonthOffset,
  isPhase2ForSelectedMonth,
  totalPatrimonio,
  savingsComputed,
}) {
  const [activeTab, setActiveTab] = useState('usd');

  return (
    <div className="space-y-3">
      {/* Inner tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {SUB_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === tab.value
                ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'usd' && (
        <UsdCalculatorTab
          state={state}
          selectedMonthIncome={selectedMonthIncome}
          yearIncomeStats={yearIncomeStats}
        />
      )}
      {activeTab === 'car' && (
        <CarSimulatorTab
          state={state}
          update={update}
          carSimulationRows={carSimulationRows}
          selectedMonthOffset={selectedMonthOffset}
          isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
        />
      )}
      {activeTab === 'house' && (
        <HouseSimulatorTab
          state={state}
          update={update}
          houseSimulationRows={houseSimulationRows}
          selectedMonthOffset={selectedMonthOffset}
          isPhase2ForSelectedMonth={isPhase2ForSelectedMonth}
        />
      )}
      {activeTab === 'patrimonio' && (
        <PatrimonioTab
          state={state}
          update={update}
          totalPatrimonio={totalPatrimonio}
          savingsComputed={savingsComputed}
        />
      )}
    </div>
  );
}
