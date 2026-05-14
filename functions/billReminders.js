'use strict';

/**
 * Discovers userIds that have bills overdue, due today, or due in the next 1-3 days.
 */
async function collectClientUserIds(clientDb) {
  const endOfDueSoon = new Date();
  endOfDueSoon.setDate(endOfDueSoon.getDate() + 3);
  endOfDueSoon.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const billsSnap = await clientDb.collection('bills')
    .where('status', '==', 'pending')
    .get();

  const userIds = new Set();
  for (const doc of billsSnap.docs) {
    const data = doc.data();
    if (!data.userId || !data.dueDate) continue;
    const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    // Include overdue, today, and 1-3 days ahead; skip older than 30 days or further than 3 days
    if (due < thirtyDaysAgo || due > endOfDueSoon) continue;
    userIds.add(data.userId);
  }
  return [...userIds];
}

/**
 * Fetches, categorizes, normalizes, and enriches pending bills for one user.
 * Returns groups: overdue, dueToday, dueSoon (1-3 days), upcoming (4-7 days).
 */
async function collectUserBillGroups(clientDb, userId) {
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const endOfDueSoon = new Date(); endOfDueSoon.setDate(endOfDueSoon.getDate() + 3); endOfDueSoon.setHours(23, 59, 59, 999);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const billsSnap = await clientDb.collection('bills')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const groups = { overdue: [], dueToday: [], dueSoon: [], upcoming: [] };
  for (const doc of billsSnap.docs) {
    const data = doc.data();
    if (!data.dueDate) continue;
    const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    if (due < thirtyDaysAgo) continue;

    const bill = { id: doc.id, ...data, dueDate: due.toISOString() };
    if (due < today) {
      bill.daysOverdue = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
      groups.overdue.push(bill);
    } else if (due <= endOfToday) {
      groups.dueToday.push(bill);
    } else if (due <= endOfDueSoon) {
      groups.dueSoon.push(bill);
    } else if (due <= nextWeek) {
      groups.upcoming.push(bill);
    }
  }

  return groups;
}

module.exports = { collectClientUserIds, collectUserBillGroups };
