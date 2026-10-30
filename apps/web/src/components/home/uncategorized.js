import { UNCATEGORIZED_CATEGORY } from '../../contexts/SettingsContext';

const NAMES = new Set(Object.values(UNCATEGORIZED_CATEGORY).map((n) => n.toLowerCase()));

/** True for the "no category" bucket in either language (and for a missing category). */
export const isUncategorized = (category) => !category || NAMES.has(String(category).trim().toLowerCase());

const isCountedExpense = (t) => t.type === 'expense' && !t.ignored;

/** Everything except expenses with no category: what the 50/30/20 buckets can fairly be judged on. */
export const withoutUncategorized = (transactions) => transactions.filter((t) => !(isCountedExpense(t) && isUncategorized(t.category)));

/** Total of expenses that have no category yet. */
export const uncategorizedTotal = (transactions) =>
  transactions.filter((t) => isCountedExpense(t) && isUncategorized(t.category)).reduce((s, t) => s + t.amount, 0);
