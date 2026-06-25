import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { categories } from './categories';

export const categorizationRules = pgTable('categorization_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  keyword: varchar('keyword').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
