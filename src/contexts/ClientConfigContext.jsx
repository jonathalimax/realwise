import { createContext, useContext, useState, useEffect } from 'react';
import { initializeFirebase } from '../firebase';
import { extractClientId, fetchClientConfig } from '../config/clientConfig';
import { devMark } from '../lib/devMarker';

const ClientConfigContext = createContext(null);

export function ClientConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        devMark('ClientConfig: load() start');
        // In DEV, fetch /clients/app.json (same as SharedLogin) instead of
        // reading .env.development. This guarantees the projectId matches the
        // 'shared' Firebase app already initialized by SharedLogin, so we
        // reuse its Auth instance and stay signed in.
        let cfg;
        let appName;
        if (import.meta.env.DEV) {
          const clientEnv = import.meta.env.VITE_CLIENT_ENV || 'app';
          cfg = await fetchClientConfig(clientEnv);
          appName = 'shared';
        } else {
          const clientId = extractClientId(window.location.hostname)
            || window.location.pathname.split('/').filter(Boolean)[0];
          if (!clientId) return;
          cfg = await fetchClientConfig(clientId);
          appName = clientId;
        }
        await initializeFirebase(cfg.firebase, appName);
        devMark('ClientConfig: initialized');
        setConfig(cfg);
      } catch (err) {
        devMark('ClientConfig ERR: ' + (err?.message || 'unknown'));
      }
    }
    load();
  }, []);

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
