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

export const installmentHash = (groupId: string, current: number) => `inst:${groupId}:${current}`;
