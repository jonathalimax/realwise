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

  // Enrich credit card bills with the amount due for that bill's payment month,
  // using the same closingDay/paymentDay logic as the app's getPaymentMonth function.
  try {
    const transactionsSnap = await clientDb.collection('transactions')
      .where('userId', '==', userId)
      .where('date', '>=', new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000).toISOString())
      .get();
    const transactions = transactionsSnap.docs.map(d => d.data());

    const banksSnap = await clientDb.collection('userBanks')
      .where('userId', '==', userId)
      .get();
    const banks = banksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Mirrors CardsContext.getPaymentMonth — returns YYYY-MM for a transaction's payment month
    function paymentMonthKey(txDate, closingDay, paymentDay) {
      const d = new Date(txDate);
      let invoiceMonth = d.getMonth();
      let invoiceYear = d.getFullYear();
      if (d.getDate() >= closingDay) {
        invoiceMonth++;
        if (invoiceMonth > 11) { invoiceMonth = 0; invoiceYear++; }
      }
      let payMonth = invoiceMonth;
      let payYear = invoiceYear;
      if (paymentDay <= closingDay) {
        payMonth++;
        if (payMonth > 11) { payMonth = 0; payYear++; }
      }
      return `${payYear}-${String(payMonth + 1).padStart(2, '0')}`;
    }

    for (const list of [groups.overdue, groups.dueToday, groups.dueSoon, groups.upcoming]) {
      for (const bill of list) {
        if (!bill.linkedBankId) {
          // Can't compute amount without a linked bank — zero out stale bill.amount for card-type bills
          const isFaturaBill = bill.category === 'credit_card' || (bill.name || '').toLowerCase().startsWith('fatura');
          if (isFaturaBill) bill.cardOutcomesAmount = 0;
          continue;
        }
        const bank = banks.find(b => b.id === bill.linkedBankId);
        if (!bank || !bank.hasCredit) {
          bill.cardOutcomesAmount = 0;
          continue;
        }

        const billDue = new Date(bill.dueDate);
        const billMonthKey = `${billDue.getFullYear()}-${String(billDue.getMonth() + 1).padStart(2, '0')}`;

        let cycleTxs;
        if (bank.closingDay && bank.paymentDay) {
          // Full payment-month shift: matches how the app groups transactions
          cycleTxs = transactions.filter(tx => {
            if (tx.bankId !== bill.linkedBankId || tx.type !== 'expense') return false;
            if (tx.paymentMethod && tx.paymentMethod !== 'credit') return false;
            return paymentMonthKey(tx.date, bank.closingDay, bank.paymentDay) === billMonthKey;
          });
        } else {
          // Fallback: no card settings — match transactions by calendar month of tx date
          cycleTxs = transactions.filter(tx => {
            if (tx.bankId !== bill.linkedBankId || tx.type !== 'expense') return false;
            if (tx.paymentMethod && tx.paymentMethod !== 'credit') return false;
            const txKey = tx.date ? tx.date.slice(0, 7) : '';
            return txKey === billMonthKey;
          });
        }
        bill.cardOutcomesAmount = cycleTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        console.log(`[billReminders] ${bill.name}: billMonthKey=${billMonthKey} txCount=${cycleTxs.length} amount=${bill.cardOutcomesAmount} (closingDay=${bank.closingDay} paymentDay=${bank.paymentDay})`);
      }
    }
  } catch (err) {
    console.error(`[billReminders] Card enrichment error for user ${userId}:`, err);
  }

  return groups;
}

module.exports = { collectClientUserIds, collectUserBillGroups };
