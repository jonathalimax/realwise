/** A multiple-choice question Elio shows the user as a sheet (account, payment method, free choice). */
export interface ChatQuestion {
  id: string;
  kind: 'account' | 'payment_method' | 'choice' | 'confirm' | 'account_form';
  title: string;
  subtitle?: string;
  /** Attachment this question is about, if any. */
  fileName?: string;
  options: { value: string; label: string; hint?: string }[];
  /** Lets the user type a new account name instead of picking one. */
  allowNew?: boolean;
  /** Human-readable lines describing what a `confirm` question will change. */
  preview?: string[];
  /** Renders the confirm button as destructive (deletes). */
  danger?: boolean;
  /**
   * For `confirm`: the exact operation to run if the user agrees. Kept server-side and re-read from the
   * stored message when answered, so neither the model nor the client can alter it after the user saw the preview.
   */
  action?: { tool: 'update_records' | 'delete_records'; args: Record<string, unknown> };
  /** Set once the user has answered. */
  answer?: { value: string; label: string };
}

/** Rows saved with a doubtful category, grouped by merchant, awaiting the user's confirmation. */
/** One saved transaction inside a review group, with what the user needs to recognise it. */
export interface ReviewItem {
  id: string;
  date: string;
  /** Full description as printed on the statement. */
  description: string;
  amount: number;
  paymentMethod: string | null;
}

export interface ReviewGroup {
  key: string;
  merchant: string;
  type: 'income' | 'expense';
  count: number;
  total: number;
  transactionIds: string[];
  /** Up to MAX_REVIEW_ITEMS of the group's transactions, for display (count/total/ids cover all of them). */
  items: ReviewItem[];
  /** Name of the account these were saved to. */
  account: string | null;
  /** True when Elio thinks these may be transfers between the user's own accounts and wants a yes/no. */
  transferAsk?: boolean;
  /** The category the row was saved with, if any. */
  currentCategoryId: string | null;
  /** Up to 3 categories Elio considers plausible, best first. */
  suggestionIds: string[];
}

export interface ReviewPayload {
  groups: ReviewGroup[];
  categories: { id: string; name: string; type: string | null }[];
  resolved: boolean;
}

export const PAYMENT_METHODS = ['credit', 'debit', 'pix', 'transfer', 'boleto', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Live events for the streaming chat endpoints (Server-Sent Events). */
export type ChatStreamEvent =
  | { type: 'user'; message: unknown } // the persisted user message
  | { type: 'delta'; text: string } // a piece of the reply, as the model writes it
  | { type: 'reset' } // discard streamed text: the model moved on to run tools
  | { type: 'status'; label: string } // what Elio is doing ("Salvando transações…")
  | { type: 'done'; result: unknown } // final persisted result, same shape as the non-streaming JSON
  | { type: 'error'; message: string; status: number; code?: string };

export const TOOL_STATUS: Record<string, string> = {
  save_transactions: 'Salvando as transações…',
  create_account: 'Criando a conta…',
  create_category: 'Criando a categoria…',
  create_bill: 'Cadastrando a conta a pagar…',
  list_pending_bills: 'Olhando suas contas…',
  mark_bills_paid: 'Marcando as contas como pagas…',
  set_category_rule: 'Lembrando a categoria…',
  query_transactions: 'Consultando seus lançamentos…',
  summarize_transactions: 'Calculando os totais…',
  find_records: 'Procurando os registros…',
  update_records: 'Aplicando a alteração…',
  delete_records: 'Preparando a exclusão…',
  restore_records: 'Restaurando…',
  ask_user: 'Preparando uma pergunta…',
  remember_fact: 'Anotando isso…',
  forget_fact: 'Esquecendo isso…',
  set_monthly_income: 'Anotando sua renda…',
  set_budget_plan: 'Montando seu plano…',
};

export const MAX_REVIEW_ITEMS = 40;
