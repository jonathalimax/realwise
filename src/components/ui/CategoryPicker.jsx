import { useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { createPortal } from 'react-dom';

export default function CategoryPicker({ isOpen, onClose, onSelect, currentCategory, type, anchorEl }) {
  const { categories } = useSettings();
  const dropdownRef = useRef(null);

  // Position the dropdown relative to the anchor element
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    const anchor = anchorEl?.current || anchorEl;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const dropdown = dropdownRef.current;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = dropdown.offsetHeight;
    const dropdownWidth = dropdown.offsetWidth;

    // Position below anchor by default, above if not enough room
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const top = spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove
      ? rect.bottom + 4
      : rect.top - dropdownHeight - 4;

    // Align left edge with anchor, clamp to viewport
    let left = rect.left;
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }
    if (left < 8) left = 8;

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  }, [isOpen, anchorEl]);

  // Close on click outside
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
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 10);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
  }, [isOpen, onClose, anchorEl]);

  // Close on Escape
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
  };

  return createPortal(
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', zIndex: 9999, width: 220 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1 max-h-72 overflow-y-auto">
        {categoryList.map((category) => (
          <button
            key={category}
            onClick={() => handleSelect(category)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              currentCategory === category
                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {currentCategory === category && (
              <svg className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className={currentCategory === category ? '' : 'ml-5'}>{category}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
