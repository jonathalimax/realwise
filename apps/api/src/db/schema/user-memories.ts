import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/** A lasting fact the user told Elio (goal, preference, life context). Hard-deleted when the user removes it. */
export const userMemories = pgTable(
  'user_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id),
    content: varchar('content', { length: 240 }).notNull(),
    /** 'goal' | 'preference' | 'context' */
    kind: varchar('kind').notNull().default('context'),
    /** 'chat' (Elio saved it from something the user said) | 'user' (typed in the memory screen) */
    source: varchar('source').notNull().default('chat'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('user_memories_user_idx').on(t.userId)],
);
