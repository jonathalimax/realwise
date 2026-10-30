import { integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Fixed explanations Elio shows verbatim (welcome, how the app works, how to import...). Stored in the database so
 * they cost no model tokens and can be edited without a deploy. `triggerLabel` is the text of the quick-reply chip
 * that opens it: tapping that chip is answered straight from here, without calling the model at all.
 */
export const chatSnippets = pgTable('chat_snippets', {
  key: varchar('key', { length: 40 }).primaryKey(),
  title: varchar('title', { length: 120 }).notNull(),
  body: text('body').notNull(),
  /** Chips offered right after the snippet (plain strings). */
  quickReplies: jsonb('quick_replies').$type<string[]>().notNull().default([]),
  triggerLabel: varchar('trigger_label', { length: 80 }),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
