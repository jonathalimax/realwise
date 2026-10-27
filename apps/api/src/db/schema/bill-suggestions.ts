import { pgTable, uuid, varchar, numeric, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/** A monthly payment Elio noticed in the user's transactions and offers to turn into a reminder (bill). */
export const billSuggestions = pgTable(
  'bill_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    merchantKey: varchar('merchant_key').notNull(),
    name: varchar('name').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    dayOfMonth: integer('day_of_month').notNull(),
    monthsSeen: integer('months_seen').notNull(),
    category: varchar('category'),
    categoryId: uuid('category_id'),
    /** 'pending' | 'emailed' | 'accepted' | 'dismissed' */
    status: varchar('status').notNull().default('pending'),
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('bill_suggestions_user_merchant_idx').on(t.userId, t.merchantKey)],
);
