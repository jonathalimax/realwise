import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { validateCoupon } from '../../utils/couponValidator';

export default function CouponInput({ onCouponApply, currentCoupon }) {
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleApply = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await validateCoupon(couponCode);

    if (result.valid) {
      setSuccess(`Coupon applied! ${result.discountPercent}% discount`);
      onCouponApply(result);
      setCouponCode('');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleRemove = () => {
    setCouponCode('');
    setError('');
    setSuccess('');
    onCouponApply(null);
  };

  if (currentCoupon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50"
      >
        <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
            {currentCoupon.discountPercent}% OFF · {currentCoupon.code}
          </p>
          {currentCoupon.description && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {currentCoupon.description}
            </p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm font-medium"
        >
          Remove
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={couponCode}
          onChange={(e) => {
            setCouponCode(e.target.value.toUpperCase());
            setError('');
            setSuccess('');
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleApply()}
          placeholder="Have a coupon? Enter the code..."
          className="flex-1 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          onClick={handleApply}
          disabled={loading || !couponCode.trim()}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Applying...</span>
            </>
          ) : (
            'Apply'
          )}
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50"
        >
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50"
        >
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
