const dtf = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const df = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dfShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** BRL from integer cents. */
export function brl(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** USD (AI cost). Small values get more decimals so they never show as $0.00. */
export function usd(value, digits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  let d = digits;
  if (d === undefined) d = Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 3 : 4;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d });
}

export function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR');
}

export function pct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
}

export function ms(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`;
}

export function dateTime(value) {
  const d = toDate(value);
  return d ? dtf.format(d) : '—';
}

export function date(value) {
  const d = toDate(value);
  return d ? df.format(d) : '—';
}

export function dayLabel(value) {
  const d = toDate(`${String(value).slice(0, 10)}T12:00:00`);
  return d ? dfShort.format(d) : String(value);
}

export function relativeTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const suffix = diff >= 0 ? 'atrás' : 'a partir de agora';
  if (abs < min) return 'agora mesmo';
  if (abs < hour) return `${Math.round(abs / min)} min ${suffix}`;
  if (abs < day) return `${Math.round(abs / hour)} h ${suffix}`;
  if (abs < 30 * day) return `${Math.round(abs / day)} d ${suffix}`;
  return date(d);
}

/** Value for <input type="datetime-local"> from an ISO string. */
export function toLocalInput(value) {
  const d = toDate(value);
  if (!d) return '';
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
