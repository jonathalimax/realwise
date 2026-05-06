import { createContext, useContext, useState, useEffect } from 'react';
import { initializeFirebase } from '../firebase';
import { extractClientId, fetchClientConfig } from '../config/clientConfig';

const ClientConfigContext = createContext(null);

export function ClientConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // In DEV, fetch /clients/app.json (same as SharedLogin) instead of
        // reading .env.development. This guarantees the projectId matches the
        // 'shared' Firebase app already initialized by SharedLogin, so we
        // reuse its Auth instance and stay signed in.
        let cfg;
        let appName;
        if (import.meta.env.DEV) {
          cfg = await fetchClientConfig('app');
          appName = 'shared';
        } else {
          const clientId = extractClientId(window.location.hostname)
            || window.location.pathname.split('/').filter(Boolean)[0];
          cfg = await fetchClientConfig(clientId);
          appName = clientId;
        }
        await initializeFirebase(cfg.firebase, appName);
        setConfig(cfg);
      } catch (err) {
        console.error('[ClientConfig] Failed to load config:', err);
        setError(err.message);
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Aplicativo não encontrado.
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
      </div>
    );
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
