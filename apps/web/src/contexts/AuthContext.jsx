import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../lib/api/auth';
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

  const value = useMemo(() => ({
    status,
    user,
    error,
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
  }), [status, user, error, authClient]);

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
