/**
 * Installment detection and generation utilities for server-side processing
 * Mirrors the client-side logic in src/services/installments.js
 */

// Patterns to detect installments in transaction descriptions
const INSTALLMENT_PATTERNS = [
  /parcela\s*(\d+)\s*[\/de]\s*(\d+)/i,           // "PARCELA 1/12" or "parcela 1 de 12"
  /(\d+)\s*[\/]\s*(\d+)\s*(?:parcelas?)?/i,      // "1/12" or "1/12 parcelas"
  /(\d+)\s*de\s*(\d+)\s*(?:parcelas?|x)?/i,      // "1 de 12" or "1 de 12x"
  /\((\d+)[\/](\d+)\)/,                           // "(1/12)"
  /(\d+)x\s*de\s*\d+/i,                           // "12x de R$50" - extract total only
];

/**
 * Detect installment info from a transaction description
 * @param {string} description - Transaction description
 * @returns {Object|null} - { current, total } or null if not an installment
 */
function detectInstallment(description) {
  if (!description) return null;

  for (const pattern of INSTALLMENT_PATTERNS) {
    const match = description.match(pattern);
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);

      // Validate: current should be <= total, total should be reasonable (2-48)
      if (current > 0 && total >= 2 && total <= 48 && current <= total) {
        return { current, total };
      }
    }
  }

  return null;
}

/**
 * Generate future installment transactions
 * @param {Object} baseTransaction - The original transaction
 * @param {number} currentInstallment - Current installment number (1-based)
 * @param {number} totalInstallments - Total number of installments
 * @returns {Array} - Array of transactions (original + future installments)
 */
function generateInstallmentTransactions(baseTransaction, currentInstallment, totalInstallments) {
  const transactions = [];
  const baseDate = new Date(baseTransaction.date);

  // Clean the description to remove installment info and add our own format
  let cleanDescription = baseTransaction.description
    .replace(/\s*parcela\s*\d+\s*[\/de]\s*\d+/gi, '')
    .replace(/\s*\(\d+[\/]\d+\)/g, '')
    .replace(/\s*\d+\s*[\/]\s*\d+\s*(?:parcelas?)?/gi, '')
    .replace(/\s*\d+\s*de\s*\d+\s*(?:parcelas?|x)?/gi, '')
    .trim();

  // Generate transactions for current and remaining installments
  for (let i = currentInstallment; i <= totalInstallments; i++) {
    const installmentDate = new Date(baseDate);
    // Add months for future installments
    installmentDate.setMonth(installmentDate.getMonth() + (i - currentInstallment));

    const transaction = {
      ...baseTransaction,
      date: installmentDate.toISOString(),
      description: `${cleanDescription} (${i}/${totalInstallments})`,
      installmentCurrent: i,
      installmentTotal: totalInstallments,
      installmentGroupId: baseTransaction.installmentGroupId || generateInstallmentGroupId(baseTransaction),
      isInstallment: true
    };

    transactions.push(transaction);
  }

  return transactions;
}

/**
 * Generate a unique ID for grouping installments
 */
function generateInstallmentGroupId(transaction) {
  const base = `${transaction.description}-${transaction.amount}-${Date.now()}`;
  return hashString(base);
}

/**
 * Simple hash function for generating IDs
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a transaction hash for duplicate detection
 * @param {Object} transaction - Transaction object
 * @returns {string} - Hash string
 */
function generateTransactionHash(transaction) {
  // Use date (YYYY-MM-DD only), description, and amount for hash
  const dateStr = transaction.date ? transaction.date.split('T')[0] : '';
  const desc = (transaction.description || '').toLowerCase().trim();
  const amount = Math.round((transaction.amount || 0) * 100); // Convert to cents for precision

  return hashString(`${dateStr}|${desc}|${amount}`);
}

module.exports = {
  detectInstallment,
  generateInstallmentTransactions,
  generateInstallmentGroupId,
  generateTransactionHash,
  hashString
};
