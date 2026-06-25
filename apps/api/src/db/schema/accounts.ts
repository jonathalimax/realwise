import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { accountTypeEnum } from './enums';
import { users } from './users';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  type: accountTypeEnum('type'),
  color: varchar('color'),
  icon: varchar('icon'),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
