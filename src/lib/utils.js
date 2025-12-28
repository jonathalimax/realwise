/**
 * Merge class names together
 * A simple implementation of the cn utility from shadcn/ui
 * @param {...string} classes - Class names to merge
 * @returns {string} Merged class names
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
