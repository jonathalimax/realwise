/** `trial_import` is retired (replaced by the activation_* series) but stays listed so stored settings and sent history keep working. */
export const ENGAGEMENT_KINDS = [
  'welcome',
  'activation_day1',
  'activation_day3',
  'activation_day5',
  'install_app',
  'trial_import',
  'trial_ending',
  'trial_expired',
  'monthly_import',
  'bill_suggestion',
  // Billing recovery and win-back (see retention/ and billing/payment-failed.service.ts).
  'payment_failed',
  'payment_failed_followup',
  'winback_7',
  'winback_30',
  'winback_60',
] as const;
export type EngagementKind = (typeof ENGAGEMENT_KINDS)[number];

/** Stored `ai` setting. Every field is optional: a missing field falls back to env, then to the built-in default. */
export interface AiSettings {
  monthlyBudgetUsd?: number;
  trialBudgetUsd?: number;
  hardCapMultiplier?: number;
  modelChat?: string;
  modelChatLight?: string;
  modelInsights?: string;
  modelFallback?: string;
  promptCache?: boolean;
}

export interface EmailSettings {
  engagement: {
    enabled: boolean;
    hourBrt: number;
    kinds: Record<EngagementKind, { enabled: boolean }>;
  };
  billReminders: { enabled: boolean; hourBrt: number };
}

export type AnnouncementLevel = 'info' | 'warning' | 'promo';

export interface AnnouncementSettings {
  enabled: boolean;
  text: string;
  level: AnnouncementLevel;
  linkLabel?: string | null;
  linkUrl?: string | null;
  /** ISO date-time; the banner stops showing after it. */
  until?: string | null;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  engagement: {
    enabled: true,
    hourBrt: 10,
    kinds: {
      welcome: { enabled: true },
      activation_day1: { enabled: true },
      activation_day3: { enabled: true },
      activation_day5: { enabled: true },
      install_app: { enabled: true },
      trial_import: { enabled: true },
      trial_ending: { enabled: true },
      trial_expired: { enabled: true },
      monthly_import: { enabled: true },
      bill_suggestion: { enabled: true },
      payment_failed: { enabled: true },
      payment_failed_followup: { enabled: true },
      winback_7: { enabled: true },
      winback_30: { enabled: true },
      winback_60: { enabled: true },
    },
  },
  billReminders: { enabled: true, hourBrt: 9 },
};
