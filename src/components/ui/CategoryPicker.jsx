import { useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

/**
 * Floating category picker that appears as a popover
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the picker is open
 * @param {function} props.onClose - Called when picker should close
 * @param {function} props.onSelect - Called with selected category
 * @param {string} props.currentCategory - Currently selected category
 * @param {string} props.type - Transaction type ('income' or 'expense')
 * @param {Object} props.anchorRef - Ref to the element to anchor the picker to (optional)
 */
export default function CategoryPicker({ isOpen, onClose, onSelect, currentCategory, type }) {
  const { categories } = useSettings();
  const pickerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categoryList = categories[type] || [];

  const handleSelect = (category) => {
    onSelect(category);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        ref={pickerRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-xs w-full max-h-[70vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {type === 'income' ? 'Categoria' : 'Categoria'}
          </span>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category List */}
        <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
          {categoryList.map((category) => (
            <button
              key={category}
              onClick={() => handleSelect(category)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                currentCategory === category
                  ? 'bg-violet-50 dark:bg-violet-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {currentCategory === category && (
                <svg className="w-5 h-5 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className={`text-sm font-medium ${
                currentCategory === category
                  ? 'text-violet-700 dark:text-violet-300 ml-0'
                  : 'text-gray-700 dark:text-gray-300 ml-8'
              }`}>
                {category}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
