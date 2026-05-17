import { useEffect, useState, useRef } from 'react';

// The checkout function lives in the shared Firebase project (moneywise-ad9ec).
// It is a plain HTTP function, not a Firebase callable, so we use fetch directly.
const CHECKOUT_FUNCTION_URL =
  'https://us-central1-moneywise-ad9ec.cloudfunctions.net/createCheckoutSession';

export default function CheckoutRedirect() {
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  // Prevent double-invocation in React StrictMode dev
  const calledRef = useRef(false);

  async function redirect(withCoupon = true) {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || undefined;
    const name = params.get('name') || undefined;
    const coupon = withCoupon ? (params.get('coupon') || undefined) : undefined;

    try {
      const body = { email };
      if (name) body.name = name;
      if (coupon) body.couponCode = coupon;

      const res = await fetch(CHECKOUT_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar checkout.');
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de checkout não retornada.');
      }
    } catch (err) {
      const msg = err?.message || 'Erro ao iniciar checkout.';
      // If the coupon is invalid, retry without it
      if (
        withCoupon &&
        coupon &&
        (msg.toLowerCase().includes('cupom') || msg.toLowerCase().includes('coupon'))
      ) {
        setErrorMsg('Este cupom não é mais válido. Redirecionando sem desconto...');
        setStatus('error');
        setTimeout(() => {
          setErrorMsg('');
          setStatus('loading');
          redirect(false);
        }, 3000);
        return;
      }
      setErrorMsg(msg);
      setStatus('error');
    }
  }

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    redirect(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          Redirecionando para o pagamento...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">
          {errorMsg || 'Não foi possível iniciar o checkout.'}
        </p>
        <button
          onClick={() => {
            setStatus('loading');
            setErrorMsg('');
            redirect(true);
          }}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          Tentar novamente
        </button>
        <a
          href="https://realwise.com.br"
          className="block mt-3 text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          Voltar ao site
        </a>
      </div>
    </div>
  );
}
