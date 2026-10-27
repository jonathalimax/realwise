import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with loading/error state. `fn` is re-run whenever `key` changes
 * (pass a primitive/string, e.g. JSON.stringify of the params).
 * `reload(true)` refreshes silently (keeps current data on screen).
 */
export function useAsync(fn, key = '') {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    run();
    return () => { seq.current += 1; };
  }, [run, key]);

  return { ...state, reload: run };
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
