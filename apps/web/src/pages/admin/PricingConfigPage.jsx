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
    if (!db) return;
    const defaults = { basePriceCents: 23880, installments: 12 };
    const unsub = onSnapshot(doc(db, 'config', 'pricing'),
      (snap) => {
        const data = snap.data();
        const pricingData = data || defaults;
        setForm({
          basePriceReais: (pricingData.basePriceCents / 100).toString(),
          installments: pricingData.installments.toString(),
        });
        setError('');
      },
      (err) => {
        if (err.code === 'permission-denied') {
          setError('Sem permissão. Verifique se as regras do Firestore foram deployadas: firebase deploy --only firestore:rules');
          setForm({
            basePriceReais: (defaults.basePriceCents / 100).toString(),
            installments: defaults.installments.toString(),
          });
        } else {
          setError('Erro ao carregar preços: ' + err.message);
        }
      }
    );
    return () => unsub();
  }, [db]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      const basePriceCents = Math.round(parseFloat(form.basePriceReais.replace(',', '.')) * 100);
      const installments = parseInt(form.installments, 10);
      await httpsCallable(functions, 'updatePricingConfig')({
        basePriceCents,
        installments,
      });
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, functions]);

  if (!form) return <div className="p-6 text-gray-400">Carregando...</div>;

  const basePriceCents = Math.round(parseFloat(form.basePriceReais.replace(',', '.') || '0') * 100);
  const installments = parseInt(form.installments, 10) || 1;
  const installmentCents = Math.round(basePriceCents / installments);

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-bold text-white mb-4">Preço da Landing</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço Base (R$)</label>
          <input
            type="text"
            value={form.basePriceReais}
            onChange={(e) => setForm({ ...form, basePriceReais: e.target.value })}
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
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Prévia</p>
        <p className="text-white font-bold text-xl">{installments}x de {brl(installmentCents)}</p>
        <p className="text-gray-400 text-sm">ou {brl(basePriceCents)} à vista</p>
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
