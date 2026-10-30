export type SummaryKind = 'monthly' | 'on_demand' | 'trial_end';
/** proud / steady / improve are scored; incomplete = not enough clean data for a fair verdict; trial = the trial recap. */
export type SummaryTone = 'proud' | 'steady' | 'improve' | 'incomplete' | 'trial';

export interface TxRow {
  /** YYYY-MM-DD */
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string | null;
  bankId: string | null;
  paymentMethod: string | null;
  investmentId: string | null;
  goalId: string | null;
}

export interface CardRow {
  id: string;
  bankId: string | null;
  hasCredit: boolean;
  closingDay: number | null;
  paymentDay: number | null;
}

export interface BillRow {
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | null;
}

export interface PlannerMonth {
  /** Planned take-home income for the month. */
  net: number;
  allocation: { necessidades: number; desejos: number; poupanca: number };
}

export interface SummaryInput {
  kind: SummaryKind;
  /** YYYY-MM the summary is about (for a trial summary: the month the trial ended in). */
  month: string;
  /** YYYY-MM-DD in Brasília time. */
  today: string;
  firstName: string | null;
  transactions: TxRow[];
  cards: CardRow[];
  bills: BillRow[];
  planner: PlannerMonth | null;
  /** Month still in progress (on-demand for the current month): comparisons with a full month are skipped. */
  partial: boolean;
  /** Trial summary window, YYYY-MM-DD (inclusive). */
  trialWindow?: { from: string; to: string };
}

export interface FlowSegment {
  key: string;
  label: string;
  amount: number;
  /** Share of income, 0-100+ (can pass 100 when spending beat income). */
  pct: number;
  /** Index into the shared palette; the UI maps it to a colour. */
  tone: 'slate' | 'violet' | 'sky' | 'pink' | 'amber' | 'saved' | 'left';
}

export interface CategoryRow {
  name: string;
  amount: number;
  /** Change versus the previous month, percent; null when there is nothing to compare. */
  deltaPct: number | null;
}

export interface TrendPoint {
  month: string;
  label: string;
  income: number;
  spent: number;
}

export interface BudgetRow {
  key: 'needs' | 'wants' | 'savings';
  label: string;
  /** left = under the limit, over = past it, goal = savings goal reached, missing = savings still to go. */
  state: 'left' | 'over' | 'goal' | 'missing';
  amount: number;
  usedPct: number;
}

export interface Insight {
  title: string;
  detail: string;
  /** Monthly amount this would free up, when it is a fix. */
  frees?: number;
  urgent?: boolean;
  href?: string;
}

export interface MissingStep {
  key: 'income' | 'statement' | 'categories';
  title: string;
  detail: string;
  ctaLabel: string;
  ctaPath: string;
}

export interface SummaryPayload {
  version: 1;
  kind: SummaryKind;
  tone: SummaryTone;
  period: { month: string; label: string; monthName: string; partial: boolean; prevMonthName: string | null; windowLabel?: string };
  firstName: string | null;
  headline: string;
  subline: string;
  score: number | null;
  scoreLabel: string | null;
  scoreDelta: number | null;
  totals: {
    income: number;
    /** Everything spent, excluding money moved to investments (which counts as saved). */
    spent: number;
    invested: number;
    /** Income minus spent minus invested; negative = spent more than came in. */
    left: number;
    savingRate: number | null;
    spentChangePct: number | null;
  };
  flow: { segments: FlowSegment[]; totalPct: number; overflow: boolean };
  categories: CategoryRow[];
  trend: TrendPoint[];
  budget: BudgetRow[] | null;
  streak: { monthsInBlue: number; months: { month: string; label: string; blue: boolean }[] };
  wins: Insight[];
  fixes: Insight[];
  nextStep: { eyebrow: string; text: string; ctaLabel: string; ctaPath: string; secondary?: { label: string; path: string } };
  share: { value: string; caption: string; footer: string | null } | null;
  quality: { categorizedPct: number; transactionCount: number; uncategorizedAmount: number };
  /** Only for the 'incomplete' tone. */
  missing: MissingStep[];
  /** Only for the 'trial' tone. */
  trial: { days: number; transactionCount: number } | null;
}
