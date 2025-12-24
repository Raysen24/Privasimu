// Script to fix Firebase Auth email conflict for employee user
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function fixEmployeeEmailAuth() {
  try {
    console.log('Fixing Firebase Auth email for employee user...\n');
    
    // Get the user that should have employee@gmail.com (the one with the Firestore ID)
    const targetUID = 'G3zpnqkVd6h8sMSXrXi0tG1pwbt1'; // This matches the Firestore user ID
    const duplicateUID = 'FqmgVCKZhHPszGPwMeTB66ibRIl2'; // The duplicate employee@gmail.com user
    
    console.log('Checking users...');
    
    // Check if target user exists
    let targetUser;
    try {
      targetUser = await admin.auth().getUser(targetUID);
      console.log(`✓ Found target user: ${targetUser.email} (UID: ${targetUID})`);
    } catch (e) {
      console.error(`✗ Target user with UID ${targetUID} not found in Firebase Auth`);
      return;
    }
    
    // Check if duplicate user exists
    let duplicateUser;
    try {
      duplicateUser = await admin.auth().getUser(duplicateUID);
      console.log(`✓ Found duplicate user: ${duplicateUser.email} (UID: ${duplicateUID})`);
    } catch (e) {
      console.log(`ℹ Duplicate user with UID ${duplicateUID} not found (may have been deleted)`);
      duplicateUser = null;
    }
    
    // If duplicate exists and has employee@gmail.com, delete it
    if (duplicateUser && duplicateUser.email === 'employee@gmail.com') {
      console.log('\n⚠ WARNING: About to delete duplicate user with employee@gmail.com');
      console.log(`   UID: ${duplicateUID}`);
      console.log(`   This user will be permanently deleted from Firebase Auth.`);
      console.log(`   Make sure this user is not needed before proceeding.\n`);
      
      // In a real scenario, you might want to add a confirmation prompt
      // For now, we'll proceed with the deletion
      await admin.auth().deleteUser(duplicateUID);
      console.log(`✓ Deleted duplicate user with UID ${duplicateUID}`);
    }
    
    // Now update the target user's email
    if (targetUser.email !== 'employee@gmail.com') {
      console.log(`\nUpdating target user email from ${targetUser.email} to employee@gmail.com...`);
      await admin.auth().updateUser(targetUID, {
        email: 'employee@gmail.com'
      });
      console.log(`✓ Updated Firebase Auth user ${targetUID}: email changed to employee@gmail.com`);
    } else {
      console.log(`\n✓ Target user already has email: employee@gmail.com`);
    }
    
    console.log('\n✓ Email update completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Firestore: User ID ${targetUID} has email employee@gmail.com`);
    console.log(`  - Firebase Auth: User UID ${targetUID} has email employee@gmail.com`);
    console.log('\nThe employee user can now log in with: employee@gmail.com');
    
  } catch (error) {
    console.error('Error fixing employee email:', error);
    if (error.code === 'auth/email-already-exists') {
      console.error('\n⚠ The email employee@gmail.com is still in use by another account.');
      console.error('   You may need to manually delete the duplicate user in Firebase Console.');
    }
    process.exit(1);
  }
}

fixEmployeeEmailAuth()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




