/**
 * Cloud Function for processing bank statement imports
 * Triggers when a file is uploaded to Firebase Storage
 *
 * Features:
 * - AI-powered duplicate detection (semantic matching)
 * - AI categorization with batching for efficiency
 * - Push notification after import completion
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { parseFileFromBuffer, detectBankTypeFromPath } = require('./parsers');
const { isB3Format, parseB3Positions, parseCSVFromBuffer } = require('./parsers');
const { generateTransactionHash } = require('./parsers/installments');
const { getPlannerGoalIdFromObjectMetadata } = require('./importMetadata');
const {
  getGeminiApiKey,
  batchCategorizeTransactions,
  detectPotentialDuplicates,
  formatImportNotification
} = require('./aiService');

// Firebase Admin is initialized by the main index.js file

const db = admin.firestore();
const storage = admin.storage();

// Default categories for AI categorization
const DEFAULT_EXPENSE_CATEGORIES = [
  'Moradia', 'Contas', 'Veiculo', 'Alimentacao', 'Saude', 'Educacao',
  'Lazer', 'Vestuario', 'Impostos', 'Assinaturas', 'Viagens', 'Diversos',
  'Doacoes', 'Cuidados Pessoais'
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salario', 'Renda', 'Investimentos', 'Freelance', 'Reembolso', 'Outros'
];

/**
 * Extract a pattern from a transaction description
 * Ported from src/services/categorizationService.js — pure JS, no imports
 */
function extractPattern(description) {
  if (!description) return '';
  let pattern = description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  pattern = pattern.replace(/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, '');
  pattern = pattern.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');
  pattern = pattern.replace(/\s*PARCELA\s*\d+\s*[/DE]\s*\d+/gi, '');
  pattern = pattern.replace(/\s*\(\d+[/]\d+\)/g, '');
  pattern = pattern.replace(/\s*\d+\s*[/]\s*\d+\s*(?:PARCELAS?)?/gi, '');
  pattern = pattern.replace(/\s+\d{6,}$/g, '');
  pattern = pattern.replace(/\s*-\s*[A-Z]{2,}\s+[A-Z]{2}$/g, '');
  pattern = pattern.replace(/\s+/g, ' ').trim();
  if (pattern.length < 3 || pattern.length > 100) return pattern;
  return pattern;
}

/**
 * Load user's learned categorization rules from Firestore
 */
async function loadUserCategorizationRules(userId) {
  if (!userId) return [];
  try {
    const snapshot = await db.collection('userCategorizationRules')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('usedCount', 'desc')
      .limit(500)
      .get();
    return snapshot.docs.map(doc => {
      const d = doc.data();
      return { pattern: d.pattern, category: d.category, type: d.type, usedCount: d.usedCount || 1 };
    });
  } catch (e) {
    console.error('Error loading user categorization rules:', e);
    return [];
  }
}

/**
 * Apply user learned rules to transactions before sending to AI
 * Matching priority: exact (0.95) > partial/contains (0.75) > word-overlap ≥2 (0.50)
 */
function applyUserRulesToTransactions(transactions, userRules) {
  if (!userRules || userRules.length === 0) return { categorized: [], remaining: transactions };
  const categorized = [], remaining = [];
  for (const t of transactions) {
    const tp = extractPattern(t.description);
    let best = null;
    for (const rule of userRules) {
      const rp = rule.pattern;
      if (tp === rp) { best = { rule, confidence: 0.95 }; break; }
      if (!best || best.confidence < 0.75) {
        if (tp.includes(rp) || rp.includes(tp)) best = { rule, confidence: 0.75 };
      }
      if (!best || best.confidence < 0.50) {
        const tw = tp.split(' ').filter(w => w.length > 3);
        const rw = rp.split(' ').filter(w => w.length > 3);
        if (tw.filter(w => rw.includes(w)).length >= 2) best = { rule, confidence: 0.50 };
      }
    }
    if (best) {
      categorized.push({
        ...t,
        category: best.rule.category,
        type: best.rule.type,
        categoryConfidence: best.confidence,
        needsReview: false,
        aiCategorized: false,
        source: 'user_rule'
      });
    } else {
      remaining.push(t);
    }
  }
  return { categorized, remaining };
}

/**
 * Get user's categories from settings, or use defaults
 */
