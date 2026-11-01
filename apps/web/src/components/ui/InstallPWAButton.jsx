import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useSettings } from '../../contexts/SettingsContext';

const InstallPWAButton = () => {
  const { canInstall, installPWA } = usePWAInstall();
  const { language } = useSettings();
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);
  }, []);

  // Already installed
  if (isStandalone) {
    return (
      <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium rounded-xl text-center">
        {language === 'pt' ? '✓ Aplicativo instalado' : '✓ App installed'}
      </div>
    );
  }

  // iOS instructions (no beforeinstallprompt support)
  if (isIOS) {
    return (
      <div className="p-3 bg-[var(--rw-raised)] rounded-xl text-center">
        <p className="text-sm text-[var(--rw-ink)] font-medium mb-1">
          {language === 'pt' ? 'Para instalar no iOS:' : 'To install on iOS:'}
        </p>
        <p className="text-xs text-[var(--rw-muted)]">
          {language === 'pt'
            ? 'Toque em Compartilhar e "Adicionar à Tela Inicial"'
            : 'Tap Share then "Add to Home Screen"'}
        </p>
      </div>
    );
  }

  // Can install via beforeinstallprompt
  if (canInstall) {
    return (
      <button
        onClick={installPWA}
        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors shadow-sm"
      >
        {language === 'pt' ? 'Instalar Aplicativo' : 'Install App'}
      </button>
    );
  }

  // Not available (already installed, unsupported browser, or in dev mode)
  return (
    <div className="px-4 py-2 bg-[var(--rw-raised)] text-[var(--rw-muted)] text-sm rounded-xl text-center">
      {language === 'pt'
        ? 'Instalação disponível no Chrome/Edge'
        : 'Install available on Chrome/Edge'}
    </div>
  );
};

export default InstallPWAButton;
