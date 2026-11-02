import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../lib/api/auth';
import { SESSION_EXPIRED_EVENT, SUBSCRIPTION_REQUIRED_EVENT } from '../lib/api/client';
import { bootstrapAuthSession, logoutAuthSession } from './authSession';
import { clearCache } from '../lib/queryCache';

const AuthContext = createContext(null);
const REVALIDATE_AFTER_MS = 60 * 1000;
const STALE_AFTER_MS = 30 * 60 * 1000;

export function AuthProvider({ children, authClient = authApi }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const next = await bootstrapAuthSession({ authClient });
        if (!active) return;
        setStatus(next.status);
        setUser(next.user);
        setError(null);
      } catch (err) {
        if (!active) return;
        setStatus('unauthenticated');
        setUser(null);
        setError(err);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [authClient]);

  // Re-reads /auth/me (no token refresh) so `user.access` stays in sync with the server.
  // Concurrent callers share one request: a blocked user can trigger many 402s at once.
  const reloadInFlight = useRef(null);
  const reloadUser = useCallback(() => {
    if (!reloadInFlight.current) {
      reloadInFlight.current = bootstrapAuthSession({ authClient })
        .then((next) => {
          setStatus(next.status);
          setUser(next.user);
          setError(null);
          return next;
        })
        .finally(() => {
          reloadInFlight.current = null;
        });
    }
    return reloadInFlight.current;
  }, [authClient]);

  useEffect(() => {
    const onSubscriptionRequired = () => {
      reloadUser().catch(() => {});
    };
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, onSubscriptionRequired);
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, onSubscriptionRequired);
  }, [reloadUser]);

  useEffect(() => {
    const onExpired = () => { clearCache(); setStatus('unauthenticated'); setUser(null); };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Coming back to the app after it slept: re-validate the session (the client refreshes it if needed), and after a
  // long absence reload so the screens, the data and the app version are all fresh instead of half-stale.
  useEffect(() => {
    let hiddenAt = null;
    const onChange = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt === null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away > STALE_AFTER_MS) { window.location.reload(); return; }
      if (away > REVALIDATE_AFTER_MS) reloadUser().catch(() => {});
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [reloadUser]);

  const value = useMemo(() => ({
    status,
    user,
    error,
    reloadUser,
    refreshSession: async () => {
      try {
        await authClient.refresh();
      } catch (err) {
        if (err?.status !== 401) {
          throw err;
        }
      }
      const next = await bootstrapAuthSession({ authClient });
      setStatus(next.status);
      setUser(next.user);
      setError(null);
      return next;
    },
    logout: async () => {
      const next = await logoutAuthSession({ authClient });
      clearCache();
      setStatus(next.status);
      setUser(next.user);
      setError(null);
      return next;
    },
  }), [status, user, error, authClient, reloadUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
