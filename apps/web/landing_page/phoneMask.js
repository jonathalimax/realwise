/** Brazilian phone mask while typing: (11) 9999-9999 for 10 digits, (11) 99999-9999 for 11. A pasted +55 is dropped. */
export function formatBrPhone(value) {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Empty is fine (the field is optional). Otherwise: DDD + 8-digit landline, or DDD + 9 + 8 digits for a mobile. */
export function isValidBrPhone(masked) {
  const d = String(masked ?? '').replace(/\D/g, '');
  if (d.length === 0) return true;
  return /^[1-9][0-9](9\d{8}|[2-5]\d{7})$/.test(d);
}
