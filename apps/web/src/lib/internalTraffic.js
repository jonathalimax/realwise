const STORAGE_KEY = 'rw_internal';

/**
 * True when this browser was flagged as the team's own: open any page once with ?internal=1 (and ?internal=0 to undo).
 * GA4's built-in "Internal Traffic" data filter drops events carrying traffic_type=internal, so no fixed IP is needed.
 * Storage can be blocked, so every access is guarded.
 */
export function isInternalTraffic() {
  try {
    const flag = new URLSearchParams(window.location.search).get('internal');
    if (flag === '1') localStorage.setItem(STORAGE_KEY, '1');
    if (flag === '0') localStorage.removeItem(STORAGE_KEY);
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Extra gtag('config') fields that mark every event from an internal browser. */
export function internalTrafficParams() {
  return isInternalTraffic() ? { traffic_type: 'internal' } : {};
}
