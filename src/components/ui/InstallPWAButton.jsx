import React from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from './button';
import { useTranslation } from 'react-i18next';

const InstallPWAButton = () => {
  const { canInstall, installPWA } = usePWAInstall();
  const { t } = useTranslation();

  if (!canInstall) {
    return null;
  }

  return (
    <Button onClick={installPWA}>
      {t('install_pwa')}
    </Button>
  );
};

export default InstallPWAButton;
