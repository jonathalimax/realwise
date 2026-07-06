import { useState, useEffect, useCallback } from 'react';
import { adminResource } from '../../lib/api/resources/admin';

function brl(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PricingConfigPage() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let active = true;
    adminResource.getPricingConfig()
      .then((pricingData) => {
        if (!active) return;
        setForm({
          basePriceReais: (pricingData.basePriceCents / 100).toString(),
          compareAtPriceReais: (pricingData.compareAtPriceCents / 100).toString(),
          installments: pricingData.installments.toString(),
          stripeWalletEnabled: pricingData.stripeWalletEnabled !== false,
          mercadopagoEnabled: pricingData.mercadopagoEnabled !== false,
        });
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError('Erro ao carregar preços: ' + err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const basePriceCents = Math.round(parseFloat(form.basePriceReais.replace(',', '.')) * 100);
      const compareAtPriceCents = Math.round(parseFloat(form.compareAtPriceReais.replace(',', '.')) * 100);
      const installments = parseInt(form.installments, 10);
      await adminResource.updatePricingConfig({
        basePriceCents,
        compareAtPriceCents,
        installments,
        stripeWalletEnabled: form.stripeWalletEnabled,
        mercadopagoEnabled: form.mercadopagoEnabled,
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (!form) return <div className="p-6 text-gray-400">Carregando...</div>;

  const basePriceCents = Math.round(parseFloat(form.basePriceReais.replace(',', '.') || '0') * 100);
  const compareAtPriceCents = Math.round(parseFloat(form.compareAtPriceReais.replace(',', '.') || '0') * 100);
  const installments = parseInt(form.installments, 10) || 1;
  const installmentCents = Math.round(basePriceCents / installments);
  const discountPercent = compareAtPriceCents > 0
    ? Math.round((1 - (basePriceCents / compareAtPriceCents)) * 100)
    : 0;

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-bold text-white mb-4">Preço da Landing</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço Premium (R$)</label>
          <input
            type="text"
            value={form.basePriceReais}
            onChange={(e) => setForm({ ...form, basePriceReais: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço de comparação (R$)</label>
          <input
            type="text"
            value={form.compareAtPriceReais}
            onChange={(e) => setForm({ ...form, compareAtPriceReais: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Parcelas</label>
          <input
            type="text"
            value={form.installments}
            onChange={(e) => setForm({ ...form, installments: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <label className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-300">
          <span>Apple Pay / Google Pay via Stripe</span>
          <input
            type="checkbox"
            checked={form.stripeWalletEnabled}
            onChange={(e) => setForm({ ...form, stripeWalletEnabled: e.target.checked })}
            className="h-4 w-4"
          />
        </label>

        <label className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-300">
          <span>Pix e cartão manual via Mercado Pago</span>
          <input
            type="checkbox"
            checked={form.mercadopagoEnabled}
            onChange={(e) => setForm({ ...form, mercadopagoEnabled: e.target.checked })}
            className="h-4 w-4"
          />
        </label>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Prévia</p>
        <p className="text-white font-bold text-xl">{installments}x de {brl(installmentCents)}</p>
        <p className="text-gray-400 text-sm">ou {brl(basePriceCents)} à vista</p>
        <p className="text-gray-500 text-sm line-through mt-1">{brl(compareAtPriceCents)}</p>
        <p className="text-emerald-400 text-sm mt-1">{discountPercent}% abaixo do valor de comparação</p>
        <p className="text-gray-500 text-xs mt-3">
          Stripe: {form.stripeWalletEnabled ? 'ativo' : 'desativado'} · Mercado Pago: {form.mercadopagoEnabled ? 'ativo' : 'desativado'}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {savedAt && !error && <p className="text-emerald-400 text-sm mb-3">Salvo às {savedAt.toLocaleTimeString('pt-BR')}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
