// Script to update employee email from christophermatthew@gmail.com to employee@gmail.com
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateEmployeeEmail() {
  try {
    console.log('Searching for employee user to update email...');
    
    // Find user by email (try both variations)
    const usersRef = db.collection('users');
    let snapshot = await usersRef.where('email', '==', 'christophermatthew@gmail.com').get();
    
    // If not found, try the full email
    if (snapshot.empty) {
      snapshot = await usersRef.where('email', '==', 'christophermatthewgunawan@gmail.com').get();
    }
    
    // Also check by role if email search fails
    if (snapshot.empty) {
      console.log('Searching by role: employee...');
      const roleSnapshot = await usersRef.where('role', '==', 'employee').get();
      roleSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email && data.email.includes('christopher')) {
          snapshot = roleSnapshot;
        }
      });
    }
    
    if (snapshot.empty) {
      console.log('No user found with email: christophermatthew@gmail.com');
      console.log('Checking if employee@gmail.com already exists...');
      
      const existingSnapshot = await usersRef.where('email', '==', 'employee@gmail.com').get();
      if (!existingSnapshot.empty) {
        console.log('User with employee@gmail.com already exists!');
        existingSnapshot.forEach(doc => {
          console.log('Existing user:', doc.id, doc.data());
        });
      }
      return;
    }
    
    // Process all updates
    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const oldEmail = userData.email;
      
      console.log('Found user:', {
        id: doc.id,
        email: oldEmail,
        name: userData.name,
        role: userData.role
      });
      
      // Update email in Firestore
      await usersRef.doc(doc.id).update({
        email: 'employee@gmail.com',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✓ Updated Firestore user ${doc.id}: email changed from ${oldEmail} to employee@gmail.com`);
      
      // Also update in Firebase Auth if the user exists there
      try {
        // Try to get user by old email from Firebase Auth
        let authUser = null;
        try {
          authUser = await admin.auth().getUserByEmail(oldEmail);
        } catch (e) {
          // User might not exist in Auth yet
          console.log(`User with email ${oldEmail} not found in Firebase Auth`);
        }
        
        if (authUser) {
          await admin.auth().updateUser(authUser.uid, {
            email: 'employee@gmail.com'
          });
          console.log(`✓ Updated Firebase Auth user ${authUser.uid}: email changed to employee@gmail.com`);
        } else {
          console.log('Note: User not found in Firebase Auth. You may need to create/update it manually in Firebase Console → Authentication.');
        }
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.log('User not found in Firebase Auth (may not have been created there)');
        } else {
          console.error('Error updating Firebase Auth:', authError);
        }
      }
    }
    
    console.log('\n✓ Email update completed!');
    console.log('Note: If the user needs to log in again, they should use: employee@gmail.com');
    
  } catch (error) {
    console.error('Error updating employee email:', error);
    process.exit(1);
  }
}

// Run the update
updateEmployeeEmail()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

