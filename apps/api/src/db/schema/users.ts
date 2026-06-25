import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    email: varchar('email').notNull(),
    name: varchar('name'),
    firebaseUid: varchar('firebase_uid').unique(),
    appleId: varchar('apple_id').unique(),
    role: userRoleEnum('role').default('user').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_client_email_idx').on(table.clientId, table.email),
  ],
);
