import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Mobile-first bottom sheet (centered dialog on wide screens). Closes on backdrop click and Escape.
 * While open the page behind cannot scroll (overflow: hidden on html and body; the scroll position is kept).
 * No backdrop-filter on purpose — it triggers an iOS Safari repaint bug.
 */
export default function BottomSheet({ title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock the page behind the sheet with overflow: hidden, which keeps the scroll position by itself.
  // Never `position: fixed` on <body>: with a long conversation behind it (a tall fixed body), iOS WebKit
  // stops painting the page and the sheet, leaving a blank screen.
  useEffect(() => {
    const root = document.documentElement.style;
    const body = document.body.style;
    const previous = { root: root.overflow, body: body.overflow };
    root.overflow = 'hidden';
    body.overflow = 'hidden';
    return () => {
      root.overflow = previous.root;
      body.overflow = previous.body;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 touch-none" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--rw-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-black text-[var(--rw-ink)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--rw-muted)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Fechar">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-3 space-y-3">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}
