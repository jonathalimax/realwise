// "R$ 2.440,00" -> "R$ 2.440": whole reais read faster on a phone; cents stay when they matter.
export const trimCents = (text) => String(text).replace(/,00(?=\D*$)/, '');

/**
 * Money for big numbers on a phone: whole reais under 10 thousand ("R$ 4.379"), "R$ 30,3 mil" above it.
 * `formatFull` is the settings formatter, so the currency symbol follows the user's setting. Pass an absolute value.
 */
export function compactMoney(formatFull, value, pt) {
  if (Math.abs(value) < 10000) return trimCents(formatFull(Math.round(value)));
  const symbol = formatFull(0).replace(/[\d.,\s-]/g, '');
  const thousands = (Math.abs(value) / 1000).toFixed(1).replace(/\.0$/, '');
  return pt ? `${symbol} ${thousands.replace('.', ',')} mil` : `${symbol}${thousands}k`;
}
