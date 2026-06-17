const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to use default Firebase credentials or service account
const credentialPath = path.join(__dirname, '../scripts/service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));

// Initialize with the moneywise-ad9ec project
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moneywise-ad9ec'
});

const db = admin.firestore();

async function verifyPricingDoc() {
  try {
    console.log('Attempting to verify config/pricing in moneywise-ad9ec...');
    const docRef = db.collection('config').doc('pricing');
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists) {
      console.log('\n✓ Document EXISTS at config/pricing');
      console.log('\nCurrent data:');
      const data = docSnapshot.data();
      console.log(JSON.stringify(data, null, 2));
      
      // Verify all required fields
      const required = {
        originalCents: 47988,
        totalCents: 23880,
        installments: 12,
        active: true,
        campaignLabel: 'Lançamento'
      };
      
      let allCorrect = true;
      console.log('\nField verification:');
      for (const [key, expectedValue] of Object.entries(required)) {
        const actualValue = data[key];
        const match = JSON.stringify(actualValue) === JSON.stringify(expectedValue);
        console.log(`  ${key}: ${match ? '✓' : '✗'} (expected: ${JSON.stringify(expectedValue)}, actual: ${JSON.stringify(actualValue)})`);
        if (!match) allCorrect = false;
      }
      
      if (allCorrect) {
        console.log('\n✓✓✓ ALL FIELDS CORRECT ✓✓✓');
      } else {
        console.log('\n✗ Some fields need correction');
      }
    } else {
      console.log('\n✗ Document does NOT exist at config/pricing');
      console.log('\nCreating with specified data...');
      const pricingData = {
        originalCents: 47988,
        totalCents: 23880,
        installments: 12,
        active: true,
        campaignLabel: 'Lançamento'
      };
      
      await docRef.set(pricingData);
      console.log('✓ Document created successfully!');
      console.log('\nCreated data:');
      console.log(JSON.stringify(pricingData, null, 2));
    }
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.code === 'PERMISSION_DENIED') {
      console.error('\nNote: The service account in the repo does not have write permission to moneywise-ad9ec.');
      console.error('You must create this document manually via Firebase Console or use a different service account.');
    }
  } finally {
    process.exit(0);
  }
}

verifyPricingDoc();
