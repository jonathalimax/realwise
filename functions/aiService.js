/**
 * AI Service for Cloud Functions
 * Uses Gemini API for categorization and duplicate detection
 * Optimized for batch processing to minimize token usage
 */

const admin = require('firebase-admin');
const axios = require('axios');

// Gemini API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
const MAX_BATCH_SIZE = 20; // Max transactions per AI call
const MAX_AI_CALLS_PER_IMPORT = 5; // Limit AI calls per import session

/**
 * Get Gemini API key from Firestore settings or environment
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} userId - User ID
 * @returns {Promise<string|null>}
 */
async function getGeminiApiKey(db, userId) {
  try {
    // First try user's own API key from settings
    const settingsDoc = await db.collection('settings').doc(userId).get();
    if (settingsDoc.exists && settingsDoc.data().geminiApiKey) {
      return settingsDoc.data().geminiApiKey;
    }

    // Fallback to app-level API key from Firebase config
    const functions = require('firebase-functions');
    const configKey = functions.config().gemini?.api_key;
    if (configKey) {
      return configKey;
    }

    return null;
  } catch (error) {
    console.error('Error getting Gemini API key:', error);
    return null;
  }
}

/**
 * Call Gemini API
 * @param {string} apiKey - Gemini API key
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string|null>}
 */
