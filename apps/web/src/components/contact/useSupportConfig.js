import { useEffect, useState } from 'react';
import { DEFAULT_SUPPORT, supportResource } from '../../lib/api/resources/support';

let cached = null;

/** WhatsApp number and support email from the API (env-configurable); defaults until it answers. */
export function useSupportConfig() {
  const [config, setConfig] = useState(cached ?? DEFAULT_SUPPORT);
  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    supportResource
      .config()
      .then((res) => {
        if (!res?.whatsapp && !res?.email) return;
        cached = { whatsapp: res.whatsapp || DEFAULT_SUPPORT.whatsapp, email: res.email || DEFAULT_SUPPORT.email };
        if (active) setConfig(cached);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return config;
}

export const whatsappUrl = (number, text = 'Olá! Preciso de ajuda com o Realwise.') =>
  `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const mailtoUrl = (email, subject = 'Ajuda com o Realwise') => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
