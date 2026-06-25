import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { bills } from './bills';

export const billReminders = pgTable('bill_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  billId: uuid('bill_id').notNull().references(() => bills.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  sent: boolean('sent').default(false).notNull(),
  sentVia: varchar('sent_via'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
