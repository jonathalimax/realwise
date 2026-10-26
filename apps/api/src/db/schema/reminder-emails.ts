import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/** One row per reminder actually sent; the unique index is what makes the daily job idempotent. */
export const reminderEmailsSent = pgTable(
  'reminder_emails_sent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    kind: varchar('kind').notNull(),
    periodKey: varchar('period_key').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('reminder_emails_sent_unique_idx').on(t.userId, t.kind, t.periodKey)],
);
