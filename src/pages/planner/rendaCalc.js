/**
 * Pure functions for Renda (income) tab calculations.
 *
 * A deduction entry:
 *   { id: string, label: string, type: 'pct' | 'value', amount: number }
 *
 * - type 'pct'  → amount is a percentage of salarioBruto (e.g. 6 = 6 %)
 * - type 'value' → amount is a fixed BRL value
 */

/**
 * Resolves a single deduction to a BRL amount.
 * @param {number} salarioBruto
 * @param {{ type: 'pct'|'value', amount: number }} deduction
 * @returns {number}
 */
export function resolveDeduction(salarioBruto, deduction) {
  if (deduction.type === 'pct') {
    return salarioBruto * deduction.amount / 100;
  }
  return deduction.amount;
}

/**
 * Sums all deductions to a total BRL amount.
 * @param {number} salarioBruto
 * @param {Array<{ type: 'pct'|'value', amount: number }>} deductions
 * @returns {number}
 */
export function computeDeductionTotal(salarioBruto, deductions = []) {
  if (!Array.isArray(deductions)) return 0;
  return deductions.reduce((sum, d) => sum + resolveDeduction(salarioBruto, d), 0);
}

/**
 * Computes net salary after all deductions.
 * @param {number} salarioBruto
 * @param {Array<{ type: 'pct'|'value', amount: number }>} deductions
 * @returns {number}
 */
export function computeNetSalary(salarioBruto, deductions) {
  return salarioBruto - computeDeductionTotal(salarioBruto, deductions);
}
