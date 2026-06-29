import { useState } from 'react';
import CurrencyInput from './ui/CurrencyInput';

export default function BillPaymentModal({ isOpen, bill, initialAmount = 0, onClose, onConfirm, language = 'en' }) {
  const [paidAmount, setPaidAmount] = useState(String(initialAmount || bill?.amount || 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !bill) return null;

  const handleConfirm = async (event) => {
    event.stopPropagation();
    setSaving(true);
    setError('');

    try {
      await onConfirm({
        bill,
        paidAmount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark bill as paid');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900 rounded-lg p-3 flex items-center gap-2 z-10">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-emerald-800 dark:text-emerald-200 truncate">
          {bill.name}
        </div>
        <div className="mt-1">
          <CurrencyInput
            value={paidAmount || 0}
            onChange={(value) => setPaidAmount(value)}
          />
        </div>
        {error && (
          <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
      <button
        onClick={handleConfirm}
        disabled={saving}
        className="px-2 sm:px-3 py-1 bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition"
      >
        {saving ? (language === 'pt' ? 'Salvando...' : 'Saving...') : (language === 'pt' ? 'Confirmar' : 'Confirm')}
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="px-2 sm:px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        {language === 'pt' ? 'Cancelar' : 'Cancel'}
      </button>
    </div>
  );
}
