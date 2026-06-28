import { apiClient } from '../client';

function normalizeCoupon(coupon) {
  const discountType =
    coupon.discountType === 'percent' ? 'percentage'
      : coupon.discountType === 'fixed' ? 'fixed_amount'
        : coupon.discountType;

  return {
    ...coupon,
    discountType,
    currentUses: coupon.currentUses ?? coupon.useCount ?? 0,
    enabled: coupon.enabled ?? true,
    validFrom: coupon.validFrom ?? null,
    validUntil: coupon.validUntil ?? coupon.expiresAt ?? null,
  };
}

export function createCouponsResource({ client = apiClient } = {}) {
  return {
    async list() {
      const rows = await client.get('/admin/coupons');
      return rows.map(normalizeCoupon);
    },
    async create(data) {
      const row = await client.post('/admin/coupons', data);
      return normalizeCoupon(row);
    },
    async update(id, patch) {
      const row = await client.patch(`/admin/coupons/${id}`, patch);
      return normalizeCoupon(row);
    },
    remove(id) {
      return client.delete(`/admin/coupons/${id}`);
    },
  };
}

export const couponsResource = createCouponsResource();
