// Script to fix employee user UID mismatch and set password
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixEmployeeUID() {
  try {
    const correctUID = 'FqmgVCKZhHPszGPwMeTB66ibRIl2';
    const wrongUID = 'G3zpnqkVd6h8sMSXrXi0tG1pwbt1';
    const employeeEmail = 'employee@gmail.com';
    const password = '123456789';
    
    console.log('Fixing employee user UID mismatch...\n');
    
    // Check current state
    console.log('Checking current Firebase Auth users...');
    try {
      const currentUser = await admin.auth().getUserByEmail(employeeEmail);
      console.log(`Current user in Firebase Auth: ${currentUser.uid} (${currentUser.email})`);
      
      if (currentUser.uid === correctUID) {
        console.log('✓ UID is already correct!');
      } else {
        console.log(`⚠ UID mismatch! Expected: ${correctUID}, Found: ${currentUser.uid}`);
      }
    } catch (e) {
      console.log('✗ User not found in Firebase Auth with email:', employeeEmail);
    }
    
    // Try to get the correct user by UID
    let correctUser;
    try {
      correctUser = await admin.auth().getUser(correctUID);
      console.log(`\n✓ Found user with correct UID: ${correctUser.email || 'No email set'}`);
      
      // Update email if needed
      if (correctUser.email !== employeeEmail) {
        console.log(`Updating email from ${correctUser.email} to ${employeeEmail}...`);
        await admin.auth().updateUser(correctUID, {
          email: employeeEmail
        });
        console.log('✓ Email updated');
      }
      
      // Set password
      console.log('Setting password...');
      await admin.auth().updateUser(correctUID, {
        password: password
      });
      console.log('✓ Password set to: 123456789');
      
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`\n⚠ User with UID ${correctUID} not found. Creating new user...`);
        
        // Create new user with correct UID (we can't set custom UID, so we'll create and note the issue)
        const newUser = await admin.auth().createUser({
          email: employeeEmail,
          password: password,
          emailVerified: false
        });
        
        console.log(`✓ Created new user with UID: ${newUser.uid}`);
        console.log(`⚠ Note: New UID is ${newUser.uid}, not ${correctUID}`);
        console.log('  You may need to update Firestore to use this new UID.');
        
        // Update Firestore to use the new UID
        const usersRef = db.collection('users');
        const firestoreSnapshot = await usersRef.where('email', '==', employeeEmail).get();
        
        if (!firestoreSnapshot.empty) {
          firestoreSnapshot.forEach(async (doc) => {
            // Update the document ID or create a new one with correct UID
            const userData = doc.data();
            if (doc.id !== newUser.uid) {
              // Create new document with correct UID
              await usersRef.doc(newUser.uid).set({
                ...userData,
                email: employeeEmail,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              // Optionally delete old document
              // await usersRef.doc(doc.id).delete();
              console.log(`✓ Updated Firestore: Created document with UID ${newUser.uid}`);
            }
          });
        } else {
          // Create new Firestore document
          await usersRef.doc(newUser.uid).set({
            email: employeeEmail,
            name: 'Employee User',
            role: 'employee',
            department: '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true,
            lastLogin: null
          });
          console.log(`✓ Created Firestore document with UID ${newUser.uid}`);
        }
        
        return;
      } else {
        throw e;
      }
    }
    
    // Update Firestore to use correct UID
    console.log('\nUpdating Firestore to use correct UID...');
    const usersRef = db.collection('users');
    
    // Check if document exists with wrong UID
    const wrongDoc = await usersRef.doc(wrongUID).get();
    if (wrongDoc.exists) {
      const userData = wrongDoc.data();
      console.log(`Found Firestore document with wrong UID: ${wrongUID}`);
      
      // Create/update document with correct UID
      await usersRef.doc(correctUID).set({
        ...userData,
        email: employeeEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✓ Created/updated Firestore document with correct UID: ${correctUID}`);
      
      // Optionally delete the wrong document
      // await usersRef.doc(wrongUID).delete();
      // console.log(`✓ Deleted Firestore document with wrong UID: ${wrongUID}`);
    } else {
      // Check if document exists with correct UID
      const correctDoc = await usersRef.doc(correctUID).get();
      if (!correctDoc.exists) {
        // Create new document
        await usersRef.doc(correctUID).set({
          email: employeeEmail,
          name: 'Employee User',
          role: 'employee',
          department: '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          isActive: true,
          lastLogin: null
        });
        console.log(`✓ Created Firestore document with UID: ${correctUID}`);
      } else {
        // Update existing document
        await usersRef.doc(correctUID).update({
          email: employeeEmail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Updated Firestore document with UID: ${correctUID}`);
      }
    }
    
    // Check if there's a document with the email
    const emailSnapshot = await usersRef.where('email', '==', employeeEmail).get();
    if (!emailSnapshot.empty) {
      emailSnapshot.forEach(async (doc) => {
        if (doc.id !== correctUID) {
          console.log(`⚠ Found additional Firestore document with email ${employeeEmail} but different UID: ${doc.id}`);
          // Update it to use correct UID or delete it
        }
      });
    }
    
    console.log('\n✓ Fix completed!');
    console.log('\nSummary:');
    console.log(`  - Firebase Auth: UID ${correctUID} has email ${employeeEmail}`);
    console.log(`  - Password: 123456789`);
    console.log(`  - Firestore: Document with UID ${correctUID} has email ${employeeEmail}`);
    console.log('\nYou can now log in with:');
    console.log(`  Email: ${employeeEmail}`);
    console.log(`  Password: 123456789`);
    
  } catch (error) {
    console.error('Error fixing employee UID:', error);
    process.exit(1);
  }
}

fixEmployeeUID()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




