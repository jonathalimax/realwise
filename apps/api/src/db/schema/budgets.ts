import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { budgetPeriodEnum } from './enums';
import { users } from './users';
import { categories } from './categories';

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  period: budgetPeriodEnum('period'),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
