// Script to list all users in Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listUsers() {
  try {
    console.log('Fetching all users from Firestore...\n');
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('No users found in Firestore.');
      return;
    }
    
    console.log(`Found ${snapshot.size} user(s):\n`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`  Email: ${data.email || 'N/A'}`);
      console.log(`  Name: ${data.name || 'N/A'}`);
      console.log(`  Role: ${data.role || 'N/A'}`);
      console.log(`  Department: ${data.department || 'N/A'}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
}

listUsers()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




