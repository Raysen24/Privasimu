// Script to set password for employee user
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setEmployeePassword() {
  try {
    const employeeEmail = 'employee@gmail.com';
    const password = '123456789';
    
    console.log('Setting password for employee user...\n');
    
    // Get the current user by email
    let user;
    try {
      user = await admin.auth().getUserByEmail(employeeEmail);
      console.log(`✓ Found user: ${user.email} (UID: ${user.uid})`);
    } catch (e) {
      console.error('✗ User not found in Firebase Auth with email:', employeeEmail);
      return;
    }
    
    // Set password
    console.log(`\nSetting password to: ${password}...`);
    await admin.auth().updateUser(user.uid, {
      password: password
    });
    console.log('✓ Password set successfully!');
    
    // Ensure Firestore document exists with correct UID
    console.log('\nChecking Firestore document...');
    const usersRef = db.collection('users');
    const firestoreDoc = await usersRef.doc(user.uid).get();
    
    if (firestoreDoc.exists) {
      // Update email if needed
      const userData = firestoreDoc.data();
      if (userData.email !== employeeEmail) {
        await usersRef.doc(user.uid).update({
          email: employeeEmail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Updated Firestore document: email set to ${employeeEmail}`);
      } else {
        console.log(`✓ Firestore document already has correct email`);
      }
    } else {
      // Create Firestore document
      await usersRef.doc(user.uid).set({
        email: employeeEmail,
        name: 'Employee User',
        role: 'employee',
        department: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        lastLogin: null
      });
      console.log(`✓ Created Firestore document with UID: ${user.uid}`);
    }
    
    // Check for any other documents with this email
    const emailSnapshot = await usersRef.where('email', '==', employeeEmail).get();
    if (emailSnapshot.size > 1) {
      console.log(`\n⚠ Warning: Found ${emailSnapshot.size} Firestore documents with email ${employeeEmail}`);
      emailSnapshot.forEach((doc) => {
        if (doc.id !== user.uid) {
          console.log(`  - Document ID: ${doc.id} (should be ${user.uid})`);
        }
      });
    }
    
    console.log('\n✓ Setup completed!');
    console.log('\nLogin credentials:');
    console.log(`  Email: ${employeeEmail}`);
    console.log(`  Password: ${password}`);
    console.log(`  UID: ${user.uid}`);
    console.log('\nNote: The UID in Firebase Auth is automatically generated and cannot be changed.');
    console.log('If you need a specific UID, you would need to delete and recreate the user,');
    console.log('but the new user will get a different UID.');
    
  } catch (error) {
    console.error('Error setting password:', error);
    process.exit(1);
  }
}

setEmployeePassword()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




