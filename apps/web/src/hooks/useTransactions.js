import { useEffect, useState } from 'react';

import {
  subscribeTransactionsChanged,
  transactionsResource,
} from '../lib/api/resources/transactions';

export default function useTransactions(params = {}, { enabled = true } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setTransactions([]);
      setLoading(false);
      return undefined;
    }

    let active = true;

    const load = async () => {
      try {
        const rows = await transactionsResource.list(params);
        if (active) {
          setTransactions(Array.isArray(rows) ? rows : []);
        }
      } catch (error) {
        if (active) {
          console.error('Failed to load transactions:', error);
          setTransactions([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    load();

    const unsubscribe = subscribeTransactionsChanged(() => {
      load();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, JSON.stringify(params)]);

  return { transactions, loading };
}
