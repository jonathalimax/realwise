import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchClientConfig, resolveRuntimeConfigId } from '../config/clientConfig';
import { devMark } from '../lib/devMarker';
import { ClientConfigError } from '../components/ClientConfigError';

const ClientConfigContext = createContext(null);

function classifyError(err) {
  if (err.name === 'AbortError') {
    return { code: 'TIMEOUT', message: err.message };
  }
  const msg = err?.message || '';
  // fetchClientConfig embeds the HTTP status in the message, e.g. "(404)"
  const statusMatch = msg.match(/\((\d+)\)/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 404) return { code: 'NOT_FOUND', message: msg };
    return { code: 'HTTP_ERROR', message: msg };
  }
  // A SPA host may serve index.html (200 + text/html) for missing files.
  // Treat that mismatch as "config missing" rather than a parse failure.
  if (msg.includes('unexpected content-type') || err instanceof SyntaxError) {
    return { code: 'NOT_FOUND', message: msg };
  }
  return { code: 'UNKNOWN', message: msg };
}

export function ClientConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const reload = () => {
    setStatus('loading');
    setError(null);
    setRetryCount(c => c + 1);
  };

  const handleGoToLogin = useCallback(async () => {
    localStorage.removeItem('rw_last_client');
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    const isMounted = { current: true };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    async function load() {
      try {
        devMark('ClientConfig: load() start');
        const configId = resolveRuntimeConfigId({
          isDev: import.meta.env.DEV,
          clientEnv: import.meta.env.VITE_CLIENT_ENV,
        });
        const cfg = await fetchClientConfig(configId, controller.signal);
        devMark('ClientConfig: loaded');
        if (isMounted.current) {
          setConfig(cfg);
          setStatus('ready');
        }
      } catch (err) {
        devMark('ClientConfig ERR: ' + (err?.message || 'unknown'));
        if (isMounted.current) {
          setError(classifyError(err));
          setStatus('error');
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    load();

    return () => {
      isMounted.current = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [retryCount]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
  }

  if (status === 'error') {
    return <ClientConfigError error={error} onRetry={reload} onGoToLogin={handleGoToLogin} />;
  }

  return (
    <ClientConfigContext.Provider value={config}>
      {children}
    </ClientConfigContext.Provider>
  );
}

export function useClientConfig() {
  return useContext(ClientConfigContext);
}

/**
 * Returns true if the named feature flag is enabled for this client.
 * Defaults to false for unknown flags.
 *
 * Usage: const hasInvestments = useFeature('investments');
 */
export function useFeature(flag) {
  const config = useContext(ClientConfigContext);
  return config?.features?.[flag] ?? false;
}
