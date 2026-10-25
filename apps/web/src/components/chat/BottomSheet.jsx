import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/** Mobile-first bottom sheet (centered dialog on wide screens). Closes on backdrop click and Escape. */
export default function BottomSheet({ title, subtitle, onClose, footer, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-black text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Fechar">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}
