/** Keeps digits only. */
export const digits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

function checkDigit(base: string, weights: number[]): number {
  const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const first = checkDigit(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(d[9]) && second === Number(d[10]);
}

export function isValidCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const first = checkDigit(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(d[12]) && second === Number(d[13]);
}

/** CPF/CNPJ digits when valid, otherwise null (an invalid document must never reach the Prefeitura). */
export function validDoc(value: unknown): string | null {
  const d = digits(value);
  if (d.length === 11 && isValidCpf(d)) return d;
  if (d.length === 14 && isValidCnpj(d)) return d;
  return null;
}
