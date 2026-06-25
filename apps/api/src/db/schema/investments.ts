import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { investmentTypeEnum } from './enums';
import { users } from './users';

export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  ticker: varchar('ticker'),
  name: varchar('name').notNull(),
  type: investmentTypeEnum('type').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 8 }),
  avgPrice: numeric('avg_price', { precision: 12, scale: 2 }),
  currentPrice: numeric('current_price', { precision: 12, scale: 2 }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
