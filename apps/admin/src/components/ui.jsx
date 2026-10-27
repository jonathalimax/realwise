import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, X } from 'lucide-react';
import { friendlyError } from '../lib/api/errors';

export const inputClass =
  'w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 disabled:opacity-50';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '', padded = true }) {
  return (
    <section className={`bg-gray-900 border border-gray-800 rounded-xl min-w-0 ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-1 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-gray-200">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

const buttonVariants = {
  primary: 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-100 border-gray-700',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-300 border-transparent',
  danger: 'bg-red-600 hover:bg-red-500 text-white border-transparent',
  dangerOutline: 'bg-transparent hover:bg-red-950/50 text-red-400 border-red-900',
};

export function Button({ variant = 'secondary', size = 'md', loading = false, icon: Icon, children, className = '', disabled, ...props }) {
  const sizing = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizing} ${buttonVariants[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon ? <Icon className="w-4 h-4" /> : null}
      {children}
    </button>
  );
}

const badgeTones = {
  gray: 'bg-gray-800 text-gray-300 border-gray-700',
  green: 'bg-emerald-950 text-emerald-300 border-emerald-900',
  blue: 'bg-sky-950 text-sky-300 border-sky-900',
  amber: 'bg-amber-950 text-amber-300 border-amber-900',
  red: 'bg-red-950 text-red-300 border-red-900',
  purple: 'bg-violet-950 text-violet-300 border-violet-900',
};

export function Badge({ tone = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-xs font-medium text-gray-400 mb-1">{label}</span>}
      {children}
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-emerald-600' : 'bg-gray-700'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`w-5 h-5 animate-spin text-emerald-500 ${className}`} />;
}

export function LoadingBlock({ label = 'Carregando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ title = 'Nada por aqui ainda', description, icon: Icon = Inbox, children }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1 max-w-sm">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center py-10 px-4 ${className}`}>
      <div className="w-11 h-11 rounded-full bg-red-950 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm font-medium text-gray-200">Não foi possível carregar</p>
      <p className="text-xs text-gray-500 mt-1 max-w-sm">{friendlyError(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={() => onRetry()}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / empty / content for an useAsync result. */
export function AsyncView({ state, isEmpty, empty, children }) {
  if (state.loading && !state.data) return <LoadingBlock />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (isEmpty?.(state.data)) return empty ?? <EmptyState />;
  return children(state.data);
}

export function InlineMessage({ tone = 'error', children }) {
  if (!children) return null;
  const tones = {
    error: 'bg-red-950/60 border-red-900 text-red-300',
    success: 'bg-emerald-950/60 border-emerald-900 text-emerald-300',
    info: 'bg-sky-950/60 border-sky-900 text-sky-300',
    warning: 'bg-amber-950/60 border-amber-900 text-amber-300',
  };
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return total > 0 ? <p className="text-xs text-gray-500 px-1 pt-3">{total} {total === 1 ? 'resultado' : 'resultados'}</p> : null;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-gray-500">{from}–{to} de {total.toLocaleString('pt-BR')}</p>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-gray-400 px-2">{page} / {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Próxima página">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl`}>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-gray-800" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-4 text-sm text-gray-300 space-y-3">{children}</div>
        {footer && <div className="px-5 pb-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for destructive actions. `confirmText` (optional) forces
 * the operator to type a phrase before the button enables.
 */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', confirmText, onConfirm, onClose, tone = 'danger', confirmDisabled = false, children }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setTyped(''); setBusy(false); setError(''); }
  }, [open]);

  const ready = !confirmText || typed.trim() === confirmText;

  async function handle() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={handle} loading={busy} disabled={!ready || confirmDisabled}>{confirmLabel}</Button>
        </>
      )}
    >
      {description && <p className="text-gray-400">{description}</p>}
      {children}
      {confirmText && (
        <Field label={`Digite ${confirmText} para confirmar`}>
          <input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      )}
      <InlineMessage>{error}</InlineMessage>
    </Modal>
  );
}

export function Toast({ message, tone = 'success', onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onDone?.(), 4000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[60] sm:max-w-sm">
      <InlineMessage tone={tone}>{message}</InlineMessage>
    </div>
  );
}

/** Horizontally scrollable wrapper so wide tables never break the page on phones. */
export function TableWrap({ children }) {
  return <div className="overflow-x-auto -mx-4 sm:mx-0"><div className="min-w-full inline-block align-middle px-4 sm:px-0">{children}</div></div>;
}

export const thClass = 'text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-3 py-2 whitespace-nowrap';
export const tdClass = 'px-3 py-2.5 text-sm text-gray-300 align-middle';

export function Stat({ label, value, hint, icon: Icon, tone = 'text-white' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />}
      </div>
      <p className={`text-xl sm:text-2xl font-bold mt-1.5 truncate ${tone}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-500 mt-1 truncate">{hint}</p>}
    </div>
  );
}
