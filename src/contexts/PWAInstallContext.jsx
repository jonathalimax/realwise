import React, { createContext, useEffect, useState } from 'react';

export const PWAInstallContext = createContext();

export const PWAInstallProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

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
        console.log('User accepted the PWA installation');
      } else {
        console.log('User dismissed the PWA installation');
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
