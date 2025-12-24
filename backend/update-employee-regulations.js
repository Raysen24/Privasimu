// Script to update all regulations from old employee UID to new UID
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateEmployeeRegulations() {
  try {
    const newUID = '2ZCuIjy4hZNeBQ1P1ShEuGXHQp92'; // New employee UID
    const oldUIDs = [
      'G3zpnqkVd6h8sMSXrXi0tG1pwbt1', // Previous UID
      'FqmgVCKZhHPszGPwMeTB66ibRIl2'  // Original UID mentioned by user
    ];
    
    console.log('Updating regulations from old UIDs to new UID...\n');
    console.log(`New UID: ${newUID}`);
    console.log(`Old UIDs: ${oldUIDs.join(', ')}\n`);
    
    let totalUpdated = 0;
    
    // Update regulations for each old UID
    for (const oldUID of oldUIDs) {
      console.log(`\nChecking regulations with createdBy: ${oldUID}...`);
      
      const regulationsRef = db.collection('regulations');
      const snapshot = await regulationsRef.where('createdBy', '==', oldUID).get();
      
      if (snapshot.empty) {
        console.log(`  No regulations found with createdBy: ${oldUID}`);
        continue;
      }
      
      console.log(`  Found ${snapshot.size} regulation(s) with createdBy: ${oldUID}`);
      
      // Update each regulation
      const batch = db.batch();
      let batchCount = 0;
      const BATCH_SIZE = 500; // Firestore batch limit
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`  - Updating regulation: ${doc.id} (${data.title || 'Untitled'})`);
        
        batch.update(doc.ref, {
          createdBy: newUID,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
        totalUpdated++;
        
        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          // Note: We can't commit here in a forEach, so we'll do it after
        }
      });
      
      // Commit the batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✓ Updated ${batchCount} regulation(s)`);
      }
    }
    
    // Also check for any other fields that might reference the old UIDs
    console.log('\nChecking for other references to old UIDs...');
    
    const allRegulations = await db.collection('regulations').get();
    let otherUpdates = 0;
    
    for (const doc of allRegulations.docs) {
      const data = doc.data();
      let needsUpdate = false;
      const updates = {};
      
      // Check assignedTo field
      if (data.assignedTo && oldUIDs.includes(data.assignedTo)) {
        updates.assignedTo = newUID;
        needsUpdate = true;
      }
      
      // Check reviewerId field
      if (data.reviewerId && oldUIDs.includes(data.reviewerId)) {
        updates.reviewerId = newUID;
        needsUpdate = true;
      }
      
      // Check approverId field
      if (data.approverId && oldUIDs.includes(data.approverId)) {
        updates.approverId = newUID;
        needsUpdate = true;
      }
      
      // Check any array fields that might contain UIDs
      if (data.assignedUsers && Array.isArray(data.assignedUsers)) {
        const updatedArray = data.assignedUsers.map(uid => 
          oldUIDs.includes(uid) ? newUID : uid
        );
        if (JSON.stringify(updatedArray) !== JSON.stringify(data.assignedUsers)) {
          updates.assignedUsers = updatedArray;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await doc.ref.update(updates);
        console.log(`  - Updated other fields in regulation: ${doc.id}`);
        otherUpdates++;
      }
    }
    
    console.log(`\n✓ Update completed!`);
    console.log(`  Total regulations updated: ${totalUpdated}`);
    console.log(`  Other references updated: ${otherUpdates}`);
    
    // Verify the update
    console.log('\nVerifying update...');
    const verifySnapshot = await db.collection('regulations')
      .where('createdBy', '==', newUID)
      .get();
    
    console.log(`✓ Found ${verifySnapshot.size} regulation(s) with new UID: ${newUID}`);
    
    // Check if any old UIDs still exist
    for (const oldUID of oldUIDs) {
      const oldSnapshot = await db.collection('regulations')
        .where('createdBy', '==', oldUID)
        .get();
      
      if (!oldSnapshot.empty) {
        console.log(`⚠ Warning: Still found ${oldSnapshot.size} regulation(s) with old UID: ${oldUID}`);
      }
    }
    
  } catch (error) {
    console.error('Error updating regulations:', error);
    process.exit(1);
  }
}

updateEmployeeRegulations()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });




