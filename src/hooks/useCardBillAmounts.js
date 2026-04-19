import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';

/**
 * Computes invoice totals for credit card bills by summing credit transactions
 * that belong to each bill's billing period.
 *
 * @param {Array} bills - Full bills array from useBills()
 * @param {string} selectedMonth - 'YYYY-MM' format
 * @returns {Map<string, number>} Map of billId → computed invoice amount
 */
export default function useCardBillAmounts(bills, selectedMonth) {
  const { ownerId } = useAccess();
  const { getPaymentMonthKey } = useCards();
  const [amounts, setAmounts] = useState(new Map());

  // Identify card bills and their linked bank IDs
  const cardBills = useMemo(
    () => bills.filter(b => b.linkedBankId && b.category === 'credit_card'),
    [bills]
  );

  const linkedBankIds = useMemo(
    () => [...new Set(cardBills.map(b => b.linkedBankId))],
    [cardBills]
  );

  useEffect(() => {
    if (!ownerId || !selectedMonth || linkedBankIds.length === 0) {
      setAmounts(new Map());
      return;
    }

    // Firestore 'in' queries support max 30 values — batch if needed
    const batches = [];
    for (let i = 0; i < linkedBankIds.length; i += 30) {
      batches.push(linkedBankIds.slice(i, i + 30));
    }

    const unsubscribes = batches.map(batch => {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', ownerId),
        where('bankId', 'in', batch),
        where('type', '==', 'expense')
      );

      return onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter to credit-only (or legacy undefined paymentMethod)
        const creditTxs = txs.filter(
          tx => !tx.paymentMethod || tx.paymentMethod === 'credit'
        );

        // Sum per (bankId, paymentMonthKey)
        const sumByBankMonth = new Map(); // key: `${bankId}::${monthKey}`
        for (const tx of creditTxs) {
          const monthKey = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
          const key = `${tx.bankId}::${monthKey}`;
          sumByBankMonth.set(key, (sumByBankMonth.get(key) ?? 0) + Math.abs(tx.amount));
        }

        // Map bill IDs to their computed amount for selectedMonth
        setAmounts(prev => {
          const next = new Map(prev);
          for (const bill of cardBills) {
            const key = `${bill.linkedBankId}::${selectedMonth}`;
            next.set(bill.id, sumByBankMonth.get(key) ?? 0);
          }
          return next;
        });
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [ownerId, selectedMonth, linkedBankIds, cardBills, getPaymentMonthKey]);

  return amounts;
}
