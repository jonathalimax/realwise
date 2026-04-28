import { useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { createPortal } from 'react-dom';

export default function CategoryPicker({ isOpen, onClose, onSelect, currentCategory, type, anchorEl }) {
  const { categories } = useSettings();
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    const anchor = anchorEl?.current || anchorEl;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const dropdown = dropdownRef.current;
    const dropdownHeight = dropdown.offsetHeight;
    const dropdownWidth = dropdown.offsetWidth;

    // Position below anchor (downward direction)
    const top = rect.bottom + 8;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8));

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  }, [isOpen, anchorEl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      const anchor = anchorEl?.current || anchorEl;
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        (!anchor || !anchor.contains(e.target))
      ) {
        onClose();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen, onClose, anchorEl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categoryList = [...(categories[type] || [])].sort((a, b) => a.localeCompare(b));

  const handleSelect = (category) => {
    onSelect(category);
    onClose();
  };

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', zIndex: 9999, maxWidth: 'calc(100vw - 32px)' }}
      className="bg-gray-800 dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 dark:border-gray-600 overflow-hidden backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-h-96 overflow-y-auto py-2">
        {categoryList.map((category) => (
          <button
            key={category}
            onClick={() => handleSelect(category)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-base transition-colors ${
              currentCategory === category
                ? 'bg-blue-500 text-white font-bold'
                : 'text-gray-300 hover:bg-gray-700 dark:hover:bg-gray-800 font-medium'
            }`}
          >
            {currentCategory === category && (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
            )}
            <span>{category}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
