/**
 * Groups an already-sorted transaction array by calendar date.
 * @param {Array<{date: string}>} sortedTransactions
 * @returns {Array<{date: string, transactions: Array}>}
 */
export function groupByDate(sortedTransactions) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;

  for (const t of sortedTransactions) {
    const date = t.date ? t.date.split('T')[0] : 'unknown';
    if (date !== currentDate) {
      currentDate = date;
      currentGroup = { date, transactions: [] };
      groups.push(currentGroup);
    }
    currentGroup.transactions.push(t);
  }

  return groups;
}
