import { useEffect, useMemo, useState } from 'react';
import CheckoutModal from '../../../landing_page/components/landing/CheckoutModal';
import { extractClientId } from '@/config/clientConfig';
import { paymentsResource } from '@/lib/api/resources/payments';
import PaymentMethodChooser from './PaymentMethodChooser';
import {
  buildPremiumCheckoutPayload,
  validatePremiumCheckoutContact,
} from './premiumCheckout';

function maskPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function getUtmSource() {
  return new URLSearchParams(window.location.search).get('utm_source') || 'premium-lock';
}

export default function PremiumCheckoutModal() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const feature = params.get('feature') || '';

  const [form, setForm] = useState({
    name: params.get('name') || '',
    email: params.get('email') || '',
    whatsapp: params.get('whatsapp') || '',
    coupon: params.get('coupon') || '',
  });
  const [error, setError] = useState('');
  const [loadingMethod, setLoadingMethod] = useState('');
  const [mpOpen, setMpOpen] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'whatsapp' ? maskPhone(value) : value,
    }));
    setError('');
  }

  async function handleWalletCheckout(methodId) {
    const validation = validatePremiumCheckoutContact(form);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoadingMethod(methodId);
    setError('');

    try {
      const payload = buildPremiumCheckoutPayload({
        form,
        clientId: extractClientId(window.location.hostname),
        utmSource: getUtmSource(),
      });
      const data = await paymentsResource.createStripeCheckout({
        ...payload,
        feature: feature || undefined,
      });

      if (!data?.url) {
        throw new Error('Nao foi possivel iniciar o checkout por carteira.');
      }

      window.location.assign(data.url);
    } catch (walletError) {
      setError(walletError.message || 'Nao foi possivel iniciar o checkout por carteira.');
      setLoadingMethod('');
    }
  }

  function handleMercadoPagoCheckout(methodId) {
    const validation = validatePremiumCheckoutContact(form);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoadingMethod(methodId);
    setError('');
    setMpOpen(true);
    window.setTimeout(() => setLoadingMethod(''), 0);
  }

  async function handleSelectMethod(option) {
    if (option.provider === 'stripe') {
      await handleWalletCheckout(option.id);
      return;
    }

    handleMercadoPagoCheckout(option.id);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#ecfdf5_100%)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <PaymentMethodChooser
          feature={feature}
          form={form}
          error={error}
          loadingMethod={loadingMethod}
          onChange={handleChange}
          onSelectMethod={handleSelectMethod}
        />
      </div>

      <CheckoutModal
        open={mpOpen}
        onClose={() => {
          setMpOpen(false);
          setLoadingMethod('');
        }}
        prefill={form}
        mode="premium"
      />
    </div>
  );
}