async function getUserCategories(userId) {
  try {
    const settingsDoc = await db.collection('settings').doc(userId).get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return {
        expense: data.categories?.expense || DEFAULT_EXPENSE_CATEGORIES,
        income: data.categories?.income || DEFAULT_INCOME_CATEGORIES,
        language: data.language || 'pt'
      };
    }
  } catch (error) {
    console.error('Error getting user categories:', error);
  }
  return {
    expense: DEFAULT_EXPENSE_CATEGORIES,
    income: DEFAULT_INCOME_CATEGORIES,
    language: 'pt'
  };
}

/**
 * Get recent existing transactions for AI duplicate detection
 * Returns the most recent transactions (last 3 months or 200 transactions)
 */
async function getRecentTransactions(userId, limit = 200) {
  try {
    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        description: data.description,
        amount: data.amount,
        date: data.date,
        hash: data.hash
      };
    });
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    return [];
  }
}

/**
 * Placeholder for future push notification after import
 */
async function sendImportNotification(userId, importResult) {
  console.log(`Import completed for user ${userId}: ${importResult.importedCount ?? 0} transactions`);
}

/**
 * Process B3 position CSV files — writes to investments collection, not transactions
 */
async function processB3Positions(userId, fileBuffer, fileName, filePath, fileHash, plannerGoalId = null) {
  const data = parseCSVFromBuffer(fileBuffer);

  if (!data || data.length === 0) {
    console.log('B3 file has no data rows');
    return;
  }

  const positions = parseB3Positions(data);
  console.log(`B3 import: ${positions.length} positions found for user ${userId}`);

  if (positions.length === 0) return;

  // Load existing investments with tickers for merge matching
  const existingSnap = await db.collection('investments')
    .where('userId', '==', userId)
    .where('ticker', '!=', null)
    .get();

  const byTicker = {};
  existingSnap.forEach(doc => {
    const d = doc.data();
    if (d.ticker) byTicker[d.ticker.toUpperCase()] = { id: doc.id, data: d };
  });

  const batch = db.batch();
  let created = 0;
  let updated = 0;

  const processedInFile = new Set();

  for (const pos of positions) {
    if (processedInFile.has(pos.ticker)) {
      console.log(`[B3Import] Skipping duplicate ticker in CSV: ${pos.ticker}`);
      continue;
    }
    processedInFile.add(pos.ticker);
    const existing = byTicker[pos.ticker];

    if (existing) {
      const ref = db.collection('investments').doc(existing.id);
      batch.update(ref, {
        ticker: pos.ticker,
        quantity: pos.quantity,
        currentAmount: pos.currentValue,
        source: 'b3',
        bank: existing.data.bank || pos.broker || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updated++;
    } else {
      const ref = db.collection('investments').doc();
      batch.set(ref, {
        userId,
        name: pos.ticker,
        ticker: pos.ticker,
        type: pos.type,
        bank: pos.broker || '',
        initialAmount: pos.currentValue,
        currentAmount: pos.currentValue,
        quantity: pos.quantity,
        source: 'b3',
        expectedReturn: 0,
        returnType: 'annual',
        purchaseDate: new Date().toISOString().split('T')[0],
        maturityDate: null,
        goalId: null,
        plannerGoalId,
        notes: '',
        status: null,
        totalWithdrawn: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      created++;
    }
  }

  await batch.commit();

  await db.collection('importHistory').add({
    userId,
    fileName,
    fileHash: fileHash || 'b3-positions',
    bankType: 'b3',
    totalTransactions: positions.length,
    importedCount: created + updated,
    duplicateCount: 0,
    status: 'completed',
    storagePath: filePath,
    source: 'b3_positions',
    b3Summary: { created, updated },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    transactionIds: [],
  });

  console.log(`B3 import done — created: ${created}, updated: ${updated}`);
}

/**
 * Process import files uploaded to Firebase Storage
 * Triggered on file upload to /imports/{userId}/{bankType}/{filename}
 */
exports.processImport = functions
  .runWith({
    memory: '1GB',
    timeoutSeconds: 540 // 9 minutes max
  })
  .storage.bucket('limas-finance.firebasestorage.app')
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;
    const bucket = storage.bucket(object.bucket);

    console.log('Processing file:', filePath);

    // Only process files in /imports/ directory
    if (!filePath.startsWith('imports/')) {
      console.log('Skipping file outside imports directory');
      return null;
    }

    // Extract userId from path: imports/{userId}/{bankType}/{filename}
    const pathParts = filePath.split('/');
    if (pathParts.length < 4) {
      console.error('Invalid file path structure:', filePath);
      return null;
    }

    const userId = pathParts[1];
    const fileName = pathParts[pathParts.length - 1];

    // Validate file type
    const validExtensions = ['csv', 'xlsx', 'xls'];
    const fileExtension = fileName.split('.').pop().toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      console.log('Skipping non-supported file type:', fileExtension);
      return null;
    }

    console.log(`Processing import for user: ${userId}, file: ${fileName}`);

    try {
      // Download file
      const file = bucket.file(filePath);
      const [fileBuffer] = await file.download();

      // Generate file hash for duplicate detection
      const fileHash = crypto
        .createHash('sha256')
        .update(fileBuffer)
        .digest('hex');

      // Check if file was already processed
      const existingImport = await db.collection('importHistory')
        .where('userId', '==', userId)
        .where('fileHash', '==', fileHash)
        .limit(1)
        .get();

      if (!existingImport.empty) {
        console.log('File already processed, skipping:', fileHash);
        await moveToProcessed(bucket, filePath, userId);
        return null;
      }

      // Detect bank type from folder path
      const bankType = detectBankTypeFromPath(filePath);
      console.log('Detected bank type:', bankType);

      // B3 position files write to investments, not transactions
      if (bankType === 'b3') {
        const plannerGoalId = getPlannerGoalIdFromObjectMetadata(object);
        await processB3Positions(userId, fileBuffer, fileName, filePath, fileHash, plannerGoalId);
        await moveToProcessed(bucket, filePath, userId);
        return null;
      }

      // Parse the file
      const { transactions, detectedBankType } = parseFileFromBuffer(
        fileBuffer,
        fileName,
        bankType
      );

      console.log(`Parsed ${transactions.length} transactions`);

      if (transactions.length === 0) {
        console.log('No transactions found in file');
        await createImportHistory(userId, {
          fileHash,
          fileName,
          bankType: detectedBankType,
          totalTransactions: 0,
          importedCount: 0,
          duplicateCount: 0,
          pendingCategoryCount: 0,
          aiCategorizedCount: 0,
          aiDuplicatesDetected: 0,
          status: 'completed',
          storagePath: filePath,
          errorMessage: 'No transactions found in file'
        });
        await moveToProcessed(bucket, filePath, userId);
        return null;
      }

      // Get existing transaction hashes for hash-based duplicate detection
      const existingHashesSnapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .select('hash', 'date', 'description', 'amount')
        .get();

      const existingHashes = new Set();
      existingHashesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.hash) {
          existingHashes.add(data.hash);
        } else {
          const hash = generateTransactionHash({
            date: data.date,
            description: data.description,
            amount: data.amount
          });
          existingHashes.add(hash);
        }
      });

      console.log(`Loaded ${existingHashes.size} existing transaction hashes`);

      // Step 1: Hash-based duplicate filtering (fast, exact matches)
      let hashDuplicateCount = 0;
      const afterHashFilter = [];

      for (const transaction of transactions) {
        if (existingHashes.has(transaction.hash)) {
          hashDuplicateCount++;
          continue;
        }
        existingHashes.add(transaction.hash);
        afterHashFilter.push(transaction);
      }

      console.log(`Hash-based duplicates: ${hashDuplicateCount}`);

      // Step 2: AI-powered duplicate detection (semantic matching)
      let aiDuplicatesDetected = 0;
      const toImport = [];
      const geminiApiKey = await getGeminiApiKey(db, userId);

      if (geminiApiKey && afterHashFilter.length > 0) {
        console.log('Running AI duplicate detection...');

        // Get recent transactions for comparison
        const recentTransactions = await getRecentTransactions(userId, 200);

        if (recentTransactions.length > 0) {
          const aiDuplicateIndices = await detectPotentialDuplicates(
            afterHashFilter,
            recentTransactions,
            geminiApiKey
          );

          afterHashFilter.forEach((t, idx) => {
            if (aiDuplicateIndices.has(idx)) {
              aiDuplicatesDetected++;
            } else {
              toImport.push(t);
            }
          });

          console.log(`AI-detected duplicates: ${aiDuplicatesDetected}`);
        } else {
          // No existing transactions, skip AI duplicate detection
          toImport.push(...afterHashFilter);
        }
      } else {
        // No API key, skip AI duplicate detection
        toImport.push(...afterHashFilter);
      }

      const totalDuplicates = hashDuplicateCount + aiDuplicatesDetected;
      console.log(`Total duplicates skipped: ${totalDuplicates}`);
      console.log(`Transactions to import: ${toImport.length}`);

      if (toImport.length === 0) {
        console.log('All transactions were duplicates');
        await createImportHistory(userId, {
          fileHash,
          fileName,
          bankType: detectedBankType,
          totalTransactions: transactions.length,
          importedCount: 0,
          duplicateCount: totalDuplicates,
          aiDuplicatesDetected,
          pendingCategoryCount: 0,
          aiCategorizedCount: 0,
          status: 'completed',
          storagePath: filePath,
          message: 'All transactions were duplicates'
        });
        await moveToProcessed(bucket, filePath, userId);

        // Send notification even if all duplicates
        await sendImportNotification(userId, {
          fileName,
          importedCount: 0,
          duplicateCount: totalDuplicates,
          pendingCategoryCount: 0,
          aiCategorizedCount: 0
        });

        return null;
      }

      // Step 3: Categorization — user rules first, then AI for unknowns
      let aiCategorizedCount = 0;
      let userRuleCategorizedCount = 0;
      const uncategorized = toImport.filter(t => t.needsReview);

      if (uncategorized.length > 0) {
        const { expense: expenseCategories, income: incomeCategories } = await getUserCategories(userId);

        // 3a: Apply learned user rules (no AI cost, highest accuracy for known merchants)
        const userRules = await loadUserCategorizationRules(userId);
        const { categorized: ruleMatched, remaining: stillUncategorized } =
          applyUserRulesToTransactions(uncategorized, userRules);

        userRuleCategorizedCount = ruleMatched.length;
        console.log(`User rules categorized ${userRuleCategorizedCount} transactions`);

        const ruleMatchedByHash = new Map(ruleMatched.map(t => [t.hash, t]));
        toImport.forEach((t, idx) => {
          if (ruleMatchedByHash.has(t.hash)) Object.assign(toImport[idx], ruleMatchedByHash.get(t.hash));
        });

        // 3b: AI for genuinely unknown transactions
        if (geminiApiKey && stillUncategorized.length > 0) {
          console.log(`Running AI categorization for ${stillUncategorized.length} transactions...`);
          const userRuleHints = userRules.slice(0, 20).map(r => ({
            pattern: r.pattern, category: r.category, type: r.type
          }));
          const aiResults = await batchCategorizeTransactions(stillUncategorized, {
            apiKey: geminiApiKey,
            expenseCategories,
            incomeCategories,
            userRuleHints
          });
          toImport.forEach(t => {
            if (t.needsReview && aiResults.has(t.description)) {
              const result = aiResults.get(t.description);
              t.category = result.category;
              t.type = result.type;
              t.categoryConfidence = result.confidence;
              t.aiCategorized = true;
              t.needsReview = false;
              aiCategorizedCount++;
            }
          });
          console.log(`AI categorized ${aiCategorizedCount} transactions`);
        }
      }

      // Create import history document
      const importHistoryRef = await db.collection('importHistory').add({
        userId,
        fileHash,
        fileName,
        fileSize: fileBuffer.length,
        bankType: detectedBankType,
        totalTransactions: transactions.length,
        importedCount: toImport.length,
        duplicateCount: totalDuplicates,
        aiDuplicatesDetected,
        aiCategorizedCount,
        pendingCategoryCount: 0, // Will update after import
        transactionIds: [],
        status: 'processing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: null,
        storagePath: filePath,
        source: 'storage_upload'
      });

      const importId = importHistoryRef.id;

      // Import transactions in batches
      const transactionIds = [];
      let pendingCategoryCount = 0;
      const batchSize = 500;

      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = db.batch();
        const chunk = toImport.slice(i, i + batchSize);

        for (const transaction of chunk) {
          const transactionRef = db.collection('transactions').doc();
          transactionIds.push(transactionRef.id);

          if (transaction.needsReview) {
            pendingCategoryCount++;
          }

          batch.set(transactionRef, {
            userId,
            type: transaction.type,
            description: transaction.description,
            amount: transaction.amount,
            category: transaction.category || 'Diversos',
            date: transaction.date,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            imported: true,
            hash: transaction.hash,
            bankId: null,
            isInstallment: transaction.isInstallment || false,
            installmentCurrent: transaction.installmentCurrent || null,
            installmentTotal: transaction.installmentTotal || null,
            installmentGroupId: transaction.installmentGroupId || null,
            autoGenerated: transaction.autoGenerated || false,
            goalId: null,
            goalName: null,
            investmentType: null,
            // Import tracking fields
            importId,
            importedAt: admin.firestore.FieldValue.serverTimestamp(),
            needsReview: transaction.needsReview || false,
            categoryConfidence: transaction.categoryConfidence || 1.0,
            aiCategorized: transaction.aiCategorized || false,
            reviewedAt: null,
            reviewedBy: null,
            sourceFile: fileName
          });
        }

        await batch.commit();
        console.log(`Committed batch ${Math.floor(i / batchSize) + 1}`);
      }

      // Update import history with results
      await importHistoryRef.update({
        status: 'completed',
        transactionIds,
        pendingCategoryCount,
        userRuleCategorizedCount,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update or create import stats
      await updateImportStats(userId, {
        filesProcessed: 1,
        transactionsImported: toImport.length,
        duplicatesSkipped: totalDuplicates,
        aiDuplicatesDetected,
        aiCategorizedCount,
        pendingReviewCount: pendingCategoryCount,
        lastImportFileName: fileName
      });

      // Move file to processed folder
      await moveToProcessed(bucket, filePath, userId);

      console.log(`Import completed successfully: ${toImport.length} transactions`);

      // Send notification
      await sendImportNotification(userId, {
        fileName,
        importedCount: toImport.length,
        duplicateCount: totalDuplicates,
        pendingCategoryCount,
        aiCategorizedCount
      });

      return null;

    } catch (error) {
      console.error('Error processing import:', error);

      // Record the failed import
      await createImportHistory(userId, {
        fileHash: 'error',
        fileName,
        bankType: 'unknown',
        totalTransactions: 0,
        importedCount: 0,
        duplicateCount: 0,
        aiDuplicatesDetected: 0,
        aiCategorizedCount: 0,
        pendingCategoryCount: 0,
        status: 'failed',
        storagePath: filePath,
        errorMessage: error.message
      });

      // Send notification about the failure
      await sendImportNotification(userId, {
        fileName,
        importedCount: 0,
        duplicateCount: 0,
        pendingCategoryCount: 0,
        aiCategorizedCount: 0,
        error: true,
        errorMessage: error.message
      });

      return null;
    }
  });

