export const ENGAGEMENT_KINDS = ['trial_import', 'trial_ending', 'trial_expired', 'monthly_import'] as const;
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
      trial_import: { enabled: true },
      trial_ending: { enabled: true },
      trial_expired: { enabled: true },
      monthly_import: { enabled: true },
    },
  },
  billReminders: { enabled: true, hourBrt: 9 },
};
