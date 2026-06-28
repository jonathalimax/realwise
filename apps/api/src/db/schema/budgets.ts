import { pgTable, uuid, varchar, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { budgetPeriodEnum } from './enums';
import { users } from './users';
import { categories } from './categories';

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  period: budgetPeriodEnum('period'),
  categoryId: uuid('category_id').references(() => categories.id),
  month: varchar('month'),
  totalBudget: numeric('total_budget', { precision: 12, scale: 2 }),
  categoryBudgets: jsonb('category_budgets'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
