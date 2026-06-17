const admin = require('firebase-admin');
const serviceAccount = require('../scripts/service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'moneywise-ad9ec'
});

const db = admin.firestore();

async function verifyPricingDoc() {
  try {
    const docRef = db.collection('config').doc('pricing');
    const docSnapshot = await docRef.get();
    
    if (docSnapshot.exists) {
      console.log('Document EXISTS. Current data:');
      console.log(JSON.stringify(docSnapshot.data(), null, 2));
      return;
    }
    
    console.log('Document does NOT exist. Creating with specified data...');
    const pricingData = {
      originalCents: 47988,
      totalCents: 23880,
      installments: 12,
      active: true,
      campaignLabel: 'Lançamento'
    };
    
    await docRef.set(pricingData);
    console.log('Document created successfully!');
    console.log('Data:', JSON.stringify(pricingData, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyPricingDoc();
