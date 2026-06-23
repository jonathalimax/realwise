/**
 * Format a date as dd/mm/aaaa (Brazil format)
 * @param {Date | string} date - Date object or ISO string
 * @returns {string} Formatted date as dd/mm/aaaa
 */
export const formatDateBR = (date) => {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * Parse dd/mm/aaaa format to ISO string for database
 * @param {string} dateStr - Date string as dd/mm/aaaa
 * @returns {string} ISO format date string
 */
export const parseDateBR = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return '';

  const [day, month, year] = dateStr.split('/');
  if (!day || !month || !year) return '';

  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  return date.toISOString();
};

/**
 * Get display date from ISO string
 * @param {string} isoDate - ISO format date string
 * @returns {string} Formatted date as dd/mm/aaaa
 */
export const getDisplayDate = (isoDate) => formatDateBR(isoDate);
