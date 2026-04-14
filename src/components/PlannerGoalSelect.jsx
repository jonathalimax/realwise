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

  if (plannerGoals.length === 0) return null;

  const resolvedLabel = label || (language === 'pt' ? 'Camada do planejador' : 'Planner sublayer');
  const resolvedEmptyLabel = emptyLabel || (language === 'pt' ? 'Nenhuma' : 'None');

  return (
    <div className={containerClassName}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {resolvedLabel}
      </label>
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
    </div>
  );
}
