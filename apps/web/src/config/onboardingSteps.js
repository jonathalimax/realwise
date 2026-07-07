/**
 * Onboarding wizard step definitions.
 *
 * Each step has:
 *   id       — unique string key
 *   title    — short heading shown in the wizard
 *   subtitle — one-line description of what the user does in this step
 *
 * isComplete(profile) returns true when the user has finished that step.
 * `profile` is a plain object with the fields populated during onboarding:
 *   {
 *     hasAccount: boolean,   // at least one bank account/card added
 *     hasRenda: boolean,     // salarioBruto > 0
 *     hasTransaction: boolean, // at least one transaction recorded
 *   }
 */

export const ONBOARDING_STEPS = [
  {
    id: 'renda',
    title: 'Configure seu planejamento',
    subtitle: 'Adicione salário por mês, deduções e regras por porcentagem e por categoria.',
    isComplete: (profile) => Boolean(profile?.hasRenda),
  },
  {
    id: 'account',
    title: 'Adicione bancos e cartões',
    subtitle: 'Cadastre suas contas bancárias e cartões para preparar a importação.',
    isComplete: (profile) => Boolean(profile?.hasAccount),
  },
  {
    id: 'transaction',
    title: 'Importe seu extrato',
    subtitle: 'Traga seu extrato para começar a categorizar e acompanhar seus dados reais.',
    isComplete: (profile) => Boolean(profile?.hasTransaction),
  },
];

/**
 * Returns the index of the first incomplete step, or -1 if all are complete.
 * @param {object} profile
 * @returns {number}
 */
export function getFirstIncompleteIndex(profile) {
  return ONBOARDING_STEPS.findIndex(step => !step.isComplete(profile));
}

/**
 * Returns true when every step is complete.
 * @param {object} profile
 * @returns {boolean}
 */
export function isOnboardingComplete(profile) {
  return ONBOARDING_STEPS.every(step => step.isComplete(profile));
}

/**
 * Returns the number of completed steps.
 * @param {object} profile
 * @returns {number}
 */
export function countCompletedSteps(profile) {
  return ONBOARDING_STEPS.filter(step => step.isComplete(profile)).length;
}
