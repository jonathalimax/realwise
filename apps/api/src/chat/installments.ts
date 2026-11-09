/**
 * Installment ("parcela") helpers for statement imports. Pure functions: a line like "LOJA X PARC 03/12" becomes
 * installment 3 of 12, and the 9 remaining ones are projected into the following months.
 */
import { createHash } from 'crypto';
import { extractPattern } from './pattern';

export const MAX_INSTALLMENTS = 48;

export interface InstallmentInfo {
  current: number;
  total: number;
}

const valid = (current: number, total: number) =>
  Number.isInteger(current) && Number.isInteger(total) && total >= 2 && total <= MAX_INSTALLMENTS && current >= 1 && current <= total;

/**
 * The model passes installmentCurrent / installmentTotal when the statement shows them. As a safety net the
 * description is also read, but only with the word PARC/PARCELA: a bare "05/12" is far more often a date.
 */
export function installmentOf(fields: { installmentCurrent?: unknown; installmentTotal?: unknown }, description: string): InstallmentInfo | null {
  const c = Number(fields.installmentCurrent);
  const t = Number(fields.installmentTotal);
  if (valid(c, t)) return { current: c, total: t };
  const m = description.match(/\bPARC(?:ELA)?S?\.?\s*(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\b/i);
  if (m && valid(Number(m[1]), Number(m[2]))) return { current: Number(m[1]), total: Number(m[2]) };
  return null;
}

/** The description without the "PARC 03/12" noise, so the app can append its own " (3/12)". */
export function cleanInstallmentDescription(description: string): string {
  return description
    .replace(/\s*\(?\bPARC(?:ELA)?S?\.?\s*\d{1,2}\s*(?:\/|DE)\s*\d{1,2}\)?/gi, '')
    .replace(/\s*\(\s*\d{1,2}\s*\/\s*\d{1,2}\s*\)\s*$/g, '')
    .replace(/\s+\d{1,2}\s*\/\s*\d{1,2}\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const installmentLabel = (description: string, current: number, total: number) =>
  `${cleanInstallmentDescription(description)} (${current}/${total})`;

/** Moves an ISO date by whole months, keeping the day (clamped to the end of shorter months). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/**
 * Same plan => same id, whichever month's statement it came from: merchant, account, number of installments, amount
 * and the month installment 1 was charged. That makes re-sent statements and next month's real line find the
 * projected rows instead of duplicating them.
 */
export function installmentGroupId(userId: string, accountId: string, description: string, amount: number, date: string, info: InstallmentInfo): string {
  const firstMonth = addMonths(date, -(info.current - 1)).slice(0, 7);
  const key = [userId, accountId, extractPattern(cleanInstallmentDescription(description)), info.total, amount.toFixed(2), firstMonth].join('|');
  return createHash('sha1').update(key).digest('hex').slice(0, 32);
}

const monthIndex = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  return y * 12 + (m - 1);
};

/** Same merchant even when the model wrote the name a little differently ("MULTI" vs "MULTI SERVICOS"). */
const samePattern = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

export interface ExistingInstallment {
  groupId: string | null;
  description: string;
  amount: string | number;
  current: number | null;
  total: number | null;
  date: string;
  auto: boolean;
}

/**
 * Finds the plan an incoming installment line already belongs to, so a re-sent or re-read statement never starts a
 * second copy of it. installmentGroupId() alone is exact: if the model reports a different statement month (closing vs
 * due month) or the invoice date lands one month off, it computes a different "first month" and the same parcel is
 * created again. So before trusting it, look for a saved plan with the same merchant, total and amount:
 *   1. the same first month, or
 *   2. the same installment number already saved as a real (not projected) row within one month of this charge.
 */
export function findExistingPlanGroup(
  existing: ExistingInstallment[],
  info: InstallmentInfo,
  description: string,
  amount: number,
  chargeDate: string,
): string | null {
  const pattern = extractPattern(cleanInstallmentDescription(description));
  const first = monthIndex(chargeDate) - (info.current - 1);
  let near: string | null = null;
  for (const e of existing) {
    if (!e.groupId || e.current == null || e.total !== info.total) continue;
    if (Math.abs(Number(e.amount) - amount) > 0.05) continue;
    if (!samePattern(extractPattern(cleanInstallmentDescription(e.description)), pattern)) continue;
    if (monthIndex(e.date) - (e.current - 1) === first) return e.groupId;
    if (!near && !e.auto && e.current === info.current && Math.abs(monthIndex(e.date) - monthIndex(chargeDate)) <= 1) near = e.groupId;
  }
  return near;
}

export const installmentHash = (groupId: string, current: number) => `inst:${groupId}:${current}`;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (v: unknown): v is string => typeof v === 'string' && MONTH_RE.test(v);

/**
 * Card invoices print the ORIGINAL purchase date on an installment line ("12 dez 2025 - MULTI (Parcela 11 de 18)"), but
 * installment 11 is charged in the month the invoice covers. For installments after the first, an older date is moved
 * into the statement's month (same day, clamped), so the plan continues from there and never lands in past months.
 */
export function installmentChargeDate(date: string, info: InstallmentInfo, statementMonth: string | null): string {
  if (!statementMonth || info.current <= 1 || date.slice(0, 7) >= statementMonth) return date;
  const [y, m] = statementMonth.split('-').map(Number);
  const [dy, dm] = date.split('-').map(Number);
  return addMonths(date, (y - dy) * 12 + (m - dm));
}

/** The month a statement covers: the one the model reported, else the most common month among its ordinary lines. */
export function statementMonthOf(reported: unknown, ordinaryDates: string[]): string | null {
  if (isMonth(reported)) return reported;
  const counts = new Map<string, number>();
  for (const d of ordinaryDates) counts.set(d.slice(0, 7), (counts.get(d.slice(0, 7)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
