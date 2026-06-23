import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * SlidePanel - A slide-in panel from the right side
 *
 * @param {boolean} isOpen - Controls visibility
 * @param {function} onClose - Called when panel should close
 * @param {string} title - Panel header title
 * @param {React.ReactNode} children - Panel content
 * @param {string} width - Panel width (default: 'max-w-md')
 * @param {boolean} showOnMobile - If false, renders children in a modal on mobile (default: true)
 */
export default function SlidePanel({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-md',
  showOnMobile = true
}) {
  const panelRef = useRef(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Panel Container */}
      <div className="absolute inset-y-0 right-0 flex max-w-full">
        {/* Panel */}
        <div
          ref={panelRef}
          className={`w-screen ${width} transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
