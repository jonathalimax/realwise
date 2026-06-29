import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { bills } from './bills';

export const billActionTokens = pgTable('bill_action_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: varchar('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  billId: uuid('bill_id').notNull().references(() => bills.id),
  tokenHash: varchar('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
