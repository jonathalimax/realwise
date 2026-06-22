const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load service account for realwise-dev
const serviceAccountPath = path.join(__dirname, '../scripts/service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize with realwise-dev project
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'realwise-dev'
});

async function initializePricingConfig() {
  const db = admin.firestore();

  try {
    const pricingRef = db.collection('config').doc('pricing');
    const pricingSnap = await pricingRef.get();

    if (pricingSnap.exists) {
      const data = pricingSnap.data();
      console.log('✓ Pricing config already exists:');
      console.log(JSON.stringify(data, null, 2));

      // Check if it has basePriceCents
      if (!data.basePriceCents && data.totalCents) {
        console.log('\n⚠ Document has old schema (totalCents only). Updating to include basePriceCents...');
        await pricingRef.update({
          basePriceCents: data.totalCents,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✓ Successfully added basePriceCents field (value: ' + data.totalCents + ')');
      } else if (data.basePriceCents) {
        console.log('\n✓ Document already has basePriceCents (' + data.basePriceCents + '). No changes needed.');
      }
    } else {
      console.log('✗ Pricing config does not exist. Creating with default values...');
      // Default: R$ 19.90 monthly = 1990 cents
      const defaultConfig = {
        basePriceCents: 1990,
        totalCents: 1990, // kept for backward compatibility
        installments: 12,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await pricingRef.set(defaultConfig);
      console.log('✓ Successfully created pricing config:');
      console.log(JSON.stringify(defaultConfig, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error initializing pricing config:', error.message);
    process.exit(1);
  }
}

initializePricingConfig();
