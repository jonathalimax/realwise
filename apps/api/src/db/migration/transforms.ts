type Row = Record<string, unknown>;

function toDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate() as Date;
  if (val instanceof Date) return val;
  return new Date(val as string);
}

function toNumericString(val: any): string | null {
  if (val === undefined || val === null) return null;
  return String(val);
}

export function transformUser(docId: string, data: Row, clientId: string) {
  return {
    clientId,
    email: data.email as string,
    name: (data.name as string) ?? null,
    firebaseUid: docId,
    role: 'user' as const,
  };
}

export function transformAccount(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    type: (data.type as string) ?? null,
    color: (data.color as string) ?? null,
    icon: (data.icon as string) ?? null,
    balance: toNumericString(data.balance),
  };
}

export function transformCategory(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    color: (data.color as string) ?? null,
    icon: (data.icon as string) ?? null,
    type: (data.type as string) ?? null,
  };
}

export function transformTransaction(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    amount: toNumericString(data.amount)!,
    type: data.type as string,
    description: (data.description as string) ?? null,
    date: data.date ? String(data.date).slice(0, 10) : null,
    categoryId: (data.categoryId as string) ?? null,
    accountId: (data.bankId as string) ?? (data.accountId as string) ?? null,
    importId: (data.importId as string) ?? null,
  };
}

export function transformBill(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    amount: toNumericString(data.amount)!,
    dueDate: String(data.dueDate).slice(0, 10),
    status: (data.status as string) ?? 'pending',
    recurrence: (data.recurrence as string) ?? null,
    categoryId: (data.categoryId as string) ?? null,
  };
}

export function transformBillReminder(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    billId: data.billId as string,
    remindAt: toDate(data.remindAt)!,
    sent: (data.sent as boolean) ?? false,
    sentVia: (data.sentVia as string) ?? null,
  };
}

export function transformReminderLog(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: `log_${docId}`,
    billId: data.billId as string,
    remindAt: toDate(data.sentAt) ?? toDate(data.remindAt) ?? new Date(),
    sent: true,
    sentVia: (data.sentVia as string) ?? null,
  };
}

export function transformBudget(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    amount: toNumericString(data.amount)!,
    period: (data.period as string) ?? null,
    categoryId: (data.categoryId as string) ?? null,
  };
}

export function transformGoal(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    name: data.name as string,
    targetAmount: toNumericString(data.targetAmount)!,
    currentAmount: toNumericString(data.currentAmount) ?? '0',
    deadline: data.deadline ? String(data.deadline).slice(0, 10) : null,
  };
}

export function transformInvestment(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    ticker: (data.ticker as string) ?? null,
    name: data.name as string,
    type: (data.type as string) ?? 'other',
    quantity: toNumericString(data.quantity),
    avgPrice: toNumericString(data.avgPrice),
    currentPrice: toNumericString(data.currentPrice),
    lastSyncedAt: toDate(data.lastSyncedAt),
  };
}

export function transformPlanner(data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    salaryGross: toNumericString(data.salarioBruto ?? data.salaryGross),
    deductions: (data.salarioDeductions ?? data.deductions ?? null) as object | null,
    allocations: (data.allocations ?? null) as object | null,
  };
}

export function transformSettings(data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    currency: (data.currency as string) ?? 'BRL',
    language: (data.language as string) ?? 'pt-BR',
    darkMode: (data.darkMode as boolean) ?? false,
    billReminders: (data.billReminders as boolean) ?? true,
  };
}

export function transformCategorizationRule(
  docId: string,
  data: Row,
  clientId: string,
  userId: string,
) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    keyword: data.keyword as string,
    categoryId: (data.categoryId as string) ?? null,
  };
}

export function transformImport(docId: string, data: Row, clientId: string, userId: string) {
  return {
    clientId,
    userId,
    firebaseDocId: docId,
    bank: (data.bank as string) ?? null,
    status: (data.status as string) ?? 'complete',
    rowCount: (data.rowCount as number) ?? null,
  };
}

export function transformLead(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    email: data.email as string,
    name: (data.name as string) ?? null,
    plan: (data.plan as string) ?? null,
    status: (data.status as string) ?? 'new',
    metadata: (data.metadata as object) ?? null,
  };
}

export function transformPurchase(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    clientId: (data.clientId as string) ?? (data.tenantId as string) ?? '',
    email: data.email as string,
    plan: (data.plan as string) ?? null,
    amount: toNumericString(data.amount),
    status: (data.status as string) ?? 'pending',
    paymentProvider: (data.paymentProvider as string) ?? null,
    providerPaymentId: (data.providerPaymentId as string) ?? null,
    metadata: (data.metadata as object) ?? null,
  };
}

export function transformCoupon(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    code: data.code as string,
    discountType: (data.discountType as string) ?? null,
    discountValue: toNumericString(data.discountValue),
    maxUses: (data.maxUses as number) ?? null,
    useCount: (data.useCount as number) ?? 0,
    expiresAt: toDate(data.expiresAt),
  };
}

export function transformImportIssue(docId: string, data: Row) {
  return {
    firebaseDocId: docId,
    clientId: (data.clientId as string) ?? '',
    userId: (data.userId as string) ?? null,
    importId: (data.importId as string) ?? null,
    description: (data.description as string) ?? null,
    status: (data.status as string) ?? 'open',
    metadata: (data.metadata as object) ?? null,
  };
}
