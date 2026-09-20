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

/**
 * A benefit entry (e.g. meal allowance, transport voucher):
 *   { id: string, label: string, type: 'pct' | 'value', amount: number }
 *
 * Benefits are added after net salary and are never subject to deductions.
 */

/**
 * Resolves a single benefit to a BRL amount.
 * @param {number} salarioBruto
 * @param {{ type: 'pct'|'value', amount: number }} benefit
 * @returns {number}
 */
export function resolveBenefit(salarioBruto, benefit) {
  if (benefit.type === 'pct') {
    return salarioBruto * benefit.amount / 100;
  }
  return benefit.amount;
}

/**
 * Sums all benefits to a total BRL amount.
 * @param {number} salarioBruto
 * @param {Array<{ type: 'pct'|'value', amount: number }>} benefits
 * @returns {number}
 */
export function computeBenefitsTotal(salarioBruto, benefits = []) {
  if (!Array.isArray(benefits)) return 0;
  return benefits.reduce((sum, b) => sum + resolveBenefit(salarioBruto, b), 0);
}

/**
 * Computes final take-home income: net salary after deductions, plus benefits
 * that are not subject to any discount.
 * @param {number} salarioBruto
 * @param {Array<{ type: 'pct'|'value', amount: number }>} deductions
 * @param {Array<{ type: 'pct'|'value', amount: number }>} benefits
 * @returns {number}
 */
export function computeTotalIncome(salarioBruto, deductions, benefits) {
  return computeNetSalary(salarioBruto, deductions) + computeBenefitsTotal(salarioBruto, benefits);
}
