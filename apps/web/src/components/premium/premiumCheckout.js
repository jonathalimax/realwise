export function getPaymentMethodOptions() {
  return [
    {
      id: 'apple_pay',
      provider: 'stripe',
      label: 'Apple Pay',
      description: 'Fast wallet checkout on supported Apple devices.',
    },
    {
      id: 'google_pay',
      provider: 'stripe',
      label: 'Google Pay',
      description: 'Fast wallet checkout on supported Android and Chrome devices.',
    },
    {
      id: 'pix',
      provider: 'mercadopago',
      label: 'Pix',
      description: 'Instant transfer with QR code or copy-and-paste code.',
    },
    {
      id: 'card',
      provider: 'mercadopago',
      label: 'Cartao',
      description: 'Manual card entry through Mercado Pago when needed.',
    },
  ];
}

export function validatePremiumCheckoutContact(form) {
  const name = form?.name?.trim() || '';
  const email = form?.email?.trim() || '';
  const whatsapp = form?.whatsapp?.trim() || '';

  if (!name || !email || !whatsapp) {
    return {
      ok: false,
      error: 'Preencha nome, e-mail e WhatsApp para continuar.',
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      error: 'E-mail invalido.',
    };
  }

  return { ok: true };
}

export function buildPremiumCheckoutPayload({
  form,
  clientId,
  utmSource,
} = {}) {
  return {
    name: form?.name?.trim() || '',
    email: form?.email?.trim().toLowerCase() || '',
    whatsapp: form?.whatsapp?.trim() || '',
    couponCode: form?.coupon?.trim().toUpperCase() || undefined,
    clientId: clientId || undefined,
    utmSource: utmSource || undefined,
  };
}
