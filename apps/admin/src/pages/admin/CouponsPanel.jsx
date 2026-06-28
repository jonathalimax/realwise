import { useState, useEffect } from 'react';
import { couponsResource } from '../../lib/api/resources/coupons';

export default function CouponsPanel() {
  const [discountType, setDiscountType] = useState('percent');
  const [discountPct, setDiscountPct] = useState(20);
  const [discountAmount, setDiscountAmount] = useState(50);
  const [maxUses, setMaxUses] = useState(3);
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [coupons, setCoupons] = useState([]);
  const [copied, setCopied] = useState(false);

  function generateCouponCode() {
    return `PROMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  // Load existing coupons
  useEffect(() => {
    let active = true;
    couponsResource.list()
      .then((rows) => {
        if (!active) return;
        setCoupons(rows);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(err.message || 'Erro ao carregar cupons');
      });
    return () => { active = false; };
  }, []);

  // Compute preview price
  const basePrice = 47988; // R$479,88 in centavos
  let previewPrice = basePrice;
  if (discountType === 'percent') {
    previewPrice = Math.round(basePrice * (1 - discountPct / 100));
  } else if (discountType === 'fixed') {
    previewPrice = basePrice - Math.round(discountAmount * 100);
  }

  async function handleGenerate() {
    setStatus('loading');
    setErrorMsg('');
    setResult(null);

    // Validate
    if (discountType === 'percent' && (discountPct < 1 || discountPct > 100)) {
      setErrorMsg('Desconto deve estar entre 1 e 100%');
      setStatus('error');
      return;
    }
    if (discountType === 'fixed' && discountAmount <= 0) {
      setErrorMsg('Valor deve ser maior que 0');
      setStatus('error');
      return;
    }
    if (maxUses < 1) {
      setErrorMsg('Máximo de usos deve ser pelo menos 1');
      setStatus('error');
      return;
    }

    try {
      const row = await couponsResource.create({
        code: code || generateCouponCode(),
        discountType: discountType === 'percent' ? 'percentage' : 'fixed_amount',
        discountValue: discountType === 'percent' ? discountPct : Math.round(discountAmount * 100),
        maxUses: maxUses || undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        enabled: true,
      });
      setResult(row);
      setStatus('done');
      // Reset form
      setDiscountPct(20);
      setDiscountAmount(50);
      setMaxUses(3);
      setCode('');
      setExpiresAt('');
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao criar cupom');
      setStatus('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(ts) {
    if (!ts) return 'Sem validade';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('pt-BR');
  }

  function formatPrice(centavos) {
    return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-bold text-white">Gerar Novo Cupom</h2>

        {/* Discount Type Toggle */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Tipo de Desconto</label>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setDiscountType('percent')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                discountType === 'percent'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              % Porcentagem
            </button>
            <button
              onClick={() => setDiscountType('fixed')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                discountType === 'fixed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              R$ Valor Fixo
            </button>
          </div>
        </div>

        {/* Discount Input */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">
            {discountType === 'percent' ? 'Desconto %' : 'Valor (R$)'}
          </label>
          <div className="flex items-center gap-3 mt-1">
            <input
              type="number"
              min={discountType === 'percent' ? 1 : 0.01}
              max={discountType === 'percent' ? 100 : undefined}
              step={discountType === 'percent' ? 1 : 0.01}
              value={discountType === 'percent' ? discountPct : discountAmount}
              onChange={e => {
                const val = Number(e.target.value);
                if (discountType === 'percent') {
                  setDiscountPct(Math.min(100, Math.max(1, val)));
                } else {
                  setDiscountAmount(Math.max(0, val));
                }
              }}
              className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <span className="text-gray-400 text-sm">→ {formatPrice(previewPrice)}</span>
          </div>
        </div>

        {/* Max Uses */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Máximo de Usos</label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={e => setMaxUses(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Code (optional) */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Código (opcional)</label>
          <input
            type="text"
            placeholder="Auto-gerado pelo Stripe"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={20}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">3-20 caracteres. Deixe em branco para gerar automaticamente.</p>
        </div>

        {/* Expiry Date (optional) */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide">Validade (opcional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            className="mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">Deixe em branco para sem validade.</p>
        </div>

        {/* Error */}
        {status === 'error' && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Success */}
        {status === 'done' && result && (
          <div className="p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ Cupom gerado com sucesso!</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={result.code}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg whitespace-nowrap font-medium"
              >
                {copied ? '✓ Copiado' : 'Copiar Código'}
              </button>
            </div>
          </div>
        )}

        {/* Button */}
        <button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg transition"
        >
          {status === 'loading' ? 'Gerando...' : 'Gerar Cupom'}
        </button>
      </div>

      {/* Coupons List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Cupons Existentes</h2>
        {coupons.length === 0 ? (
          <p className="text-gray-400">Nenhum cupom gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {coupons.map(coupon => (
              <div key={coupon.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-gray-800 rounded-lg font-mono font-bold text-emerald-400 text-sm">
                        {coupon.code}
                      </span>
                      {coupon.discountType === 'percentage' && (
                        <span className="text-gray-300 text-sm">{coupon.discountValue}% off</span>
                      )}
                      {coupon.discountType === 'fixed_amount' && (
                        <span className="text-gray-300 text-sm">R$ {((coupon.discountValue || 0) / 100).toFixed(2)} off</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-xs text-gray-400">
                      <div>
                        <p className="text-gray-500 uppercase tracking-wide">Usos Máximos</p>
                        <p className="text-white font-medium">{coupon.maxRedemptions}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-wide">Validade</p>
                        <p className="text-white font-medium">{formatDate(coupon.expiresAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase tracking-wide">Criado por</p>
                        <p className="text-white font-medium text-xs truncate">{coupon.createdBy || '—'}</p>
                      </div>
                    </div>
                    {coupon.createdAt && (
                      <p className="text-xs text-gray-600">
                        Criado em {new Date(coupon.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
