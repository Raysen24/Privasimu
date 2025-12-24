// Script to check Firebase Auth users
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkFirebaseAuth() {
  try {
    console.log('Checking Firebase Authentication users...\n');
    
    // List all users (limited to first 1000)
    const listUsersResult = await admin.auth().listUsers(1000);
    
    console.log(`Found ${listUsersResult.users.length} user(s) in Firebase Auth:\n`);
    
    listUsersResult.users.forEach((userRecord) => {
      console.log(`UID: ${userRecord.uid}`);
      console.log(`  Email: ${userRecord.email || 'N/A'}`);
      console.log(`  Email Verified: ${userRecord.emailVerified || false}`);
      console.log(`  Disabled: ${userRecord.disabled || false}`);
      console.log('---');
    });
    
    // Check specifically for the emails we care about
    console.log('\nChecking specific emails:');
    try {
      const employeeUser = await admin.auth().getUserByEmail('employee@gmail.com');
      console.log(`✓ employee@gmail.com exists in Firebase Auth (UID: ${employeeUser.uid})`);
    } catch (e) {
      console.log(`✗ employee@gmail.com NOT found in Firebase Auth`);
    }
    
    try {
      const oldUser = await admin.auth().getUserByEmail('christophermatthewgunawan@gmail.com');
      console.log(`✓ christophermatthewgunawan@gmail.com exists in Firebase Auth (UID: ${oldUser.uid})`);
      console.log('  → This user should be updated to employee@gmail.com');
    } catch (e) {
      console.log(`✗ christophermatthewgunawan@gmail.com NOT found in Firebase Auth`);
    }
    
  } catch (error) {
    console.error('Error checking Firebase Auth:', error);
    process.exit(1);
  }
}

checkFirebaseAuth()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




