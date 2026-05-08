import { useNavigate } from 'react-router-dom';
import usePlannerState from '../pages/planner/usePlannerState';
import { useSettings } from '../contexts/SettingsContext';

export default function PlannerSummaryCard() {
  const navigate = useNavigate();
  const { language, formatCurrency } = useSettings();
  const {
    isLoading,
    liquidezFinal,
    necessidadesValue,
    poupancaValue,
    desejosValue,
    monthAllocation,
  } = usePlannerState();

  const handleClick = () => navigate('/planner?tab=alocacao');

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
        <div className="space-y-3">
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  const rows = [
    {
      label: language === 'pt' ? 'Necessidades' : 'Needs',
      pct: monthAllocation.necessidades,
      value: necessidadesValue,
      color: 'bg-blue-500',
      light: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    },
    {
      label: language === 'pt' ? 'Poupança' : 'Savings',
      pct: monthAllocation.poupanca,
      value: poupancaValue,
      color: 'bg-emerald-500',
      light: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    },
    {
      label: language === 'pt' ? 'Desejos' : 'Wants',
      pct: monthAllocation.desejos,
      value: desejosValue,
      color: 'bg-violet-500',
      light: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
    },
  ];

  return (
    <div
      onClick={handleClick}
      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {language === 'pt' ? 'Planejamento' : 'Planning'}
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatCurrency(liquidezFinal)} {language === 'pt' ? 'líquido' : 'net'}
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <div className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl ${row.light}`}>
              <span className="text-sm font-medium">{row.label}</span>
              <span className="text-sm font-bold tabular-nums">{formatCurrency(row.value)}</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 w-8 text-right tabular-nums">
              {row.pct}%
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-center text-violet-500 dark:text-violet-400 font-medium">
        {language === 'pt' ? 'Ver planejador →' : 'View planner →'}
      </p>
    </div>
  );
}
