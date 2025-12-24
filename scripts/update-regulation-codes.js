const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'YOUR_FIREBASE_DATABASE_URL' // Replace with your Firebase project URL
});

const db = admin.firestore();

async function updateRegulationCodes() {
  try {
    console.log('Fetching all regulations...');
    const snapshot = await db.collection('regulations').get();
    
    console.log(`Found ${snapshot.size} regulations to update`);
    
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only update if code doesn't exist or is empty
      if (!data.code) {
        // Generate a code based on ID (first 8 chars) and current timestamp
        const code = `REG-${doc.id.substring(0, 8).toUpperCase()}`;
        batch.update(doc.ref, { code });
        console.log(`Updating regulation ${doc.id} with code: ${code}`);
        count++;
      }
    });
    
    if (count > 0) {
      console.log(`Committing batch update for ${count} regulations...`);
      await batch.commit();
      console.log('Successfully updated all regulations with codes');
    } else {
      console.log('No regulations needed updating');
    }
    
  } catch (error) {
    console.error('Error updating regulation codes:', error);
  } finally {
    process.exit(0);
  }
}

updateRegulationCodes();
