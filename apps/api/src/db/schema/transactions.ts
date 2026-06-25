import { pgTable, uuid, varchar, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { transactionTypeEnum } from './enums';
import { users } from './users';
import { categories } from './categories';
import { accounts } from './accounts';

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: transactionTypeEnum('type').notNull(),
  description: varchar('description'),
  date: date('date').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  accountId: uuid('account_id').references(() => accounts.id),
  importId: uuid('import_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
