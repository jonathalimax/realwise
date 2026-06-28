export async function validateCoupon(couponCode) {
  if (!couponCode || couponCode.trim() === '') {
    return { valid: false, error: 'Digite o cupom para continuar' };
  }

  return {
    valid: true,
    code: couponCode.trim().toUpperCase(),
    discountPercent: 0,
    description: '',
  };
}

export function calculatePrice(basePriceCents, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    return basePriceCents;
  }
  const discountCents = Math.round(basePriceCents * (discountPercent / 100));
  return basePriceCents - discountCents;
}

export function calculateInstallment(totalCents, installments) {
  return Math.round(totalCents / installments);
}

export function formatPrice(cents) {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}
