import { pgTable, uuid, varchar, numeric, integer, timestamp } from 'drizzle-orm/pg-core';

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  code: varchar('code').unique().notNull(),
  discountType: varchar('discount_type'),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
