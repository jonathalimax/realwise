/**
 * User Categorization Learning Service
 * Manages user-defined categorization rules that learn from manual categorizations
 */

import { categorizationRulesResource } from '../lib/api/resources/categorizationRules';
import { categorizeTransaction as defaultCategorize } from '../constants/defaultCategorizationRules';

/**
 * Extract a pattern from a transaction description
 * This creates a simplified pattern that can match similar transactions
 * @param {string} description - Transaction description
 * @returns {string} - Extracted pattern
 */
export function extractPattern(description) {
  if (!description) return '';

  // Normalize: uppercase and remove accents
  let pattern = description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Remove common noise patterns
  // Remove dates (dd/mm/yyyy, dd-mm-yyyy, etc.)
  pattern = pattern.replace(/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, '');

  // Remove time patterns (HH:MM, HH:MM:SS)
  pattern = pattern.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');

  // Remove installment indicators (1/12, PARCELA 1 DE 12, etc.)
  pattern = pattern.replace(/\s*PARCELA\s*\d+\s*[/DE]\s*\d+/gi, '');
  pattern = pattern.replace(/\s*\(\d+[/]\d+\)/g, '');
  pattern = pattern.replace(/\s*\d+\s*[/]\s*\d+\s*(?:PARCELAS?)?/gi, '');

  // Remove transaction IDs and numbers (6+ digits) anywhere in the string
  pattern = pattern.replace(/\b\d{6,}\b/g, '');

  // Remove UUID-like patterns (hex sequences with dashes)
  pattern = pattern.replace(/[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}/gi, '');

  // Remove common suffixes like "- SAO PAULO SP"
  pattern = pattern.replace(/\s*-\s*[A-Z]{2,}\s+[A-Z]{2}$/g, '');

  // Strip asterisk-prefixed merchant suffixes: IFOOD*ABC123 → IFOOD
  pattern = pattern.replace(/\*[A-Z0-9]{4,}/g, '');
  // Strip short trailing date fragments: " 05/04"
  pattern = pattern.replace(/\s+\d{2}\/\d{2}$/g, '');
  // Strip transfer noise words at start
  pattern = pattern.replace(/^(TRANSF|TED|DOC|PAGAMENTO|RECEBIDO)\s+/g, '');
  // Strip asterisk-prefixed short IDs anywhere: *12345
  pattern = pattern.replace(/\s*\*\d{4,}/g, '');

  // Remove excessive whitespace
  pattern = pattern.replace(/\s+/g, ' ').trim();

  if (pattern.length > 50) {
    const firstSegment = pattern.split(/\s{2,}|-/)[0].trim();
    pattern = firstSegment.length >= 3 ? firstSegment : pattern.substring(0, 50);
  }

  // If pattern is too short or too long, return as is (less useful for learning)
  if (pattern.length < 3 || pattern.length > 100) {
    return pattern;
  }

  return pattern;
}

/**
 * Write a user correction to the shared categorization rules collection.
 * Best-effort — errors are caught and logged, not thrown.
 * @param {string} pattern - Extracted pattern
 * @param {string} category - Corrected category
 */
async function writeSharedRule(pattern, category) {
  void pattern;
  void category;
}

/**
 * Save a user categorization rule
 * @param {string} userId - User ID
 * @param {Object} data - { description, category, type }
 */
export async function saveUserCategorizationRule(userId, { description, category, type }) {
  if (!userId || !description || !category) return null;

  const pattern = extractPattern(description);
  if (!pattern) return null;

  try {
    const existingRules = await categorizationRulesResource.list();
    const existingRule = existingRules.find((rule) => rule.keyword === pattern);

    if (existingRule) {
      await categorizationRulesResource.update(existingRule.id, {
        category,
        type,
        originalDescription: description,
        isActive: true,
      });
      await categorizationRulesResource.recordUsage(existingRule.id);
      writeSharedRule(pattern, category); // best-effort, don't await
      return existingRule.id;
    } else {
      const created = await categorizationRulesResource.create({
        keyword: pattern,
        category,
        type,
        originalDescription: description,
        isActive: true,
      });
      writeSharedRule(pattern, category); // best-effort, don't await
      return created.id;
    }
  } catch (error) {
    console.error('Error saving user categorization rule:', error);
    return null;
  }
}

/**
 * Load user categorization rules
 * @param {string} userId - User ID
 * @returns {Array} - Array of user rules formatted for categorization
 */
export async function loadUserCategorizationRules(userId) {
  if (!userId) return [];

  try {
    const rows = await categorizationRulesResource.list();

    return rows.map((data) => {
      return {
        id: data.id,
        keywords: [data.keyword],
        category: data.category,
        type: data.type,
        priority: 20, // Higher than default rules (15 max)
        isUserRule: true,
        usedCount: data.usedCount || 0
      };
    });
  } catch (error) {
    console.error('Error loading user categorization rules:', error);
    return [];
  }
}

/**
 * Categorize a transaction using both user rules and default rules
 * @param {string} description - Transaction description
 * @param {string} userId - User ID for loading user rules
 * @param {Array} preloadedUserRules - Optional pre-loaded user rules (for batch processing)
 * @returns {Object|null} - Categorization result
 */
export async function categorizeWithLearning(description, userId, preloadedUserRules = null) {
  if (!description) return null;

  // Load user rules if not preloaded
  const userRules = preloadedUserRules || (userId ? await loadUserCategorizationRules(userId) : []);

  // Try to categorize with user rules first (they have higher priority)
  return defaultCategorize(description, userRules);
}

/**
 * Batch save multiple categorization rules (for bulk operations in PendingReview)
 * @param {string} userId - User ID
 * @param {Array} transactions - Array of { description, category, type }
 */
export async function batchSaveCategorizationRules(userId, transactions) {
  if (!userId || !transactions || transactions.length === 0) return;

  const results = [];
  for (const transaction of transactions) {
    const result = await saveUserCategorizationRule(userId, transaction);
    results.push(result);
  }

  return results;
}

/**
 * Get user rule suggestions for a description
 * @param {string} userId - User ID
 * @param {string} description - Transaction description
 * @returns {Array} - Suggested categories with confidence scores
 */
export async function getSuggestions(userId, description) {
  if (!userId || !description) return [];

  const pattern = extractPattern(description);
  if (!pattern) return [];

  const userRules = await loadUserCategorizationRules(userId);
  const suggestions = [];

  // Find similar patterns
  for (const rule of userRules) {
    const rulePattern = rule.keywords[0];

    // Exact match
    if (pattern === rulePattern) {
      suggestions.push({
        category: rule.category,
        type: rule.type,
        confidence: 1.0,
        source: 'exact_match'
      });
    }
    // Partial match (pattern contains rule or vice versa)
    else if (pattern.includes(rulePattern) || rulePattern.includes(pattern)) {
      suggestions.push({
        category: rule.category,
        type: rule.type,
        confidence: 0.7,
        source: 'partial_match'
      });
    }
    // Word overlap
    else {
      const patternWords = pattern.split(' ').filter(w => w.length > 3);
      const ruleWords = rulePattern.split(' ').filter(w => w.length > 3);
      const overlap = patternWords.filter(w => ruleWords.includes(w)).length;

      if (overlap >= 2) {
        suggestions.push({
          category: rule.category,
          type: rule.type,
          confidence: 0.3 + (overlap * 0.1),
          source: 'word_overlap'
        });
      }
    }
  }

  // Sort by confidence and deduplicate
  suggestions.sort((a, b) => b.confidence - a.confidence);

  const seen = new Set();
  return suggestions.filter(s => {
    const key = `${s.category}-${s.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}
