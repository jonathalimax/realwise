const LOGIN_AT_KEY = '__rw_login_at';
const MAX_SESSION_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export function markLoginSession(now = Date.now()) {
  localStorage.setItem(LOGIN_AT_KEY, String(now));
}

export function clearLoginSession() {
  localStorage.removeItem(LOGIN_AT_KEY);
}

export function isLoginSessionExpired(now = Date.now()) {
  const raw = localStorage.getItem(LOGIN_AT_KEY);
  if (!raw) {
    markLoginSession(now);
    return false;
  }

  const loginAt = Number(raw);
  if (!Number.isFinite(loginAt)) {
    markLoginSession(now);
    return false;
  }

  return now - loginAt >= MAX_SESSION_AGE_MS;
}
