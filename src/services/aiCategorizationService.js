/**
 * AI Categorization Service (Hybrid)
 * Uses Gemini free tier with automatic fallback to rule-based categorization
 *
 * Free tier limits (as of 2025):
 * - 1,000 requests/day
 * - 15 requests/minute
 * - No cost, no credit card required
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

// Gemini API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
const DAILY_FREE_LIMIT = 950; // Leave some buffer below 1000
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const CATEGORIZATION_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Get today's date key for tracking daily usage
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Check if we still have free quota available
 * @param {string} userId - User ID
 * @returns {Promise<{available: boolean, used: number, remaining: number}>}
 */
export async function checkAIQuota(userId) {
  if (!userId) return { available: false, used: 0, remaining: 0 };

  try {
    const quotaRef = doc(db, 'aiQuota', userId);
    const quotaDoc = await getDoc(quotaRef);

    if (!quotaDoc.exists()) {
      return { available: true, used: 0, remaining: DAILY_FREE_LIMIT };
    }

    const data = quotaDoc.data();
    const todayKey = getTodayKey();

    // Reset if it's a new day
    if (data.date !== todayKey) {
      return { available: true, used: 0, remaining: DAILY_FREE_LIMIT };
    }

    const used = data.count || 0;
    const remaining = DAILY_FREE_LIMIT - used;

    return {
      available: remaining > 0,
      used,
      remaining: Math.max(0, remaining)
    };
  } catch (error) {
    console.error('Error checking AI quota:', error);
    return { available: false, used: 0, remaining: 0 };
  }
}

/**
 * Increment the AI usage counter
 * @param {string} userId - User ID
 */
