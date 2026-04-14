/**
 * B3 investment sync — fetches prices and dividends from Brapi.dev free API
 * and updates the investments collection + creates dividend income transactions.
 */

const admin = require('firebase-admin');
const axios = require('axios');

const BRAPI_BASE = 'https://brapi.dev/api';

const db = admin.firestore();

/**
 * Main sync entry point. Call from scheduled function or callable.
 * @param {string} userId
 */
async function runB3Sync(userId) {
  console.log(`[B3Sync] Starting sync for user: ${userId}`);

  const snap = await db.collection('investments')
    .where('userId', '==', userId)
    .where('source', '==', 'b3')
    .get();

  if (snap.empty) {
    console.log('[B3Sync] No B3 investments found');
    return { updated: 0, dividends: 0 };
  }

  const investments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(inv => inv.ticker && inv.status !== 'closed');

  const tickers = [...new Set(investments.map(inv => inv.ticker))];
  console.log(`[B3Sync] Syncing ${tickers.length} unique tickers: ${tickers.join(', ')}`);

  const prices = await fetchPrices(tickers);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const priceUpdates = [];
  for (const inv of investments) {
    const price = prices[inv.ticker];
    if (price == null) {
      console.warn(`[B3Sync] No price found for ${inv.ticker}`);
      continue;
    }
    const newCurrentAmount = price * (inv.quantity || 1);
    priceUpdates.push(
      db.collection('investments').doc(inv.id).update({
        currentAmount: newCurrentAmount,
        lastSyncedAt: now,
        updatedAt: now,
      })
    );
  }
  await Promise.all(priceUpdates);
  console.log(`[B3Sync] Updated prices for ${priceUpdates.length} investments`);

  let totalDividends = 0;
  for (const ticker of tickers) {
    const inv = investments.find(i => i.ticker === ticker);
    if (!inv) continue;
    const quantity = inv.quantity || 1;
    const count = await processDividends(userId, ticker, inv.id, quantity);
    totalDividends += count;
  }

  console.log(`[B3Sync] Done — prices updated: ${priceUpdates.length}, dividends recorded: ${totalDividends}`);
  return { updated: priceUpdates.length, dividends: totalDividends };
}

/**
 * Fetch current prices for tickers from Brapi.dev (batched in groups of 10).
 * @returns {{ [ticker: string]: number }}
 */
async function fetchPrices(tickers) {
  const prices = {};
  const BATCH = 10;

  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const url = `${BRAPI_BASE}/quote/${batch.join(',')}`;
    try {
      const resp = await axios.get(url, { timeout: 10000 });
      const results = resp.data?.results || [];
      for (const r of results) {
        if (r.symbol && r.regularMarketPrice != null) {
          prices[r.symbol] = r.regularMarketPrice;
        }
      }
    } catch (err) {
      console.error(`[B3Sync] Error fetching prices for ${batch.join(',')}:`, err.message);
    }

    if (i + BATCH < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return prices;
}

/**
 * Fetch dividend history for a ticker and record unseen dividends as income transactions.
 * Uses investment_dividends collection as a dedup log.
 * @returns {number} count of new dividend transactions created
 */
async function processDividends(userId, ticker, investmentId, quantity) {
  const url = `${BRAPI_BASE}/quote/${ticker}?dividends=true`;
  let cashDividends = [];

  try {
    const resp = await axios.get(url, { timeout: 10000 });
    cashDividends = resp.data?.results?.[0]?.dividendsData?.cashDividends || [];
  } catch (err) {
    console.error(`[B3Sync] Error fetching dividends for ${ticker}:`, err.message);
    return 0;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 24);

  let created = 0;

  for (const dividend of cashDividends) {
    const paymentDate = dividend.paymentDate;
    if (!paymentDate) continue;

    const paid = new Date(paymentDate);
    if (paid > today || paid < cutoffDate) continue;

    const normalizedDate = new Date(paymentDate).toISOString().split('T')[0];
    const dedupId = `${userId}_${ticker}_${normalizedDate}`;
    const dedupRef = db.collection('investment_dividends').doc(dedupId);
    const dedupSnap = await dedupRef.get();
    if (dedupSnap.exists) continue;

    const amount = (dividend.rate || 0) * quantity;
    if (amount <= 0) continue;

    const txRef = await db.collection('transactions').add({
      userId,
      type: 'income',
      description: `Dividendo: ${ticker}`,
      amount,
      category: 'Investimentos',
      date: new Date(paymentDate + 'T12:00:00').toISOString(),
      investmentId,
      isDividend: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await dedupRef.set({
      userId,
      ticker,
      paymentDate: normalizedDate,
      amount,
      transactionId: txRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    created++;
  }

  return created;
}

module.exports = { runB3Sync };
