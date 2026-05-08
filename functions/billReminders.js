'use strict';

/**
 * Discovers userIds that have bills overdue or due today in a client Firestore.
 * Returns only users who need an email (overdue or due today).
 */
async function collectClientUserIds(clientDb) {
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const billsSnap = await clientDb.collection('bills')
    .where('status', '==', 'pending')
    .get();

  const userIds = new Set();
  for (const doc of billsSnap.docs) {
    const data = doc.data();
    if (!data.userId || !data.dueDate) continue;
    const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
    if (due < thirtyDaysAgo || due > endOfToday) continue;
    userIds.add(data.userId);
  }
  return [...userIds];
}

/**
 * Fetches, categorizes, normalizes, and enriches pending bills for one user
 * from a given client Firestore instance.
 */
async function collectUserBillGroups(clientDb, userId) {
  const now = new Date();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(23, 59, 59, 999);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const billsSnap = await clientDb.collection('bills')
    .where('userId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const groups = { overdue: [], dueToday: [], upcoming: [] };
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
    } else if (due <= nextWeek) {
      groups.upcoming.push(bill);
    }
  }

  // Enrich credit card bills with actual transaction totals
  try {
    const transactionsSnap = await clientDb.collection('transactions')
      .where('userId', '==', userId)
      .where('date', '>=', new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .get();
    const transactions = transactionsSnap.docs.map(d => d.data());

    const banksSnap = await clientDb.collection('userBanks')
      .where('userId', '==', userId)
      .get();
    const banks = banksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const list of [groups.overdue, groups.dueToday, groups.upcoming]) {
      for (const bill of list) {
        if (bill.category !== 'credit_card' || !bill.linkedBankId) continue;
        const bank = banks.find(b => b.id === bill.linkedBankId);
        if (!bank || !bank.hasCredit) continue;

        const billDue = new Date(bill.dueDate);
        const closingDay = bank.closingDay || 10;
        const cycleEnd = new Date(billDue); cycleEnd.setDate(closingDay);
        if (cycleEnd > billDue) cycleEnd.setMonth(cycleEnd.getMonth() - 1);
        const cycleStart = new Date(cycleEnd);
        cycleStart.setMonth(cycleStart.getMonth() - 1);
        cycleStart.setDate(cycleStart.getDate() + 1);

        const cycleTxs = transactions.filter(tx => {
          if (tx.cardId !== bill.linkedBankId || tx.type !== 'expense') return false;
          const txDate = new Date(tx.date);
          return txDate >= cycleStart && txDate <= cycleEnd;
        });
        bill.cardOutcomesAmount = cycleTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        bill.cardOutcomesCount = cycleTxs.length;
      }
    }
  } catch (err) {
    console.error(`[billReminders] Card enrichment error for user ${userId}:`, err);
  }

  return groups;
}

module.exports = { collectClientUserIds, collectUserBillGroups };
