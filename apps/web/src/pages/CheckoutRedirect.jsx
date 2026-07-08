import { useEffect } from 'react';
import { resolveApiBaseUrl } from '../lib/api/client';

export default function CheckoutRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const name = params.get('name') || '';
    const coupon = params.get('coupon') || '';
    const clientId = params.get('clientId') || '';
    const apiBaseUrl = resolveApiBaseUrl();

    if (!apiBaseUrl || !email) {
      return;
    }

    fetch(`${apiBaseUrl.replace(/\/$/, '')}/payments/session`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        name,
        couponCode: coupon || undefined,
        clientId: clientId || undefined,
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Nao foi possivel iniciar o checkout.');
        }
        return data;
      })
      .then((data) => {
        if (data?.url) {
          window.location.replace(data.url);
          return;
        }

        throw new Error('Checkout sem URL de redirecionamento.');
      })
      .catch(() => {
        window.location.replace(`${window.location.origin}/?checkout_error=1`);
      });
  }, []);
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const apiBaseUrl = resolveApiBaseUrl();
  const canStartCheckout = Boolean(apiBaseUrl && email);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
      {canStartCheckout ? (
        <>
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Redirecionando para o checkout seguro...
          </p>
        </>
      ) : (
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm dark:border-amber-900/40 dark:bg-gray-800">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            Checkout premium ainda nao configurado
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Verifique `VITE_API_BASE_URL` e confirme que o endpoint `POST /payments/session` esta disponivel.
          </p>
        </div>
      )}
    </div>
  );
}
