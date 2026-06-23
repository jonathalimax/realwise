import { useContext } from 'react';
import { PWAInstallContext } from '../contexts/PWAInstallContext';

export const usePWAInstall = () => {
  return useContext(PWAInstallContext);
};