async function incrementUsage(userId) {
  if (!userId) return;

  try {
    const quotaRef = doc(db, 'aiQuota', userId);
    const todayKey = getTodayKey();
    const quotaDoc = await getDoc(quotaRef);

    if (!quotaDoc.exists() || quotaDoc.data().date !== todayKey) {
      // New day or first time - reset counter
      await setDoc(quotaRef, {
        userId,
        date: todayKey,
        count: 1,
        updatedAt: serverTimestamp()
      });
    } else {
      // Same day - increment
      await updateDoc(quotaRef, {
        count: increment(1),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error incrementing AI usage:', error);
  }
}

/**
 * Check local cache for previously categorized descriptions
 * Uses localStorage to avoid redundant API calls
 * @param {string} description - Transaction description
 * @returns {Object|null} - Cached result or null
 */
function checkCache(description) {
  try {
    const cacheKey = `ai_cat_${btoa(description).slice(0, 50)}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const { result, timestamp } = JSON.parse(cached);
      // Check if cache is still valid (24 hours)
      if (Date.now() - timestamp < CACHE_DURATION_MS) {
        return result;
      }
      localStorage.removeItem(cacheKey);
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

/**
 * Save result to local cache
 * @param {string} description - Transaction description
 * @param {Object} result - Categorization result
 */
function saveToCache(description, result) {
  try {
    const cacheKey = `ai_cat_${btoa(description).slice(0, 50)}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      result,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore cache errors (quota exceeded, etc.)
  }
}

/**
 * Call Gemini API for categorization
 * @param {string} apiKey - Gemini API key
 * @param {string} description - Transaction description
 * @param {string} type - Transaction type (income/expense)
 * @param {Array<string>} categories - Available categories
 * @returns {Promise<string|null>} - Category name or null
 */
async function callGeminiAPI(apiKey, description, type, categories) {
  const prompt = `You are categorizing a Brazilian bank transaction.

Available categories for ${type === 'income' ? 'INCOME' : 'EXPENSE'}:
${categories.join(', ')}

Transaction description: "${description}"

Instructions:
- Return ONLY the category name from the list above
- Choose the most appropriate category based on Brazilian spending patterns
- If unsure, return the most generic category ("Outros" or "Diversos")
- Do not add any explanation, just the category name

Category:`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent results
          maxOutputTokens: 50,
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);

      // Check for quota exceeded
      if (response.status === 429) {
        console.warn('Gemini free tier quota exceeded');
        return null;
      }
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    // Validate the response is one of the allowed categories
    if (text && categories.some(cat =>
      cat.toLowerCase() === text.toLowerCase() ||
      cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
      text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    )) {
      // Find the exact category name (with proper casing)
      return categories.find(cat =>
        cat.toLowerCase() === text.toLowerCase() ||
        cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
        text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      ) || text;
    }

    console.warn('Gemini returned invalid category:', text);
    return null;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
}

/**
 * Categorize a transaction using AI with automatic fallback
 * @param {Object} params - Parameters
 * @param {string} params.description - Transaction description
 * @param {string} params.type - Transaction type (income/expense)
 * @param {Array<string>} params.categories - Available categories for this type
 * @param {string} params.userId - User ID for quota tracking
 * @param {string} params.apiKey - Gemini API key (optional, from settings)
 * @param {Function} params.fallbackFn - Fallback categorization function
 * @returns {Promise<{category: string, source: 'ai'|'cache'|'fallback', confidence: number}>}
 */
export async function categorizeWithAI({
  description,
  type,
  categories,
  userId,
  apiKey,
  fallbackFn
}) {
  // 1. Check local cache first (free, instant)
  const cached = checkCache(description);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // 2. If no API key, go straight to fallback
  if (!apiKey) {
    const fallbackResult = fallbackFn ? await fallbackFn(description) : null;
    if (!fallbackResult || (fallbackResult.confidence ?? 0) < CATEGORIZATION_CONFIDENCE_THRESHOLD) {
      return { category: null, source: 'none', confidence: 0 };
    }
    return { category: fallbackResult.category, source: 'fallback', confidence: fallbackResult.confidence };
  }

  // 3. Check if we have free quota remaining
  const quota = await checkAIQuota(userId);

  if (!quota.available) {
    console.log(`AI quota exhausted (${quota.used}/${DAILY_FREE_LIMIT}), using fallback`);
    const fallbackResult = fallbackFn ? await fallbackFn(description) : null;
    if (!fallbackResult || (fallbackResult.confidence ?? 0) < CATEGORIZATION_CONFIDENCE_THRESHOLD) {
      return { category: null, source: 'none', confidence: 0 };
    }
    return { category: fallbackResult.category, source: 'fallback', confidence: fallbackResult.confidence };
  }

  // 4. Call Gemini API
  const aiCategory = await callGeminiAPI(apiKey, description, type, categories);

  if (aiCategory) {
    // Success - increment usage and cache result
    await incrementUsage(userId);

    const result = {
      category: aiCategory,
      source: 'ai',
      confidence: 0.85
    };

    saveToCache(description, result);
    return result;
  }

  // 5. AI failed - use fallback
  const fallbackResult = fallbackFn ? await fallbackFn(description) : null;
  if (!fallbackResult || (fallbackResult.confidence ?? 0) < CATEGORIZATION_CONFIDENCE_THRESHOLD) {
    return { category: null, source: 'none', confidence: 0 };
  }
  return { category: fallbackResult.category, source: 'fallback', confidence: fallbackResult.confidence };
}

/**
 * Batch categorize multiple transactions with AI
 * Efficiently uses quota by deduplicating descriptions
 * @param {Array} transactions - Array of { description, type }
 * @param {Object} params - { categories, userId, apiKey, fallbackFn }
 * @returns {Promise<Map<string, Object>>} - Map of description -> result
 */
export async function batchCategorizeWithAI(transactions, params) {
  const results = new Map();
  const { categories, userId, apiKey, fallbackFn } = params;

  // Deduplicate by description to save quota
  const uniqueDescriptions = [...new Set(transactions.map(t => t.description))];

  // Check quota once
  const quota = await checkAIQuota(userId);
  let remainingQuota = quota.remaining;

  for (const description of uniqueDescriptions) {
    const trans = transactions.find(t => t.description === description);
    const type = trans?.type || 'expense';
    const typeCategories = categories[type] || [];

    // Check cache first
    const cached = checkCache(description);
    if (cached) {
      results.set(description, { ...cached, source: 'cache' });
      continue;
    }

    // Use AI if quota available and API key exists
    if (apiKey && remainingQuota > 0) {
      const aiCategory = await callGeminiAPI(apiKey, description, type, typeCategories);

      if (aiCategory) {
        remainingQuota--;
        await incrementUsage(userId);

        const result = {
          category: aiCategory,
          source: 'ai',
          confidence: 0.85
        };

        saveToCache(description, result);
        results.set(description, result);
        continue;
      }
    }

    // Fallback
    const fallbackResult = fallbackFn ? await fallbackFn(description) : null;
    results.set(description, {
      category: fallbackResult?.category || typeCategories[0] || 'Outros',
      source: 'fallback',
      confidence: fallbackResult?.confidence || 0.5
    });
  }

  return results;
}

/**
 * Clear the AI categorization cache
 */
export function clearAICache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('ai_cat_')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore errors
  }
}

