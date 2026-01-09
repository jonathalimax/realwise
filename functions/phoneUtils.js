/**
 * Normalize WhatsApp sender to BR E.164 and fix missing leading 9 when necessary.
 * Rules:
 * - Expect E.164 starting with 55 for Brazil.
 * - If length is 13, return as-is.
 * - If length is 12 (missing the mobile leading 9), insert '9' after DDD.
 * - If local 11-digit mobile (DDD + 9 + 8), prepend 55.
 * - Otherwise, throw to avoid silent corruption.
 */
function normalizeBrazilE164FixNine(input) {
  if (!input) throw new Error('Missing sender');
  const digits = String(input).replace(/\D+/g, '');

  // Local 11-digit mobile: DDD(2) + 9 + 8
  if (!digits.startsWith('55') && digits.length === 11 && digits[2] === '9') {
    return '55' + digits;
  }

  // Already correct E.164: 55 + DDD(2) + 9 + 8 = 13
  if (digits.startsWith('55') && digits.length === 13) {
    return digits;
  }

  // Missing 9 case: 55 + DDD(2) + 8 = 12 → insert '9' after DDD
  if (digits.startsWith('55') && digits.length === 12) {
    const country = '55';
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4); // 8-digit subscriber
    const fixed = country + ddd + '9' + rest;
    if (/^55\d{2}9\d{8}$/.test(fixed)) return fixed;
    throw new Error('Failed to fix missing 9: ' + input + ' -> ' + digits + ' -> ' + fixed);
  }

  throw new Error('Invalid or unsupported BR number: ' + input + ' -> ' + digits);
}

/** Assert final BR E.164 format for safety. */
function assertBrazilE164(input) {
  if (!/^55\d{2}9\d{8}$/.test(input)) {
    throw new Error('Not BR E.164 mobile: ' + input);
  }
  return input;
}

module.exports = {
  normalizeBrazilE164FixNine,
  assertBrazilE164
};