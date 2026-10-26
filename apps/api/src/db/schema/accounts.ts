import { pgTable, uuid, varchar, numeric, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { accountTypeEnum } from './enums';
import { users } from './users';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  type: accountTypeEnum('type'),
  bankId: varchar('bank_id'),
  cardName: varchar('card_name'),
  customBankName: varchar('custom_bank_name'),
  // Name of the person the account belongs to (the user, their spouse...). Used to recognise transfers between own accounts.
  holderName: varchar('holder_name'),
  hasCredit: boolean('has_credit').default(false),
  closingDay: integer('closing_day'),
  paymentDay: integer('payment_day'),
  color: varchar('color'),
  icon: varchar('icon'),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0'),
  // Soft delete: rows are hidden, never destroyed. Every read path must filter on this.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
