import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const CURRENCY_FORMATS = {
  BRL: { thousandSeparator: '.', decimalSeparator: ',', prefix: 'R$ ', placeholder: 'R$ 0,00' },
  USD: { thousandSeparator: ',', decimalSeparator: '.', prefix: '$ ',  placeholder: '$ 0.00'  },
  EUR: { thousandSeparator: '.', decimalSeparator: ',', prefix: '€ ',  placeholder: '€ 0,00'  },
  GBP: { thousandSeparator: ',', decimalSeparator: '.', prefix: '£ ',  placeholder: '£ 0.00'  },
};

const MAX_CENTS = 9999999999; // R$ 99.999.999,99

function formatCents(cents, fmt) {
  if (cents === 0) return '';
  const intPart = Math.floor(cents / 100);
  const decPart = (cents % 100).toString().padStart(2, '0');
  const formattedInt = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandSeparator);
  return `${fmt.prefix}${formattedInt}${fmt.decimalSeparator}${decPart}`;
}

export default function CurrencyInput({ value, onChange, className = '', ...props }) {
  const { currency } = useSettings();
  const fmt = CURRENCY_FORMATS[currency] || CURRENCY_FORMATS.BRL;

  const [cents, setCents] = useState(() =>
    value && value > 0 ? Math.round(value * 100) : 0
  );
  const skipSync = useRef(false);

  // Sync when value changes from outside (form reset, edit load, etc.)
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
    // Tab, arrows, etc. pass through normally
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (digits) commit(Math.min(parseInt(digits, 10), MAX_CENTS));
  };

  // Prevent cursor from wandering — keep it always at end
  const handleClick = (e) => {
    const len = e.target.value.length;
    e.target.setSelectionRange(len, len);
  };

  // Strip our handlers from props to avoid conflicts
  const { onChange: _oc, onKeyDown: _okd, onPaste: _op, ...rest } = props;

  return (
    <input
      type="text"
      inputMode="numeric"
      value={formatCents(cents, fmt)}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onClick={handleClick}
      onFocus={handleClick}
      placeholder={fmt.placeholder}
      className={`w-full px-4 py-3 bg-[var(--rw-raised)] border border-[var(--rw-border)] rounded-xl text-lg
        text-[var(--rw-ink)] placeholder-gray-400
        focus:bg-white dark:focus:bg-gray-600 focus:border-gray-900 dark:focus:border-gray-500 focus:ring-0 focus:outline-none
        transition-all duration-200 ${className}`}
      {...rest}
    />
  );
}
