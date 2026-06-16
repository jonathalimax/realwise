import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

function brl(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PricingConfigPage({ db, functions }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'pricing'), (snap) => {
      const data = snap.data();
      if (data) {
        setForm({
          originalReais: (data.originalCents / 100).toString(),
          totalReais: (data.totalCents / 100).toString(),
          installments: data.installments.toString(),
          active: data.active,
          campaignLabel: data.campaignLabel || '',
        });
      }
    });
    return () => unsub();
  }, [db]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const originalCents = Math.round(parseFloat(form.originalReais.replace(',', '.')) * 100);
      const totalCents = Math.round(parseFloat(form.totalReais.replace(',', '.')) * 100);
      const installments = parseInt(form.installments, 10);
      await httpsCallable(functions, 'updatePricingConfig')({
        originalCents,
        totalCents,
        installments,
        active: form.active,
        campaignLabel: form.campaignLabel,
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, functions]);

  if (!form) return <div className="p-6 text-gray-400">Carregando...</div>;

  const totalCents = Math.round(parseFloat(form.totalReais.replace(',', '.') || '0') * 100);
  const originalCents = Math.round(parseFloat(form.originalReais.replace(',', '.') || '0') * 100);
  const installments = parseInt(form.installments, 10) || 1;
  const installmentCents = Math.round(totalCents / installments);
  const discountPercent = originalCents > 0 ? Math.round((1 - totalCents / originalCents) * 100) : 0;

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-bold text-white mb-4">Preço da Landing</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Promoção ativa
        </label>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço original (R$)</label>
          <input
            type="text"
            value={form.originalReais}
            onChange={(e) => setForm({ ...form, originalReais: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço final (R$)</label>
          <input
            type="text"
            value={form.totalReais}
            onChange={(e) => setForm({ ...form, totalReais: e.target.value })}
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

        <div>
          <label className="block text-xs text-gray-500 mb-1">Rótulo da campanha (opcional)</label>
          <input
            type="text"
            value={form.campaignLabel}
            onChange={(e) => setForm({ ...form, campaignLabel: e.target.value })}
            placeholder="Lançamento"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Prévia</p>
        <p className="text-white font-bold text-xl">{installments}x de {brl(installmentCents)}</p>
        <p className="text-gray-400 text-sm">ou {brl(totalCents)} à vista</p>
        <p className="text-gray-500 text-xs mt-1">
          <span className="line-through">{brl(originalCents)}</span> · {discountPercent}% OFF
          {form.campaignLabel && ` · ${form.campaignLabel}`}
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