/**
 * Helper: Create import history document
 */
async function createImportHistory(userId, data) {
  await db.collection('importHistory').add({
    userId,
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    transactionIds: [],
    source: 'storage_upload'
  });
}

/**
 * Helper: Update import stats
 */
async function updateImportStats(userId, increment) {
  const statsRef = db.collection('importStats').doc(userId);

  await db.runTransaction(async (transaction) => {
    const statsDoc = await transaction.get(statsRef);

    if (!statsDoc.exists) {
      transaction.set(statsRef, {
        userId,
        totalFilesProcessed: increment.filesProcessed,
        totalTransactionsImported: increment.transactionsImported,
        totalDuplicatesSkipped: increment.duplicatesSkipped,
        totalAiDuplicatesDetected: increment.aiDuplicatesDetected || 0,
        totalAiCategorized: increment.aiCategorizedCount || 0,
        pendingReviewCount: increment.pendingReviewCount,
        lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
        lastImportFileName: increment.lastImportFileName,
        bankStats: {}
      });
    } else {
      const currentStats = statsDoc.data();
      transaction.update(statsRef, {
        totalFilesProcessed: (currentStats.totalFilesProcessed || 0) + increment.filesProcessed,
        totalTransactionsImported: (currentStats.totalTransactionsImported || 0) + increment.transactionsImported,
        totalDuplicatesSkipped: (currentStats.totalDuplicatesSkipped || 0) + increment.duplicatesSkipped,
        totalAiDuplicatesDetected: (currentStats.totalAiDuplicatesDetected || 0) + (increment.aiDuplicatesDetected || 0),
        totalAiCategorized: (currentStats.totalAiCategorized || 0) + (increment.aiCategorizedCount || 0),
        pendingReviewCount: (currentStats.pendingReviewCount || 0) + increment.pendingReviewCount,
        lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
        lastImportFileName: increment.lastImportFileName
      });
    }
  });
}

/**
 * Helper: Move file to processed folder
 */
async function moveToProcessed(bucket, sourcePath, userId) {
  try {
    const fileName = sourcePath.split('/').pop();
    const timestamp = Date.now();
    const destPath = `processed/${userId}/${timestamp}_${fileName}`;

    await bucket.file(sourcePath).move(destPath);
    console.log(`Moved file to: ${destPath}`);
  } catch (error) {
    console.error('Error moving file to processed:', error);
  }
}

/**
 * Decrement pending review count when a transaction is reviewed
 */
exports.onTransactionReviewed = functions.firestore
  .document('transactions/{transactionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if needsReview changed from true to false
    if (before.needsReview === true && after.needsReview === false) {
      const userId = after.userId;

      const statsRef = db.collection('importStats').doc(userId);
      await statsRef.update({
        pendingReviewCount: admin.firestore.FieldValue.increment(-1)
      });

      console.log(`Decremented pending review count for user: ${userId}`);
    }

    return null;
  });
