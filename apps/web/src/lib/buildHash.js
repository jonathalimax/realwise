const KEY = '__rw_build_hash';
const RELOAD_GUARD = '__rw_reload_guard';

export function checkBuildHash() {
  try {
    const current = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : null;
    if (!current) return;
    const stored = localStorage.getItem(KEY);
    if (stored && stored !== current) {
      if (sessionStorage.getItem(RELOAD_GUARD) === '1') {
        sessionStorage.removeItem(RELOAD_GUARD);
        localStorage.setItem(KEY, current);
        return;
      }
      sessionStorage.setItem(RELOAD_GUARD, '1');
      localStorage.setItem(KEY, current);
      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .finally(() => window.location.reload());
      } else {
        window.location.reload();
      }
      return;
    }
    localStorage.setItem(KEY, current);
  } catch {
    // storage unavailable — best-effort, skip.
  }
}
