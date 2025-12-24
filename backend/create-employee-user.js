// Script to create or update employee user with email employee@gmail.com
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createOrUpdateEmployeeUser() {
  try {
    console.log('Checking for employee user...\n');
    
    // Check if employee@gmail.com already exists
    const usersRef = db.collection('users');
    const existingSnapshot = await usersRef.where('email', '==', 'employee@gmail.com').get();
    
    if (!existingSnapshot.empty) {
      console.log('User with employee@gmail.com already exists:');
      existingSnapshot.forEach(doc => {
        console.log(`  ID: ${doc.id}`);
        console.log(`  Email: ${doc.data().email}`);
        console.log(`  Name: ${doc.data().name}`);
        console.log(`  Role: ${doc.data().role}`);
      });
      console.log('\nNo changes needed.');
      return;
    }
    
    // Check if christophermatthew@gmail.com exists and update it
    const oldEmailSnapshot = await usersRef.where('email', '==', 'christophermatthew@gmail.com').get();
    
    if (!oldEmailSnapshot.empty) {
      console.log('Found user with christophermatthew@gmail.com, updating...');
      oldEmailSnapshot.forEach(async (doc) => {
        await usersRef.doc(doc.id).update({
          email: 'employee@gmail.com',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ Updated user ${doc.id}: email changed to employee@gmail.com`);
      });
    } else {
      // Create new employee user
      console.log('Creating new employee user with email: employee@gmail.com');
      const newUser = {
        email: 'employee@gmail.com',
        name: 'Employee User',
        role: 'employee',
        department: '',
        password: '', // Password should be set through Firebase Auth
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        lastLogin: null
      };
      
      const docRef = await usersRef.add(newUser);
      console.log(`✓ Created new employee user with ID: ${docRef.id}`);
      console.log('User data:', newUser);
    }
    
    console.log('\n✓ Employee user setup completed!');
    console.log('\nNote: You will also need to create/update the user in Firebase Authentication:');
    console.log('  1. Go to Firebase Console → Authentication');
    console.log('  2. If user exists with old email, update it to employee@gmail.com');
    console.log('  3. If user doesn\'t exist, create new user with email: employee@gmail.com');
    
  } catch (error) {
    console.error('Error creating/updating employee user:', error);
    process.exit(1);
  }
}

createOrUpdateEmployeeUser()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




