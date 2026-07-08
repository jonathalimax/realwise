import { useEffect } from 'react';
import { buildStripeCheckoutUrl } from '../lib/payments/buildStripeCheckoutUrl';

const STRIPE_PAYMENT_LINK_URL = import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL || '';

export default function CheckoutRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const name = params.get('name') || '';
    const coupon = params.get('coupon') || '';
    const stripeUrl = params.get('stripeUrl') || STRIPE_PAYMENT_LINK_URL;

    const checkoutUrl = buildStripeCheckoutUrl(stripeUrl, { email, name, coupon });

    if (checkoutUrl) {
      window.location.replace(checkoutUrl);
    }
  }, []);

  const hasStripeLink = Boolean(STRIPE_PAYMENT_LINK_URL || new URLSearchParams(window.location.search).get('stripeUrl'));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
      {hasStripeLink ? (
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
            Defina `VITE_STRIPE_PAYMENT_LINK_URL` ou envie `stripeUrl` na rota para concluir o checkout premium no Stripe.
          </p>
        </div>
      )}
    </div>
  );
}
