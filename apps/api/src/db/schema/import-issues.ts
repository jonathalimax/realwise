import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const importIssues = pgTable('import_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id'),
  importId: uuid('import_id'),
  description: text('description'),
  status: varchar('status').default('open'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
