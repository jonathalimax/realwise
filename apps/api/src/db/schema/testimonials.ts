import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseDocId: varchar('firebase_doc_id').unique(),
  name: varchar('name').notNull(),
  role: varchar('role'),
  text: text('text').notNull(),
  avatar: varchar('avatar').default('👤').notNull(),
  rating: integer('rating').default(5).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
