import { useRef, useState } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';

const toBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** "15112026" -> "15/11/2026", as the person types. */
const mask = (digits) => {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** "15/11/2026" -> "2026-11-15", or null when it is not a real calendar day. */
const toIso = (br) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Date field that always reads and writes DD/MM/AAAA. A native <input type="date"> follows the browser's own language,
 * so it showed MM/DD/YYYY to people whose browser is set to English. Same contract as the native input: `value` is
 * YYYY-MM-DD and `onChange` gets an event-like object whose `target.value` is YYYY-MM-DD (or '' when cleared).
 * The calendar icon opens the native picker for people who prefer to pick.
 */
export default function DateInput({ value, onChange, min, max, className = '', disabled, required, id, name, placeholder = 'DD/MM/AAAA', onBlur, ...rest }) {
  const [draft, setDraft] = useState(null); // text being typed; null while showing the saved value
  const pickerRef = useRef(null);
  const shown = draft ?? toBr(value);
  const emit = (iso) => onChange?.({ target: { value: iso, name, id }, currentTarget: { value: iso, name, id } });
  const inRange = (iso) => (!min || iso >= min) && (!max || iso <= max);

  const handleText = (e) => {
    const next = mask(e.target.value);
    setDraft(next);
    if (next === '') return emit('');
    const iso = toIso(next);
    if (iso && inRange(iso)) emit(iso);
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.focus();
  };

  return (
    <div className="relative">
      <input
        {...rest}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        disabled={disabled}
        required={required}
        onChange={handleText}
        onBlur={(e) => { setDraft(null); onBlur?.(e); }}
        className={`${className} pr-11`}
      />
      <button type="button" tabIndex={-1} onClick={openPicker} disabled={disabled} aria-label="Abrir calendário" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--rw-muted)]">
        <CalendarIcon className="h-5 w-5" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={(e) => { setDraft(null); emit(e.target.value); }}
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </div>
  );
}
