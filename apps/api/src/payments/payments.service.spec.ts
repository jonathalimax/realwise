import { PaymentsService } from './payments.service';

describe('PaymentsService helpers', () => {
  const service = new PaymentsService({} as unknown as never, {} as unknown as never);

  it('applies percentage coupons', () => {
    const result = (service as unknown as { applyCoupon: (amount: number, coupon: unknown) => { finalPriceCents: number; discountCents: number } }).applyCoupon(20000, {
      discountType: 'percentage',
      discountValue: '10',
    });

    expect(result).toEqual({
      finalPriceCents: 18000,
      discountCents: 2000,
    });
  });

  it('applies fixed amount coupons', () => {
    const result = (service as unknown as { applyCoupon: (amount: number, coupon: unknown) => { finalPriceCents: number; discountCents: number } }).applyCoupon(23880, {
      discountType: 'fixed_amount',
      discountValue: '38.80',
    });

    expect(result).toEqual({
      finalPriceCents: 20000,
      discountCents: 3880,
    });
  });

  it('normalizes empty client ids to app', () => {
    const typedService = service as unknown as { normalizeClientId: (clientId?: string | null) => string };
    expect(typedService.normalizeClientId('')).toBe('app');
    expect(typedService.normalizeClientId(' jonathalimax ')).toBe('jonathalimax');
  });
});
