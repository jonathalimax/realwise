import { useState, useEffect, useCallback } from 'react';
import { couponsResource } from '../../lib/api/resources/coupons';

export default function CouponManagementPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newCoupon, setNewCoupon] = useState({ code: '', discountPercent: '', description: '' });

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await couponsResource.list();
      setCoupons(rows);
    } catch (err) {
      setError('Failed to load coupons: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCreateCoupon = useCallback(async () => {
    if (!newCoupon.code || newCoupon.discountPercent === '') {
      setError('Code and discount are required');
      return;
    }

    try {
      setError('');
      await couponsResource.create({
        code: newCoupon.code.toUpperCase(),
        discountType: 'percentage',
        discountValue: parseInt(newCoupon.discountPercent, 10),
        enabled: true,
      });
      setNewCoupon({ code: '', discountPercent: '', description: '' });
      await loadCoupons();
    } catch (err) {
      setError('Failed to create coupon: ' + err.message);
    }
  }, [newCoupon, loadCoupons]);

  const handleActivateCoupon = useCallback(async (code) => {
    try {
      setError('');
      const coupon = coupons.find((item) => item.code === code);
      if (coupon?.id) {
        await couponsResource.update(coupon.id, { enabled: true });
      }
      await loadCoupons();
    } catch (err) {
      setError('Failed to activate coupon: ' + err.message);
    }
  }, [coupons, loadCoupons]);

  const handleDeactivateAll = useCallback(async () => {
    try {
      setError('');
      await Promise.all(coupons.map((coupon) => couponsResource.update(coupon.id, { enabled: false })));
      await loadCoupons();
    } catch (err) {
      setError('Failed to deactivate: ' + err.message);
    }
  }, [coupons, loadCoupons]);

  const handleDeleteCoupon = useCallback(async (code) => {
    if (window.confirm(`Delete coupon ${code}?`)) {
      try {
        setError('');
        const coupon = coupons.find((item) => item.code === code);
        if (coupon?.id) {
          await couponsResource.remove(coupon.id);
        }
        await loadCoupons();
      } catch (err) {
        setError('Failed to delete coupon: ' + err.message);
      }
    }
  }, [coupons, loadCoupons]);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-lg font-bold text-white mb-6">Coupon Management</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 space-y-3">
        <h2 className="font-semibold text-white">Create New Coupon</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Code</label>
          <input
            type="text"
            value={newCoupon.code}
            onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })}
            placeholder="PROMO50"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Discount %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={newCoupon.discountPercent}
            onChange={(e) => setNewCoupon({ ...newCoupon, discountPercent: e.target.value })}
            placeholder="50"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
          <input
            type="text"
            value={newCoupon.description}
            onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
            placeholder="Launch special"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <button
          onClick={handleCreateCoupon}
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {loading ? 'Creating...' : 'Create Coupon'}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-white">Active Coupons</h2>
          {coupons.some((c) => c.enabled) && (
            <button
              onClick={handleDeactivateAll}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
            >
              Deactivate All
            </button>
          )}
        </div>

        {coupons.length === 0 ? (
          <p className="text-gray-400 text-sm">No coupons yet</p>
        ) : (
          <div className="space-y-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.code}
                className={`p-4 rounded-lg border ${
                  coupon.enabled
                    ? 'bg-gray-800 border-violet-700'
                    : 'bg-gray-900 border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{coupon.code}</span>
                      <span className="text-sm font-bold text-rose-400">{coupon.discountValue}% OFF</span>
                      {coupon.enabled && (
                        <span className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">ACTIVE</span>
                      )}
                    </div>
                    {coupon.description && (
                      <p className="text-xs text-gray-400 mt-1">{coupon.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!coupon.enabled && (
                      <button
                        onClick={() => handleActivateCoupon(coupon.code)}
                        className="text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCoupon(coupon.code)}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
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
