import { Badge } from './ui';
import { date } from '../lib/format';

export const ACCESS_STATES = [
  { value: 'trial', label: 'Em teste', tone: 'amber' },
  { value: 'subscribed', label: 'Assinante', tone: 'green' },
  { value: 'lifetime', label: 'Vitalício', tone: 'purple' },
  { value: 'blocked', label: 'Bloqueado', tone: 'red' },
  { value: 'owner', label: 'Proprietário', tone: 'blue' },
];

export function accessMeta(state) {
  return ACCESS_STATES.find((s) => s.value === state) ?? { value: state, label: state || '—', tone: 'gray' };
}

const PLAN_LABELS = { monthly: 'Mensal', annual: 'Anual', lifetime: 'Vitalício' };

export function planLabel(plan) {
  return PLAN_LABELS[plan] ?? plan ?? null;
}

export function AccessBadge({ access }) {
  const meta = accessMeta(access?.state);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge tone={meta.tone}>{meta.label}{planLabel(access?.plan) ? ` · ${planLabel(access.plan)}` : ''}</Badge>
      {access?.state === 'trial' && access?.trialEndsAt && (
        <span className="text-[10px] text-gray-500">até {date(access.trialEndsAt)}</span>
      )}
    </span>
  );
}
