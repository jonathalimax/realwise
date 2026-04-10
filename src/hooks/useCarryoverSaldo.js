import { useMemo } from 'react';

/**
 * Extracts the YYYY-MM month key from an ISO date string (YYYY-MM-DD...)
 * without UTC timezone conversion issues.
 */
function getMonthKeyFromDateString(dateStr) {
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  // Fallback to Date object parsing if format doesn't match
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Pure computation — exported for unit testing.
 *
 * Groups all non-ignored transactions by their effective month key,
 * accumulates a running balance across months in chronological order,
 * and returns:
 *   - carryoverSaldo: cumulative balance of all months strictly before selectedMonth
 *   - cumulativeByMonth: { 'YYYY-MM': runningBalance } for every month that has data
 *
 * Month key rules match the dashboard filter logic:
 *   viewMode='purchase' → always use transaction date
 *   viewMode='payment'  → income uses transaction date; expenses use getPaymentMonthKey()
 */
export function computeCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey) {
  const byMonth = {};

  for (const t of allTransactions) {
    if (t.ignored) continue;

    let monthKey;
    if (viewMode === 'purchase') {
      monthKey = getMonthKeyFromDateString(t.date);
    } else {
      // payment mode
      if (t.type === 'income' || t.investmentId) {
        monthKey = getMonthKeyFromDateString(t.date);
      } else {
        monthKey = getPaymentMonthKey(t.date, t.bankId, t.paymentMethod);
      }
    }

    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    if (t.type === 'income') byMonth[monthKey].income += t.amount;
    else byMonth[monthKey].expense += t.amount;
  }

  const sortedMonths = Object.keys(byMonth).sort();
  const cumulativeByMonth = {};
  let running = 0;

  for (const month of sortedMonths) {
    running += byMonth[month].income - byMonth[month].expense;
    cumulativeByMonth[month] = running;
  }

  // carryoverSaldo = the running total after the last month strictly before selectedMonth
  let carryoverSaldo = 0;
  for (const month of sortedMonths) {
    if (month >= selectedMonth) break;
    carryoverSaldo = cumulativeByMonth[month];
  }

  return { carryoverSaldo, cumulativeByMonth };
}

/**
 * React hook — memoizes computeCarryoverSaldo so it only recomputes
 * when transactions, selectedMonth, or viewMode actually change.
 */
export default function useCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey) {
  return useMemo(
    () => computeCarryoverSaldo(allTransactions, selectedMonth, viewMode, getPaymentMonthKey),
    [allTransactions, selectedMonth, viewMode, getPaymentMonthKey]
  );
}
