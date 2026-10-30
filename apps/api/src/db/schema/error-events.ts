import { pgTable, uuid, varchar, integer, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * One row per error we saw: API exceptions (5xx and 4xx), crashes reported by the web app, and failures logged by
 * background work. Metadata only: never request/response bodies, headers or tokens.
 * `user_id` makes the account-deletion job remove a user's rows together with the account.
 */
export const errorEvents = pgTable(
  'error_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Same fingerprint = same problem; the admin groups on it. */
    fingerprint: varchar('fingerprint', { length: 40 }).notNull(),
    /** 'api' (a request failed), 'web' (browser), 'job' (background work / logger.error). */
    source: varchar('source', { length: 16 }).notNull(),
    /** 'error' for 5xx / crashes, 'warn' for 4xx. */
    level: varchar('level', { length: 8 }).notNull().default('error'),
    statusCode: integer('status_code'),
    method: varchar('method', { length: 10 }),
    /** Route pattern (`/bills/:id`), never the raw URL, so ids and query strings are not stored. */
    route: varchar('route', { length: 300 }),
    message: text('message').notNull(),
    stack: text('stack'),
    userId: uuid('user_id'),
    userEmail: varchar('user_email', { length: 320 }),
    appVersion: varchar('app_version', { length: 40 }),
    userAgent: varchar('user_agent', { length: 400 }),
    context: jsonb('context'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('error_events_fingerprint_idx').on(t.fingerprint, t.createdAt),
    index('error_events_created_idx').on(t.createdAt),
    index('error_events_user_idx').on(t.userId),
  ],
);

/** Triage state per fingerprint. A resolved group re-opens by itself when the error shows up again. */
export const errorGroups = pgTable('error_groups', {
  fingerprint: varchar('fingerprint', { length: 40 }).primaryKey(),
  /** 'open' | 'resolved' | 'ignored' */
  status: varchar('status', { length: 12 }).notNull().default('open'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
