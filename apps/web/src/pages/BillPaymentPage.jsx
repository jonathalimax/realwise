import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient, ApiError } from '../lib/api/client';

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MAX_CENTS = 9999999999; // R$ 99.999.999,99

function formatCents(cents) {
  if (cents === 0) return '';
  const intPart = Math.floor(cents / 100);
  const decPart = (cents % 100).toString().padStart(2, '0');
  const formattedInt = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formattedInt},${decPart}`;
}

/**
 * Standalone BRL currency input for this page only.
 *
 * BillPaymentPage is rendered outside the app's provider tree (public
 * magic-link page, no auth/access/settings context), so it can't reuse the
 * shared CurrencyInput component — that one requires SettingsContext.
 */
function BillCurrencyInput({ value, onChange }) {
  const [cents, setCents] = useState(() => (value && value > 0 ? Math.round(value * 100) : 0));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    const incoming = value && value > 0 ? Math.round(value * 100) : 0;
    if (incoming !== cents) setCents(incoming);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (newCents) => {
    const clamped = Math.min(Math.max(0, newCents), MAX_CENTS);
    skipSync.current = true;
    setCents(clamped);
    onChange(clamped / 100);
  };

  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      commit(cents * 10 + parseInt(e.key, 10));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      commit(Math.floor(cents / 10));
    } else if (e.key === 'Delete') {
      e.preventDefault();
      commit(0);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (digits) commit(Math.min(parseInt(digits, 10), MAX_CENTS));
  };

  const handleClick = (e) => {
    const len = e.target.value.length;
    e.target.setSelectionRange(len, len);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatCents(cents)}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onClick={handleClick}
      onFocus={handleClick}
      placeholder="R$ 0,00"
      className="w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-lg
        text-[var(--rw-ink)] placeholder-gray-400
        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
        transition-all duration-200"
    />
  );
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
          <h1 className="text-2xl font-bold text-[var(--rw-ink)]">Pagamento confirmado</h1>
          <p className="mt-3 text-sm text-[var(--rw-muted)]">
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
          <h1 className="text-2xl font-bold text-[var(--rw-ink)]">{bill?.name}</h1>
          <p className="text-sm text-[var(--rw-muted)]">
            Vencimento {bill?.dueDate ? new Date(`${bill.dueDate}T12:00:00`).toLocaleDateString('pt-BR') : '—'}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--rw-border)] bg-white/70 dark:bg-gray-800/70 p-4">
          <label className="block text-sm font-medium text-[var(--rw-ink)] mb-2">
            Valor pago
          </label>
          <BillCurrencyInput value={paidAmount || 0} onChange={(value) => setPaidAmount(value)} />
          <p className="mt-2 text-xs text-[var(--rw-muted)]">
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
