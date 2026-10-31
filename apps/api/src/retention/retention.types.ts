/** Same keys Stripe accepts as `cancellation_details.feedback`, so the reason also shows up in the Stripe dashboard. */
export const CANCEL_REASONS = ['too_expensive', 'missing_features', 'switched_service', 'unused', 'customer_service', 'too_complex', 'low_quality', 'other'] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export type OfferKind = 'discount' | 'free_month';
export type FeedbackOutcome = 'pending' | 'accepted' | 'declined' | 'cancelled';

/** Stored under app_settings key `retention`; editable in Admin → Cancelamentos. */
export interface RetentionSettings {
  /** Show a save offer before cancelling. The cancel button always works either way. */
  enabled: boolean;
  discountPercent: number;
  discountMonths: number;
  freeMonthEnabled: boolean;
  /** Win-back code sent to people who left (30 and 60 days after). */
  winbackPercent: number;
  winbackMonths: number;
  winbackValidDays: number;
}

export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = {
  enabled: true,
  discountPercent: 50,
  discountMonths: 3,
  freeMonthEnabled: true,
  winbackPercent: 30,
  winbackMonths: 3,
  winbackValidDays: 14,
};

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeRetention(raw: Partial<RetentionSettings> | undefined): RetentionSettings {
  const d = DEFAULT_RETENTION_SETTINGS;
  const r = raw ?? {};
  return {
    enabled: r.enabled ?? d.enabled,
    discountPercent: clamp(r.discountPercent, 5, 90, d.discountPercent),
    discountMonths: clamp(r.discountMonths, 1, 12, d.discountMonths),
    freeMonthEnabled: r.freeMonthEnabled ?? d.freeMonthEnabled,
    winbackPercent: clamp(r.winbackPercent, 5, 90, d.winbackPercent),
    winbackMonths: clamp(r.winbackMonths, 1, 12, d.winbackMonths),
    winbackValidDays: clamp(r.winbackValidDays, 3, 60, d.winbackValidDays),
  };
}

export interface Offer {
  kind: OfferKind;
  title: string;
  description: string;
}

/** Which save offer (if any) fits a cancellation reason. Pure; eligibility (one per customer etc.) is checked by the caller. */
export function offerFor(reason: CancelReason, s: RetentionSettings): Offer | null {
  if (!s.enabled) return null;
  if (reason === 'too_expensive' || reason === 'switched_service') {
    return {
      kind: 'discount',
      title: `${s.discountPercent}% de desconto por ${s.discountMonths} ${s.discountMonths === 1 ? 'mês' : 'meses'}`,
      description: `Fique com o Realwise pagando ${s.discountPercent}% a menos nas próximas ${s.discountMonths} ${s.discountMonths === 1 ? 'cobrança' : 'cobranças'}. Depois, o valor volta ao normal e você continua podendo cancelar quando quiser.`,
    };
  }
  if (reason === 'unused' && s.freeMonthEnabled) {
    return {
      kind: 'free_month',
      title: '1 mês grátis para voltar a usar',
      description: 'Sua próxima cobrança é por nossa conta. É um mês para o Elio entrar na sua rotina: mande um extrato ou anote um gasto e veja se faz diferença.',
    };
  }
  return null;
}
