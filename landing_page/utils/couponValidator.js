import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function validateCoupon(couponCode) {
  if (!couponCode || couponCode.trim() === '') {
    return { valid: false, error: 'Coupon code cannot be empty' };
  }

  try {
    // Get coupon from Firestore
    const couponRef = doc(db, 'config', 'coupons', 'codes', couponCode.toUpperCase());
    const couponSnap = await getDoc(couponRef);

    if (!couponSnap.exists()) {
      return { valid: false, error: 'Coupon not found' };
    }

    const coupon = couponSnap.data();

    // Check if active
    if (!coupon.active) {
      return { valid: false, error: 'This coupon is not active' };
    }

    // Check if expired
    if (coupon.expiresAt && new Date(coupon.expiresAt.toDate()) < new Date()) {
      return { valid: false, error: 'This coupon has expired' };
    }

    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      description: coupon.description,
    };
  } catch (err) {
    return { valid: false, error: 'Error validating coupon' };
  }
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
