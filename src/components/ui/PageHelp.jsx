// src/components/ui/PageHelp.jsx
import { useState } from 'react';

export default function PageHelp({ title, text, hasFab = false }) {
  const [open, setOpen] = useState(false);

  const fabPosition = hasFab ? 'bottom-24' : 'bottom-6';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed ${fabPosition} right-6 z-40 w-10 h-10 rounded-full bg-gray-700 dark:bg-gray-600 border border-gray-600 dark:border-gray-500 text-gray-300 text-sm font-bold shadow-lg flex items-center justify-center hover:bg-gray-600 dark:hover:bg-gray-500 transition-colors`}
        aria-label="Como funciona"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-gray-800 rounded-t-2xl shadow-xl border-t border-gray-200 dark:border-gray-700 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📖</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Como funciona</h3>
              {title && <span className="text-xs text-gray-400">— {title}</span>}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{text}</p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
