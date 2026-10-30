import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * A generated financial summary (the "Seu mês" recap), kept so the e-mailed link keeps working and so it is never sent
 * twice. `token` is the secret in the private page link; the row expires after 30 days.
 * kind: 'monthly' (the scheduled recap of a closed month), 'on_demand' (asked for, may be month-to-date) or
 * 'trial_end' (what Elio found during the trial). period: 'YYYY-MM', or the end date for a trial summary.
 */
export const financialSummaries = pgTable(
  'financial_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    clientId: varchar('client_id').notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    period: varchar('period', { length: 16 }).notNull(),
    token: varchar('token', { length: 64 }).notNull(),
    /** 'proud' | 'steady' | 'improve' | 'incomplete' | 'trial' */
    tone: varchar('tone', { length: 12 }).notNull(),
    score: integer('score'),
    payload: jsonb('payload').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('financial_summaries_token_idx').on(t.token),
    uniqueIndex('financial_summaries_user_period_idx').on(t.userId, t.kind, t.period),
  ],
);
