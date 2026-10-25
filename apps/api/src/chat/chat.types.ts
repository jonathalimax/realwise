/** A multiple-choice question John shows the user as a sheet (account, payment method, free choice). */
export interface ChatQuestion {
  id: string;
  kind: 'account' | 'payment_method' | 'choice';
  title: string;
  subtitle?: string;
  /** Attachment this question is about, if any. */
  fileName?: string;
  options: { value: string; label: string; hint?: string }[];
  /** Lets the user type a new account name instead of picking one. */
  allowNew?: boolean;
  /** Set once the user has answered. */
  answer?: { value: string; label: string };
}

/** Rows saved with a doubtful category, grouped by merchant, awaiting the user's confirmation. */
export interface ReviewGroup {
  key: string;
  merchant: string;
  type: 'income' | 'expense';
  count: number;
  total: number;
  transactionIds: string[];
  /** The category the row was saved with, if any. */
  currentCategoryId: string | null;
  /** Up to 3 categories John considers plausible, best first. */
  suggestionIds: string[];
}

export interface ReviewPayload {
  groups: ReviewGroup[];
  categories: { id: string; name: string; type: string | null }[];
  resolved: boolean;
}

export const PAYMENT_METHODS = ['credit', 'debit', 'pix', 'transfer', 'boleto', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
