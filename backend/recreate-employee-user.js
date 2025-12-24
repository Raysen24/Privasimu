// Script to recreate employee user in Firebase Auth and ensure Firestore matches
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function recreateEmployeeUser() {
  try {
    const employeeEmail = 'employee@gmail.com';
    const password = '123456789';
    
    console.log('Recreating employee user...\n');
    
    // Check if user already exists
    let authUser;
    try {
      authUser = await admin.auth().getUserByEmail(employeeEmail);
      console.log(`✓ User already exists in Firebase Auth: ${authUser.uid}`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log('User not found in Firebase Auth. Creating new user...');
        
        // Create new user in Firebase Auth
        authUser = await admin.auth().createUser({
          email: employeeEmail,
          password: password,
          emailVerified: false,
          disabled: false
        });
        
        console.log(`✓ Created new user in Firebase Auth:`);
        console.log(`  UID: ${authUser.uid}`);
        console.log(`  Email: ${authUser.email}`);
      } else {
        throw e;
      }
    }
    
    // Update password if user exists
    if (authUser) {
      try {
        await admin.auth().updateUser(authUser.uid, {
          password: password
        });
        console.log(`✓ Password set to: ${password}`);
      } catch (e) {
        console.log(`⚠ Could not update password: ${e.message}`);
      }
    }
    
    // Ensure Firestore document exists with matching UID
    console.log('\nChecking Firestore document...');
    const usersRef = db.collection('users');
    const firestoreDoc = await usersRef.doc(authUser.uid).get();
    
    if (firestoreDoc.exists) {
      const userData = firestoreDoc.data();
      console.log(`✓ Firestore document exists with matching UID`);
      
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
      
      // Check if there's a document with the email but different UID
      const emailSnapshot = await usersRef.where('email', '==', employeeEmail).get();
      
      if (!emailSnapshot.empty) {
        console.log(`Found ${emailSnapshot.size} document(s) with email ${employeeEmail}:`);
        const firstDoc = emailSnapshot.docs[0];
        const userData = firstDoc.data();
        
        // Create document with correct UID
        await usersRef.doc(authUser.uid).set({
          ...userData,
          email: employeeEmail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Created Firestore document with correct UID: ${authUser.uid}`);
        
        // Delete old documents
        for (const doc of emailSnapshot.docs) {
          if (doc.id !== authUser.uid) {
            await usersRef.doc(doc.id).delete();
            console.log(`✓ Deleted old document with UID: ${doc.id}`);
          }
        }
      } else {
        // Create new document
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
    
    // Final verification
    console.log('\nFinal verification...');
    const verifyAuth = await admin.auth().getUser(authUser.uid);
    const verifyFirestore = await usersRef.doc(authUser.uid).get();
    
    console.log(`✓ Firebase Auth: ${verifyAuth.email} (UID: ${verifyAuth.uid})`);
    if (verifyFirestore.exists) {
      console.log(`✓ Firestore: ${verifyFirestore.data().email} (UID: ${verifyFirestore.id})`);
      console.log(`✓ UIDs match: ${verifyAuth.uid === verifyFirestore.id}`);
    } else {
      console.log(`✗ Firestore document still missing!`);
    }
    
    console.log('\n✓ Setup completed!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${employeeEmail}`);
    console.log(`  Password: ${password}`);
    console.log(`  UID: ${authUser.uid}`);
    
  } catch (error) {
    console.error('Error recreating employee user:', error);
    process.exit(1);
  }
}

recreateEmployeeUser()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




