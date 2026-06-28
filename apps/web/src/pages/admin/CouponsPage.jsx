import { useState, useMemo, useEffect } from 'react';
import QRCodeModal from './QRCodeModal';
import { couponsResource } from '../../lib/api/resources/coupons';

// Module-level function to get coupon status with fresh `now`
function getCouponStatus(coupon, now) {
  const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;
  if (validUntil && validUntil < now) return 'expired';
  if (!coupon.enabled) return 'disabled';
  return 'active';
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [qrCoupon, setQrCoupon] = useState(null);

  useEffect(() => {
    let active = true;
    couponsResource.list()
      .then((rows) => {
        if (!active) return;
        setCoupons(rows);
      })
      .catch((error) => {
        console.error('Failed to load coupons:', error);
        if (!active) return;
        setCoupons([]);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    let result = coupons;
    if (filterStatus !== 'all') result = result.filter(c => getCouponStatus(c, now) === filterStatus);
    if (filterType !== 'all') result = result.filter(c => c.discountType === filterType);
    result = [...result].sort((a, b) => {
      let av, bv;
      if (sortBy === 'code') { av = a.code; bv = b.code; }
      else if (sortBy === 'currentUses') { av = a.currentUses || 0; bv = b.currentUses || 0; }
      else { av = new Date(a.createdAt || 0).getTime(); bv = new Date(b.createdAt || 0).getTime(); }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return result;
  }, [coupons, filterStatus, filterType, sortBy, sortDir]);

  async function handleToggle(coupon) {
    await couponsResource.update(coupon.id, { enabled: !coupon.enabled });
    setCoupons((prev) => prev.map((item) => (
      item.id === coupon.id ? { ...item, enabled: !item.enabled } : item
    )));
  }

  function formatDiscount(coupon) {
    if (coupon.discountType === 'percentage') return `${coupon.discountValue}%`;
    return `R$ ${((coupon.discountValue || 0) / 100).toFixed(2).replace('.', ',')}`;
  }

  function formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('pt-BR');
  }

  const STATUS_CLASSES = {
    active: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    disabled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    expired: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  };
  const STATUS_LABELS = { active: 'Ativo', disabled: 'Desabilitado', expired: 'Expirado' };

  function SortHeader({ col, label }) {
    const active = sortBy === col;
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
        onClick={() => {
          if (active) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setSortBy(col); setSortDir('desc'); }
        }}
      >
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cupons</h1>
        <button
          onClick={() => { setEditingCoupon(null); setShowModal(true); }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          + Criar Cupom
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="disabled">Desabilitado</option>
          <option value="expired">Expirado</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="all">Todos os tipos</option>
          <option value="percentage">Percentual</option>
          <option value="fixed_amount">Valor fixo</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <SortHeader col="code" label="Código" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Desconto</th>
              <SortHeader col="currentUses" label="Usos" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Válido de</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Válido até</th>
              <SortHeader col="createdAt" label="Criado em" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {filtered.map(coupon => {
              const status = getCouponStatus(coupon, new Date());
              return (
                <tr key={coupon.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900 dark:text-white">{coupon.code}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDiscount(coupon)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{coupon.currentUses || 0} / {coupon.maxUses ?? '∞'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(coupon.validFrom)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(coupon.validUntil)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(coupon.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingCoupon(coupon); setShowModal(true); }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(coupon)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        {coupon.enabled ? 'Desabilitar' : 'Habilitar'}
                      </button>
                      <button
                        onClick={() => setQrCoupon(coupon)}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Gerar QR
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  Nenhum cupom encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateEditCouponModal
          coupon={editingCoupon}
          onClose={() => { setShowModal(false); setEditingCoupon(null); }}
        />
      )}
      {qrCoupon && (
        <QRCodeModal coupon={qrCoupon} onClose={() => setQrCoupon(null)} />
      )}
    </div>
  );
}

function CreateEditCouponModal({ coupon, onClose }) {
  const isEdit = !!coupon;
  const [code, setCode] = useState(coupon?.code || '');
  const [discountType, setDiscountType] = useState(coupon?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(
    coupon
      ? (coupon.discountType === 'fixed_amount'
        ? ((coupon.discountValue ?? 0) / 100).toString()
        : (coupon.discountValue ?? 0).toString())
      : ''
  );
  const [maxUses, setMaxUses] = useState(coupon?.maxUses?.toString() || '');
  const [validFrom, setValidFrom] = useState(() => {
    const d = coupon?.validFrom;
    if (!d) return '';
    const date = typeof d.toDate === 'function' ? d.toDate() : new Date(d);
    return date.toISOString().split('T')[0];
  });
  const [validUntil, setValidUntil] = useState(() => {
    const d = coupon?.validUntil;
    if (!d) return '';
    const date = typeof d.toDate === 'function' ? d.toDate() : new Date(d);
    return date.toISOString().split('T')[0];
  });
  const [enabled, setEnabled] = useState(coupon?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!code.trim()) { setError('Código é obrigatório.'); return; }
    if (!discountValue || Number(discountValue) <= 0) { setError('Valor do desconto inválido.'); return; }
    if (validFrom && validUntil && new Date(validFrom) > new Date(validUntil)) {
      setError('A data de início não pode ser após a data de término.');
      return;
    }
    setSaving(true);
    setError('');
    const storedValue = discountType === 'fixed_amount'
      ? Math.round(Number(discountValue) * 100)
      : Number(discountValue);
    const data = {
      code: code.toUpperCase().trim(),
      discountType,
      discountValue: storedValue,
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: validUntil ? new Date(validUntil) : null,
      enabled,
    };
    try {
      if (isEdit) {
        await couponsResource.update(coupon.id, data);
      } else {
        await couponsResource.create(data);
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar cupom.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {isEdit ? 'Editar Cupom' : 'Criar Cupom'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="BEMVINDO50"
              className="w-full font-mono px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de desconto</label>
            <select
              value={discountType}
              onChange={e => setDiscountType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="percentage">Percentual (%)</option>
              <option value="fixed_amount">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {discountType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
            </label>
            <input
              type="number"
              min="0"
              max={discountType === 'percentage' ? 100 : undefined}
              step={discountType === 'percentage' ? 1 : 0.01}
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Máximo de usos (vazio = ilimitado)
            </label>
            <input
              type="number"
              min="1"
              value={maxUses}
              onChange={e => setMaxUses(e.target.value)}
              placeholder="Ilimitado"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Válido de</label>
              <input
                type="date"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Válido até</label>
              <input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Habilitado</span>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
