import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../lib/api/auth';
import { SUBSCRIPTION_REQUIRED_EVENT } from '../lib/api/client';
import { bootstrapAuthSession, logoutAuthSession } from './authSession';

const AuthContext = createContext(null);

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
