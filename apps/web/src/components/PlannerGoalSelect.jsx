import { useSettings } from '../contexts/SettingsContext';
import usePlannerGoals from '../pages/planner/usePlannerGoals';

export default function PlannerGoalSelect({
  value,
  onChange,
  label,
  emptyLabel,
  containerClassName = '',
  selectClassName = '',
  selectProps = {},
}) {
  const { language } = useSettings();
  const plannerGoals = usePlannerGoals();

  const resolvedLabel = label || (language === 'pt' ? 'Objetivo do planner' : 'Planner objective');
  const resolvedEmptyLabel = emptyLabel || (language === 'pt' ? 'Nenhuma' : 'None');

  return (
    <div className={containerClassName}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {resolvedLabel}
      </label>
      {plannerGoals.length > 0 ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClassName}
          {...selectProps}
        >
          <option value="">{resolvedEmptyLabel}</option>
          {plannerGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.layerLabel ? `${goal.layerLabel} › ${goal.label}` : goal.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Nenhum objetivo de investimento configurado no planner. Acesse o planejador para criar objetivos de investimento nas camadas de wallet.
          </p>
        </div>
      )}
    </div>
  );
}
