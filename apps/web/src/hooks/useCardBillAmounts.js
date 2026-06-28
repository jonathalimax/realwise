import { useState, useEffect, useMemo, useRef } from 'react';
import { useAccess } from '../contexts/AccessContext';
import { useCards } from '../contexts/CardsContext';
import {
  subscribeTransactionsChanged,
  transactionsResource,
} from '../lib/api/resources/transactions';

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

  // Keep cardBills in a ref so it's always current but doesn't trigger re-subscriptions
  const cardBillsRef = useRef(cardBills);
  useEffect(() => { cardBillsRef.current = cardBills; }, [cardBills]);

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
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const txs = await transactionsResource.list({ type: 'expense' });
        if (!active) return;

        const filtered = txs.filter(
          (tx) => allBankIds.includes(tx.bankId) && (!tx.paymentMethod || tx.paymentMethod === 'credit')
        );

        const sumByBankMonth = new Map();
        for (const tx of filtered) {
          const docId = docIdByAnyBankId.get(tx.bankId) ?? tx.bankId;
          const monthKey = getPaymentMonthKey(tx.date, docId, tx.paymentMethod);
          const key = `${docId}::${monthKey}`;
          sumByBankMonth.set(key, (sumByBankMonth.get(key) ?? 0) + Math.abs(tx.amount));
        }

        setAmounts(() => {
          const next = new Map();
          for (const bill of cardBillsRef.current) {
            const key = `${bill.linkedBankId}::${selectedMonth}`;
            next.set(bill.id, sumByBankMonth.get(key) ?? 0);
          }
          return next;
        });
      } catch (err) {
        console.error('useCardBillAmounts load error:', err);
      }
    };

    load();
    const unsubscribe = subscribeTransactionsChanged(load);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [ownerId, selectedMonth, allBankIdsKey, getPaymentMonthKey]);

  return amounts;
}
