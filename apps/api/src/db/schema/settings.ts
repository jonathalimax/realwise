import { pgTable, uuid, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const settings = pgTable(
  'settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    currency: varchar('currency').default('BRL').notNull(),
    language: varchar('language').default('pt-BR').notNull(),
    darkMode: boolean('dark_mode').default(false).notNull(),
    billReminders: boolean('bill_reminders').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('settings_client_user_idx').on(table.clientId, table.userId),
  ],
);
