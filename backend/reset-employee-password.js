// Script to reset password for employee user
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function resetEmployeePassword() {
  try {
    const employeeEmail = 'employee@gmail.com';
    const employeeUID = 'G3zpnqkVd6h8sMSXrXi0tG1pwbt1';
    
    console.log('Resetting password for employee user...\n');
    
    // Get user info
    let user;
    try {
      user = await admin.auth().getUserByEmail(employeeEmail);
      console.log(`✓ Found user: ${user.email} (UID: ${user.uid})`);
    } catch (e) {
      try {
        user = await admin.auth().getUser(employeeUID);
        console.log(`✓ Found user by UID: ${user.email} (UID: ${user.uid})`);
      } catch (e2) {
        console.error('✗ User not found in Firebase Auth');
        return;
      }
    }
    
    // Generate a temporary password
    const tempPassword = 'Employee123!'; // You can change this
    console.log(`\nSetting temporary password: ${tempPassword}`);
    console.log('⚠ IMPORTANT: User should change this password after first login!\n');
    
    // Update the password
    await admin.auth().updateUser(user.uid, {
      password: tempPassword
    });
    
    console.log(`✓ Password reset successful!`);
    console.log(`\nLogin credentials:`);
    console.log(`  Email: ${employeeEmail}`);
    console.log(`  Password: ${tempPassword}`);
    console.log(`\n⚠ Please change the password after logging in!`);
    
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

resetEmployeePassword()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




