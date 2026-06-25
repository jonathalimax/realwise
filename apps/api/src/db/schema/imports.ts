import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { importStatusEnum } from './enums';
import { users } from './users';

export const imports = pgTable('imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  bank: varchar('bank'),
  status: importStatusEnum('status').default('pending'),
  rowCount: integer('row_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
