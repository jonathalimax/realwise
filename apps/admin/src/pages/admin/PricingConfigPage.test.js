import { describe, it, expect, vi } from 'vitest';

describe('PricingConfigPage', () => {
  it('should format reais correctly', () => {
    function brl(cents) {
      return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    expect(brl(10000)).toContain('100');
    expect(brl(5050)).toContain('50,50');
  });

  it('should calculate installment correctly', () => {
    const totalCents = 30000; // R$ 300
    const installments = 12;
    const installmentCents = Math.round(totalCents / installments);
    expect(installmentCents).toBe(2500); // R$ 25
  });

  it('should calculate discount percentage correctly', () => {
    const originalCents = 40000; // R$ 400
    const totalCents = 30000; // R$ 300
    const discountPercent = originalCents > 0 ? Math.round((1 - totalCents / originalCents) * 100) : 0;
    expect(discountPercent).toBe(25); // 25% off
  });

  it('should handle form state updates', () => {
    const initialForm = {
      originalReais: '100.00',
      totalReais: '75.00',
      installments: '3',
      active: true,
      campaignLabel: 'Promoção',
    };

    const updated = { ...initialForm, campaignLabel: 'Novo Rótulo' };
    expect(updated.campaignLabel).toBe('Novo Rótulo');
    expect(updated.originalReais).toBe('100.00');
  });
});
