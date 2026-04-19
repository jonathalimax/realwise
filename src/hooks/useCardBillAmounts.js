import { useState, useEffect, useMemo, useRef } from 'react';
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
  const { getPaymentMonthKey, userBanks } = useCards();
  const [amounts, setAmounts] = useState(new Map());
  // Accumulates per-batch snapshot results to avoid inter-batch overwrite
  const batchResultsRef = useRef(new Map());

  const cardBills = useMemo(
    () => bills.filter(b => b.linkedBankId && b.category === 'credit_card'),
    [bills]
  );

  // For each linked card doc ID, also collect the legacy bankId type string (e.g. 'nubank')
  // so old-format transactions (which store type strings in tx.bankId) are included in totals.
  const { allBankIds, docIdByAnyBankId } = useMemo(() => {
    const linkedDocIds = [...new Set(cardBills.map(b => b.linkedBankId))];
    const docIdByAnyBankId = new Map(); // any bankId format → doc ID

    for (const docId of linkedDocIds) {
      docIdByAnyBankId.set(docId, docId); // doc ID maps to itself
      const bank = userBanks.find(b => b.id === docId);
      if (bank?.bankId) {
        docIdByAnyBankId.set(bank.bankId, docId); // legacy type string → doc ID
      }
    }

    return {
      allBankIds: [...docIdByAnyBankId.keys()],
      docIdByAnyBankId
    };
  }, [cardBills, userBanks]);

  // Stable string key prevents subscription churn when parent re-renders with new array identity
  const allBankIdsKey = allBankIds.join(',');

  useEffect(() => {
    if (!ownerId || !selectedMonth || allBankIds.length === 0) {
      setAmounts(new Map());
      batchResultsRef.current = new Map();
      return;
    }

    // Firestore 'in' queries support max 30 values — batch if needed
    const batches = [];
    for (let i = 0; i < allBankIds.length; i += 30) {
      batches.push(allBankIds.slice(i, i + 30));
    }

    batchResultsRef.current = new Map();

    const unsubscribes = batches.map((batch, batchIndex) => {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', ownerId),
        where('bankId', 'in', batch),
        where('type', '==', 'expense')
      );

      return onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Keep credit-only transactions (undefined paymentMethod = legacy credit)
        const creditTxs = txs.filter(
          tx => !tx.paymentMethod || tx.paymentMethod === 'credit'
        );

        // Sum per (resolved doc ID, paymentMonthKey)
        const sumByBankMonth = new Map();
        for (const tx of creditTxs) {
          // Normalize tx.bankId to doc ID so key matches bill.linkedBankId
          const docId = docIdByAnyBankId.get(tx.bankId) ?? tx.bankId;
          const monthKey = getPaymentMonthKey(tx.date, tx.bankId, tx.paymentMethod);
          const key = `${docId}::${monthKey}`;
          sumByBankMonth.set(key, (sumByBankMonth.get(key) ?? 0) + Math.abs(tx.amount));
        }

        // Store this batch's results and merge all batches to avoid overwrite
        batchResultsRef.current.set(batchIndex, sumByBankMonth);

        const merged = new Map();
        for (const batchSum of batchResultsRef.current.values()) {
          for (const [key, value] of batchSum) {
            merged.set(key, (merged.get(key) ?? 0) + value);
          }
        }

        setAmounts(() => {
          const next = new Map();
          for (const bill of cardBills) {
            const key = `${bill.linkedBankId}::${selectedMonth}`;
            next.set(bill.id, merged.get(key) ?? 0);
          }
          return next;
        });
      }, (err) => console.error('useCardBillAmounts snapshot error:', err));
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
      batchResultsRef.current = new Map();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, selectedMonth, allBankIdsKey, cardBills, getPaymentMonthKey]);

  return amounts;
}