/**
 * AI-powered duplicate detection for frontend
 * Finds potential duplicates that hash-based detection might miss
 *
 * @param {Array} newTransactions - New transactions to check
 * @param {Array} existingTransactions - Existing transactions from database
 * @param {Object} options - { apiKey, userId }
 * @returns {Promise<Set<number>>} - Set of indices of likely duplicates in newTransactions
 */
export async function detectDuplicatesWithAI(newTransactions, existingTransactions, options) {
  const { apiKey, userId } = options;
  const duplicateIndices = new Set();

  if (!apiKey || newTransactions.length === 0 || existingTransactions.length === 0) {
    return duplicateIndices;
  }

  // Check quota
  const quota = await checkAIQuota(userId);
  if (!quota.available) {
    console.log('AI quota exhausted, skipping duplicate detection');
    return duplicateIndices;
  }

  // Group new transactions by amount for efficient matching
  const amountGroups = new Map();
  newTransactions.forEach((t, idx) => {
    const amountKey = Math.round(t.amount);
    if (!amountGroups.has(amountKey)) {
      amountGroups.set(amountKey, []);
    }
    amountGroups.get(amountKey).push({ transaction: t, index: idx });
  });

  // Find existing transactions with similar amounts
  const potentialMatches = [];
  existingTransactions.forEach(existing => {
    const amountKey = Math.round(existing.amount);
    // Check exact and nearby amounts
    [amountKey - 1, amountKey, amountKey + 1].forEach(key => {
      if (amountGroups.has(key)) {
        amountGroups.get(key).forEach(({ transaction, index }) => {
          // Only add if dates are within 7 days
          const newDate = new Date(transaction.date);
          const existingDate = new Date(existing.date);
          const daysDiff = Math.abs((newDate - existingDate) / (1000 * 60 * 60 * 24));

          if (daysDiff <= 7) {
            potentialMatches.push({
              newIdx: index,
              newDesc: transaction.description,
              newAmount: transaction.amount,
              newDate: transaction.date,
              existingDesc: existing.description,
              existingAmount: existing.amount,
              existingDate: existing.date
            });
          }
        });
      }
    });
  });

  if (potentialMatches.length === 0) {
    return duplicateIndices;
  }

  // Limit to first 30 potential matches for AI analysis (to save quota)
  const matchesToCheck = potentialMatches.slice(0, 30);

  const prompt = `You are detecting duplicate bank transactions. Some transactions may appear differently but represent the same purchase.

For each pair, determine if they are likely the SAME transaction:
- Same merchant, even with different text variations
- Same amount (or very close)
- Same or very close dates

Pairs to analyze (format: NEW | EXISTING):
${matchesToCheck.map((m, idx) =>
  `${idx + 1}. NEW: "${m.newDesc}" (${m.newAmount}, ${m.newDate.split('T')[0]}) | EXISTING: "${m.existingDesc}" (${m.existingAmount}, ${typeof m.existingDate === 'string' ? m.existingDate.split('T')[0] : m.existingDate})`
).join('\n')}

For each pair that IS a duplicate, respond with just the pair number.
If no duplicates found, respond with "NONE".

Example: 1,3,5 (meaning pairs 1, 3, and 5 are duplicates)

Your response (comma-separated numbers or NONE):`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100,
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error in duplicate detection');
      return duplicateIndices;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (text && text.toUpperCase() !== 'NONE') {
      const duplicateNums = text.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));

      duplicateNums.forEach(num => {
        const matchIdx = num - 1;
        if (matchIdx >= 0 && matchIdx < matchesToCheck.length) {
          duplicateIndices.add(matchesToCheck[matchIdx].newIdx);
        }
      });

      // Count as one AI call for quota
      await incrementUsage(userId);
    }
  } catch (error) {
    console.error('Error in AI duplicate detection:', error);
  }

  return duplicateIndices;
}
