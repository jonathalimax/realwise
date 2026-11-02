import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/** One row per browser/device that opted in to web push. The endpoint is unique per device. */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: varchar('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
