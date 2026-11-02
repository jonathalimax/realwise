import { useEffect, useRef, useState } from 'react';

import {
  subscribeTransactionsChanged,
  transactionsResource,
} from '../lib/api/resources/transactions';
import { isFresh, readCache, writeCache } from '../lib/queryCache';

const FRESH_MS = 60 * 1000;

/**
 * Stale-while-revalidate: a screen that mounts with a recent result for the same query shows it at once and does not
 * hit the network; an older one shows what it has and refreshes quietly; a notified change (an edit, a chat import)
 * refreshes quietly too. `loading` is true only while there is nothing to show yet, so pages can show a skeleton
 * instead of zeros or an empty state.
 */
export default function useTransactions(params = {}, { enabled = true } = {}) {
  const key = `tx:${JSON.stringify(params)}`;
  const cached = enabled ? readCache(key) : undefined;
  const [transactions, setTransactions] = useState(cached?.data ?? []);
  const [loading, setLoading] = useState(enabled && !cached);
  const keyRef = useRef(key);

  useEffect(() => {
    if (!enabled) {
      setTransactions([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    const entry = readCache(key);
    if (keyRef.current !== key) {
      keyRef.current = key;
      setTransactions(entry?.data ?? []);
    }
    setLoading(!entry);

    const load = async () => {
      try {
        const rows = await transactionsResource.list(params);
        const list = Array.isArray(rows) ? rows : [];
        writeCache(key, list);
        if (active) setTransactions(list);
      } catch (error) {
        console.error('Failed to load transactions:', error);
        // Keep whatever is already on screen; only an empty first load falls back to "nothing".
        if (active && !readCache(key)) setTransactions([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!isFresh(entry, FRESH_MS)) load();

    const unsubscribe = subscribeTransactionsChanged(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { transactions, loading };
}
