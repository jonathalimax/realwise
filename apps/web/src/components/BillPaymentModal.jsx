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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={language === 'pt' ? 'Fechar' : 'Close'}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <div
        className="relative w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xl dark:border-emerald-800 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            {language === 'pt' ? 'Confirmar pagamento' : 'Confirm payment'}
          </p>
          <h3 className="mt-1 text-lg font-bold text-[var(--rw-ink)]">
            {bill.name}
          </h3>
        </div>

        <CurrencyInput
          value={paidAmount || 0}
          onChange={(value) => setPaidAmount(value)}
        />

        {error && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {language === 'pt' ? 'Cancelar' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? (language === 'pt' ? 'Salvando...' : 'Saving...') : (language === 'pt' ? 'Confirmar' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
