import { pgTable, uuid, varchar, numeric, date, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { billStatusEnum, recurrenceTypeEnum } from './enums';
import { users } from './users';
import { categories } from './categories';

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  description: varchar('description'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: varchar('category'),
  dueDate: date('due_date').notNull(),
  status: billStatusEnum('status').default('pending'),
  recurrence: recurrenceTypeEnum('recurrence'),
  recurrenceEndDate: timestamp('recurrence_end_date', { withTimezone: true }),
  notificationEnabled: boolean('notification_enabled').default(true),
  notificationDaysBefore: integer('notification_days_before').default(3),
  linkedBankId: varchar('linked_bank_id'),
  paidDate: timestamp('paid_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }),
  seriesId: varchar('series_id'),
  postponeCount: integer('postpone_count').default(0),
  nextReminderAt: timestamp('next_reminder_at', { withTimezone: true }),
  categoryId: uuid('category_id').references(() => categories.id),
  // Soft delete: rows are hidden, never destroyed. Every read path must filter on this.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
