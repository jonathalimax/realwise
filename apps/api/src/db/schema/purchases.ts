import { pgTable, uuid, varchar, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  clientId: varchar('client_id').notNull(),
  email: varchar('email').notNull(),
  plan: varchar('plan'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  status: varchar('status').default('pending'),
  paymentProvider: varchar('payment_provider'),
  providerPaymentId: varchar('provider_payment_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
