import { useEffect } from 'react';

export default function CheckoutRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || '';
    const name = params.get('name') || '';
    const coupon = params.get('coupon') || '';

    const dest = new URLSearchParams({ checkout: '1' });
    if (email) dest.set('email', email);
    if (name) dest.set('name', name);
    if (coupon) dest.set('coupon', coupon);

    window.location.replace(`https://realwise.com.br/?${dest.toString()}`);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-600 dark:text-gray-300 text-sm">
        Redirecionando para o pagamento...
      </p>
    </div>
  );
}
