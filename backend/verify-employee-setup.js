// Script to verify employee user setup
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifyEmployeeSetup() {
  try {
    const employeeEmail = 'employee@gmail.com';
    
    console.log('Verifying employee user setup...\n');
    
    // Check Firebase Auth
    console.log('1. Checking Firebase Auth...');
    let authUser;
    try {
      authUser = await admin.auth().getUserByEmail(employeeEmail);
      console.log(`   ✓ User exists in Firebase Auth`);
      console.log(`     UID: ${authUser.uid}`);
      console.log(`     Email: ${authUser.email}`);
      console.log(`     Email Verified: ${authUser.emailVerified}`);
      console.log(`     Disabled: ${authUser.disabled}`);
      console.log(`     Created: ${authUser.metadata.creationTime}`);
    } catch (e) {
      console.log(`   ✗ User NOT found in Firebase Auth: ${e.message}`);
      return;
    }
    
    // Check Firestore
    console.log('\n2. Checking Firestore...');
    const usersRef = db.collection('users');
    const firestoreDoc = await usersRef.doc(authUser.uid).get();
    
    if (firestoreDoc.exists) {
      const userData = firestoreDoc.data();
      console.log(`   ✓ Document exists in Firestore with matching UID`);
      console.log(`     Document ID: ${firestoreDoc.id}`);
      console.log(`     Email: ${userData.email}`);
      console.log(`     Role: ${userData.role}`);
      console.log(`     Name: ${userData.name || 'N/A'}`);
      
      // Check if UIDs match
      if (firestoreDoc.id === authUser.uid) {
        console.log(`   ✓ UIDs match!`);
      } else {
        console.log(`   ✗ UID mismatch!`);
        console.log(`     Firebase Auth UID: ${authUser.uid}`);
        console.log(`     Firestore Document ID: ${firestoreDoc.id}`);
      }
      
      // Check if email matches
      if (userData.email === employeeEmail) {
        console.log(`   ✓ Email matches!`);
      } else {
        console.log(`   ✗ Email mismatch!`);
        console.log(`     Expected: ${employeeEmail}`);
        console.log(`     Found: ${userData.email}`);
      }
    } else {
      console.log(`   ✗ Document NOT found in Firestore with UID: ${authUser.uid}`);
      
      // Check if document exists with email
      const emailSnapshot = await usersRef.where('email', '==', employeeEmail).get();
      if (!emailSnapshot.empty) {
        console.log(`   ⚠ Found ${emailSnapshot.size} document(s) with email ${employeeEmail} but different UID:`);
        emailSnapshot.forEach((doc) => {
          console.log(`     - Document ID: ${doc.id} (should be ${authUser.uid})`);
        });
      }
    }
    
    // Test password (we can't verify the actual password, but we can try to update it)
    console.log('\n3. Password status...');
    console.log(`   Password should be set to: 123456789`);
    console.log(`   (Cannot verify password without attempting login)`);
    
    console.log('\n✓ Verification complete!');
    console.log('\nLogin should work with:');
    console.log(`  Email: ${employeeEmail}`);
    console.log(`  Password: 123456789`);
    
    // If there are issues, suggest fixes
    if (!firestoreDoc.exists || firestoreDoc.id !== authUser.uid) {
      console.log('\n⚠ Issues detected! Run fix-firestore-uid.js to fix them.');
    }
    
  } catch (error) {
    console.error('Error verifying setup:', error);
    process.exit(1);
  }
}

verifyEmployeeSetup()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




