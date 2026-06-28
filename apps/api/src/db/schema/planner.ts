import { pgTable, uuid, varchar, numeric, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

export const planner = pgTable(
  'planner',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    salaryGross: numeric('salary_gross', { precision: 12, scale: 2 }),
    deductions: jsonb('deductions'),
    allocations: jsonb('allocations'),
    state: jsonb('state'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('planner_client_user_idx').on(table.clientId, table.userId),
  ],
);
