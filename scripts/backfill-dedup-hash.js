#!/usr/bin/env node
/**
 * One-time backfill: compute dedupHash for existing transactions.
 * Usage: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/backfill-dedup-hash.js <clientId>
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const clientId = process.argv[2];
if (!clientId) {
  console.error('Usage: node backfill-dedup-hash.js <clientId>');
  process.exit(1);
}

const clientConfig = require(`../public/clients/${clientId}.json`);
const app = initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  projectId: clientConfig.firebase.projectId,
});
const db = getFirestore(app);

function djb2Hash64(message) {
  let hash = 5381;
  for (let i = 0; i < message.length; i++) {
    hash = ((hash << 5) + hash) ^ message.charCodeAt(i);
    hash = hash >>> 0;
  }
  const h = (x) => (hash ^ x) >>> 0;
  return [h(0), h(0xDEADBEEF), h(0xCAFEBABE), h(0xBAADF00D), h(0x8BADF00D), h(0xFEEDFACE), h(0xABADBABE), h(0xDEADC0DE)]
    .map(n => n.toString(16).padStart(8, '0')).join('');
}

function computeHash(t) {
  const date = String(t.date || '').substring(0, 10);
  const amount = Math.abs(Number(t.amount || 0)).toFixed(2);
  const bankType = String(t.bankType || 'unknown');
  const originalId = String(t.originalId || '');
  const index = '0';
  return djb2Hash64(`${date}|${amount}|${bankType}|${originalId}|${index}`);
}

async function main() {
  console.log(`Backfilling dedupHash for client: ${clientId}`);
  const allTxns = await db.collection('transactions').get();
  let updated = 0;
  let batchSize = 0;
  let batch = db.batch();

  for (const doc of allTxns.docs) {
    const data = doc.data();
    if (data.dedupHash) continue;
    batch.update(doc.ref, { dedupHash: computeHash(data) });
    batchSize++;
    updated++;
    if (batchSize === 500) {
      await batch.commit();
      console.log(`Updated ${updated}...`);
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) await batch.commit();
  console.log(`Done. Updated ${updated} transactions.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