async function callGeminiAPI(apiKey, prompt) {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  } catch (error) {
    console.error('Gemini API error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Batch categorize transactions using AI
 * Groups uncategorized transactions and processes in batches
 *
 * @param {Array} transactions - Array of transactions needing categorization
 * @param {Object} options - { apiKey, expenseCategories, incomeCategories }
 * @returns {Promise<Map<string, Object>>} - Map of description -> { category, type, confidence }
 */
async function batchCategorizeTransactions(transactions, options) {
  const { apiKey, expenseCategories, incomeCategories, userRuleHints = [] } = options;
  const results = new Map();

  if (!apiKey || transactions.length === 0) {
    return results;
  }

  // Deduplicate by description
  const uniqueDescriptions = [...new Set(transactions.map(t => t.description))];

  // Limit the number of AI calls
  const descriptionsToProcess = uniqueDescriptions.slice(0, MAX_BATCH_SIZE * MAX_AI_CALLS_PER_IMPORT);

  // Process in batches
  for (let i = 0; i < descriptionsToProcess.length; i += MAX_BATCH_SIZE) {
    const batch = descriptionsToProcess.slice(i, i + MAX_BATCH_SIZE);

    const learnedMappingsSection = userRuleHints.length > 0
      ? `\nLEARNED MAPPINGS (this user's corrections — prefer when description matches):\n` +
        userRuleHints.map(h => `- "${h.pattern}" → ${h.category} (${h.type})`).join('\n') + `\n`
      : '';

    const prompt = `You are categorizing Brazilian bank transactions. For each transaction, determine the category and type (income/expense).

Available EXPENSE categories: ${expenseCategories.join(', ')}
Available INCOME categories: ${incomeCategories.join(', ')}
${learnedMappingsSection}
Transactions to categorize (numbered list):
${batch.map((desc, idx) => `${idx + 1}. "${desc}"`).join('\n')}

Instructions:
- For each transaction, return ONLY: number|category|type
- Type must be exactly "income" or "expense"
- Category must be from the lists above
- Use "Diversos" for unclear expense transactions
- Use "Outros" for unclear income transactions
- One transaction per line

Example output:
1|Alimentacao|expense
2|Salario|income

Your response (one per line, no explanations):`;

    try {
      const response = await callGeminiAPI(apiKey, prompt);

      if (response) {
        // Parse the response
        const lines = response.split('\n').filter(l => l.trim());

        for (const line of lines) {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length >= 3) {
            const idx = parseInt(parts[0], 10) - 1;
            if (idx >= 0 && idx < batch.length) {
              const category = parts[1];
              const type = parts[2].toLowerCase();

              // Validate type
              if (type === 'income' || type === 'expense') {
                results.set(batch[idx], {
                  category,
                  type,
                  confidence: 0.85,
                  source: 'ai'
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in batch categorization:', error);
    }

    // Add delay between batches to avoid rate limiting
    if (i + MAX_BATCH_SIZE < descriptionsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * AI-powered duplicate detection
 * Finds potential duplicates that hash-based detection might miss
 *
 * @param {Array} newTransactions - New transactions to check
 * @param {Array} existingTransactions - Sample of existing transactions (last 100)
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Set<number>>} - Set of indices of likely duplicates
 */
async function detectPotentialDuplicates(newTransactions, existingTransactions, apiKey) {
  const duplicateIndices = new Set();

  if (!apiKey || newTransactions.length === 0 || existingTransactions.length === 0) {
    return duplicateIndices;
  }

  // Group new transactions by amount for efficient matching
  const amountGroups = new Map();
  newTransactions.forEach((t, idx) => {
    // Round to nearest integer for grouping
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
    // Check exact and nearby amounts (+/- 1)
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

  // If no potential matches, return empty
  if (potentialMatches.length === 0) {
    return duplicateIndices;
  }

  // Limit to first 50 potential matches for AI analysis
  const matchesToCheck = potentialMatches.slice(0, 50);

  const prompt = `You are detecting duplicate bank transactions. Some transactions may appear differently but represent the same purchase.

For each pair, determine if they are likely the SAME transaction:
- Same merchant, even with different text variations
- Same amount (or very close)
- Same or very close dates

Pairs to analyze (format: NEW | EXISTING):
${matchesToCheck.map((m, idx) =>
  `${idx + 1}. NEW: "${m.newDesc}" (${m.newAmount}, ${m.newDate.split('T')[0]}) | EXISTING: "${m.existingDesc}" (${m.existingAmount}, ${m.existingDate.split ? m.existingDate.split('T')[0] : m.existingDate})`
).join('\n')}

For each pair that IS a duplicate, respond with just the pair number.
If no duplicates found, respond with "NONE".

Example: 1,3,5 (meaning pairs 1, 3, and 5 are duplicates)

Your response (comma-separated numbers or NONE):`;

  try {
    const response = await callGeminiAPI(apiKey, prompt);

    if (response && response.trim().toUpperCase() !== 'NONE') {
      const duplicateNums = response.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));

      duplicateNums.forEach(num => {
        const matchIdx = num - 1;
        if (matchIdx >= 0 && matchIdx < matchesToCheck.length) {
          duplicateIndices.add(matchesToCheck[matchIdx].newIdx);
        }
      });
    }
  } catch (error) {
    console.error('Error in AI duplicate detection:', error);
  }

  return duplicateIndices;
}

/**
 * Format import summary for push notification
 * @param {Object} importResult - Import results
 * @param {string} language - User's language preference ('pt' or 'en')
 * @returns {string}
 */
function formatImportNotification(importResult, language = 'pt') {
  const { importedCount, duplicateCount, pendingCategoryCount, aiCategorizedCount, fileName, error, errorMessage } = importResult;

  // Handle error case
  if (error) {
    if (language === 'pt') {
      let message = `*Erro na Importacao*\n\n`;
      message += `Arquivo: ${fileName || 'Extrato'}\n`;
      message += `Nao foi possivel processar o arquivo.\n`;
      if (errorMessage) {
        message += `Erro: ${errorMessage}\n`;
      }
      message += `\nPor favor, tente novamente ou entre em contato com o suporte.`;
      return message;
    } else {
      let message = `*Import Failed*\n\n`;
      message += `File: ${fileName || 'Statement'}\n`;
      message += `Could not process the file.\n`;
      if (errorMessage) {
        message += `Error: ${errorMessage}\n`;
      }
      message += `\nPlease try again or contact support.`;
      return message;
    }
  }

  // Handle success case
  if (language === 'pt') {
    let message = `*Importacao Concluida*\n\n`;
    message += `Arquivo: ${fileName || 'Extrato'}\n`;
    message += `Transacoes importadas: ${importedCount}\n`;

    if (duplicateCount > 0) {
      message += `Duplicadas ignoradas: ${duplicateCount}\n`;
    }

    if (aiCategorizedCount > 0) {
      message += `Categorizadas por IA: ${aiCategorizedCount}\n`;
    }

    if (pendingCategoryCount > 0) {
      message += `\nPendentes de revisao: ${pendingCategoryCount}\n`;
      message += `Acesse o app para revisar: https://limas-finance.web.app`;
    }

    return message;
  } else {
    let message = `*Import Complete*\n\n`;
    message += `File: ${fileName || 'Statement'}\n`;
    message += `Transactions imported: ${importedCount}\n`;

    if (duplicateCount > 0) {
      message += `Duplicates skipped: ${duplicateCount}\n`;
    }

    if (aiCategorizedCount > 0) {
      message += `AI categorized: ${aiCategorizedCount}\n`;
    }

    if (pendingCategoryCount > 0) {
      message += `\nPending review: ${pendingCategoryCount}\n`;
      message += `Open the app to review: https://limas-finance.web.app`;
    }

    return message;
  }
}

module.exports = {
  getGeminiApiKey,
  callGeminiAPI,
  batchCategorizeTransactions,
  detectPotentialDuplicates,
  formatImportNotification,
  MAX_BATCH_SIZE,
  MAX_AI_CALLS_PER_IMPORT
};
