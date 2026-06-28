import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit',
  'investment',
  'wallet',
]);

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense']);

export const billStatusEnum = pgEnum('bill_status', ['pending', 'paid', 'overdue']);

export const recurrenceTypeEnum = pgEnum('recurrence_type', ['monthly', 'weekly', 'yearly']);

export const budgetPeriodEnum = pgEnum('budget_period', ['monthly', 'weekly', 'yearly']);

export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'processing',
  'review',
  'complete',
  'failed',
]);

export const investmentTypeEnum = pgEnum('investment_type', [
  'stock',
  'fii',
  'etf',
  'fixed',
  'crypto',
  'other',
  'fixed_income',
  'stocks',
  'funds',
  'real_estate',
]);
