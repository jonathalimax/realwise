import { useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '../lib/api/client';
import CurrencyInput from '../components/ui/CurrencyInput';

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BillPaymentPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bill, setBill] = useState(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!token) {
        setError('Link de pagamento ausente.');
        setLoading(false);
        return;
      }

      try {
        const session = await apiClient.get(`/bill-actions/${encodeURIComponent(token)}`);
        setBill(session.bill);
        setPaidAmount(String(session.bill?.amount ?? '0'));
      } catch (err) {
        console.error('[BillPaymentPage] load error', err);
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o pagamento.');
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [token]);

  const handleConfirm = async () => {
    if (!bill) return;
    setSubmitting(true);
    setError('');

    try {
      await apiClient.post(`/bill-actions/${encodeURIComponent(token)}/confirm`, {
        paidAmount,
        paidAt: new Date().toISOString(),
      });
      setSuccess(true);
    } catch (err) {
      console.error('[BillPaymentPage] confirm error', err);
      setError(err instanceof ApiError ? err.message : 'Não foi possível confirmar o pagamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const inner = () => {
    if (loading) {
      return <p className="text-sm text-gray-500">Carregando pagamento...</p>;
    }

    if (error && !bill) {
      return (
        <>
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          <a href="/login" className="mt-4 inline-flex text-sm font-medium text-rose-600 dark:text-rose-400">
            Ir para o login
          </a>
        </>
      );
    }

    if (success) {
      return (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pagamento confirmado</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            A conta {bill?.name} foi marcada como paga.
          </p>
          <a href="/login" className="mt-6 inline-flex items-center justify-center rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-medium text-white">
            Abrir o app
          </a>
        </>
      );
    }

    return (
      <>
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-rose-600">Conta a pagar</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{bill?.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vencimento {bill?.dueDate ? new Date(`${bill.dueDate}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Valor pago
          </label>
          <CurrencyInput value={paidAmount || 0} onChange={(value) => setPaidAmount(value)} />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Valor planejado: {formatCurrency(bill?.amount)}
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Confirmando...' : 'Confirmar pagamento'}
        </button>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-800 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-gray-900/90">
        {inner()}
      </div>
    </div>
  );
}
