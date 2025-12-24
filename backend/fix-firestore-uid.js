// Script to ensure Firestore document UID matches Firebase Auth UID
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixFirestoreUID() {
  try {
    const employeeEmail = 'employee@gmail.com';
    
    console.log('Fixing Firestore UID to match Firebase Auth...\n');
    
    // Get Firebase Auth user
    let authUser;
    try {
      authUser = await admin.auth().getUserByEmail(employeeEmail);
      console.log(`✓ Firebase Auth user: ${authUser.uid} (${authUser.email})`);
    } catch (e) {
      console.error('✗ User not found in Firebase Auth');
      return;
    }
    
    // Check Firestore
    const usersRef = db.collection('users');
    
    // Check if document exists with correct UID
    const correctDoc = await usersRef.doc(authUser.uid).get();
    
    if (correctDoc.exists) {
      const userData = correctDoc.data();
      console.log(`✓ Firestore document exists with correct UID: ${authUser.uid}`);
      console.log(`  Email: ${userData.email}`);
      console.log(`  Role: ${userData.role}`);
      
      // Update email if needed
      if (userData.email !== employeeEmail) {
        await usersRef.doc(authUser.uid).update({
          email: employeeEmail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Updated email to ${employeeEmail}`);
      }
    } else {
      console.log(`✗ Firestore document NOT found with UID: ${authUser.uid}`);
      
      // Check if there's a document with the email
      const emailSnapshot = await usersRef.where('email', '==', employeeEmail).get();
      
      if (!emailSnapshot.empty) {
        console.log(`\nFound ${emailSnapshot.size} document(s) with email ${employeeEmail}:`);
        emailSnapshot.forEach((doc) => {
          console.log(`  - Document ID: ${doc.id} (should be ${authUser.uid})`);
          const data = doc.data();
          console.log(`    Role: ${data.role}, Name: ${data.name}`);
        });
        
        // Get the first document's data
        const firstDoc = emailSnapshot.docs[0];
        const userData = firstDoc.data();
        
        // Create document with correct UID
        console.log(`\nCreating Firestore document with correct UID: ${authUser.uid}...`);
        await usersRef.doc(authUser.uid).set({
          ...userData,
          email: employeeEmail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Created Firestore document with UID: ${authUser.uid}`);
        
        // Optionally delete old document(s)
        console.log(`\nDeleting old Firestore document(s) with wrong UID...`);
        for (const doc of emailSnapshot.docs) {
          if (doc.id !== authUser.uid) {
            await usersRef.doc(doc.id).delete();
            console.log(`✓ Deleted document with UID: ${doc.id}`);
          }
        }
      } else {
        // Create new document
        console.log(`\nCreating new Firestore document...`);
        await usersRef.doc(authUser.uid).set({
          email: employeeEmail,
          name: 'Employee User',
          role: 'employee',
          department: '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true,
          lastLogin: null
        });
        console.log(`✓ Created new Firestore document with UID: ${authUser.uid}`);
      }
    }
    
    // Verify the setup
    console.log('\nVerifying setup...');
    const verifyDoc = await usersRef.doc(authUser.uid).get();
    if (verifyDoc.exists) {
      const verifyData = verifyDoc.data();
      console.log(`✓ Verification successful:`);
      console.log(`  Firestore UID: ${authUser.uid}`);
      console.log(`  Email: ${verifyData.email}`);
      console.log(`  Role: ${verifyData.role}`);
      console.log(`  Name: ${verifyData.name || 'N/A'}`);
    } else {
      console.log('✗ Verification failed: Document not found');
    }
    
    console.log('\n✓ Fix completed!');
    console.log('\nThe user should now be able to log in with:');
    console.log(`  Email: ${employeeEmail}`);
    console.log(`  Password: 123456789`);
    
  } catch (error) {
    console.error('Error fixing Firestore UID:', error);
    process.exit(1);
  }
}

fixFirestoreUID()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




