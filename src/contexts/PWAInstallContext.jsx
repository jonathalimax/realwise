import React, { createContext, useEffect, useState } from 'react';
import { devMark } from '../lib/devMarker';

export const PWAInstallContext = createContext();

export const PWAInstallProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    if (sessionStorage.getItem('__rw_storage_persist_asked') === '1') return;
    sessionStorage.setItem('__rw_storage_persist_asked', '1');
    navigator.storage.persist().then((granted) => {
      devMark('storage.persist granted=' + granted);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        // accepted
      }
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  return (
    <PWAInstallContext.Provider value={{ canInstall, installPWA }}>
      {children}
    </PWAInstallContext.Provider>
  );
};
