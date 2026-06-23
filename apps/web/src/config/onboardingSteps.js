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
    id: 'account',
    title: 'Adicione uma conta',
    subtitle: 'Cadastre sua conta bancária ou cartão de crédito.',
    isComplete: (profile) => Boolean(profile?.hasAccount),
  },
  {
    id: 'renda',
    title: 'Configure sua renda',
    subtitle: 'Informe seu salário bruto e deduções mensais.',
    isComplete: (profile) => Boolean(profile?.hasRenda),
  },
  {
    id: 'transaction',
    title: 'Registre uma movimentação',
    subtitle: 'Adicione uma receita ou despesa manualmente ou via importação.',
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
