import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { imports } from './imports';

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  importId: uuid('import_id').references(() => imports.id),
  objectKey: varchar('object_key').notNull(),
  mimeType: varchar('mime_type'),
  sizeBytes: integer('size_bytes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
