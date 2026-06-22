const admin = require('firebase-admin');

/**
 * Initialize or update the pricing config in Firestore.
 * Run this once after deploying to ensure the pricing document exists.
 *
 * Usage: node initializePricingConfig.js
 */
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
        console.log('\n⚠ Document has old schema (totalCents). Updating to include basePriceCents...');
        await pricingRef.update({
          basePriceCents: data.totalCents,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✓ Successfully added basePriceCents field (value: ' + data.totalCents + ')');
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
  } catch (error) {
    console.error('✗ Error initializing pricing config:', error.message);
    console.error('Make sure Firebase Admin SDK is initialized with proper credentials.');
    process.exit(1);
  }
}

// Only run if firebase-admin is already initialized
if (admin.apps.length === 0) {
  console.error('✗ Firebase Admin not initialized. Initialize before calling this function.');
  process.exit(1);
}

initializePricingConfig();
