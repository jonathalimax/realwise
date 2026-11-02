// Last result of each query, kept in memory for the life of the page. Screens start from it (no spinner, no zeros)
// and only go to the network when it is older than `maxAgeMs` or something notified a change.
const store = new Map();

export const readCache = (key) => store.get(key);
export const writeCache = (key, data) => store.set(key, { data, at: Date.now() });
export const isFresh = (entry, maxAgeMs) => Boolean(entry) && Date.now() - entry.at < maxAgeMs;
export const dropCache = (keyPrefix) => {
  for (const key of [...store.keys()]) if (key.startsWith(keyPrefix)) store.delete(key);
};
export const clearCache = () => store.clear();
