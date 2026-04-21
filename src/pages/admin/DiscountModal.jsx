// src/pages/admin/DiscountModal.jsx
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';

export default function DiscountModal({ lead, functions, onClose }) {
  const [pct, setPct] = useState(20);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const fn = httpsCallable(functions, 'createDiscountCheckout');
      const { data } = await fn({ email: lead.email, discountPct: Number(pct) });
      setUrl(data.url);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Discount Link — {lead.email}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <p className="text-xs text-gray-400">
          Generates a one-time Stripe checkout link with the discount applied. Max 1 redemption.
        </p>

        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Discount %</label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="number"
              min={1}
              max={100}
              value={pct}
              onChange={e => setPct(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-gray-400 text-sm">
              → R$ {((47988 * (1 - pct / 100)) / 100).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {status === 'error' && <p className="text-red-400 text-sm">{errorMsg}</p>}

        {status === 'done' && (
          <div className="space-y-2">
            <p className="text-emerald-400 text-xs">Link gerado com sucesso!</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg whitespace-nowrap"
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Fechar</button>
          {status !== 'done' && (
            <button
              onClick={handleGenerate}
              disabled={status === 'loading'}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {status === 'loading' ? 'Gerando...' : 'Gerar Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
