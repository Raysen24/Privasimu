/**
 * Detailed Firestore connection test
 * This will help us identify the exact issue
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

console.log("🔍 Detailed Firestore Connection Test\n");

try {
  // Initialize Firebase Admin
  console.log("1. Initializing Firebase Admin...");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  console.log("   ✅ Initialized");
  console.log("   Project ID:", serviceAccount.project_id);
  console.log("   Client Email:", serviceAccount.client_email);

  // Get Firestore instance
  console.log("\n2. Getting Firestore instance...");
  const db = admin.firestore();
  console.log("   ✅ Firestore instance created");

  // Try to get database info
  console.log("\n3. Testing database connection...");
  
  // Method 1: Try to list collections (this will fail if database doesn't exist or is in wrong mode)
  try {
    const collections = await db.listCollections();
    console.log("   ✅ Connection successful!");
    console.log("   Collections found:", collections.length);
    collections.forEach(col => {
      console.log("      -", col.id);
    });
  } catch (error) {
    console.log("   ❌ Error listing collections:", error.code, error.message);
    
    if (error.code === 5 || error.message.includes("NOT_FOUND")) {
      console.log("\n   💡 This usually means:");
      console.log("      - Database is in Datastore mode (not Native Firestore mode)");
      console.log("      - Database doesn't exist in Native mode");
      console.log("      - Service account doesn't have permissions");
      console.log("\n   🔧 Solution:");
      console.log("      1. Go to Firebase Console");
      console.log("      2. Click 'Add database' (create a NEW one)");
      console.log("      3. Make sure it says 'Cloud Firestore' (NOT 'Cloud Datastore')");
      console.log("      4. Choose 'Start in test mode'");
      console.log("      5. Wait 2-3 minutes and try again");
    }
    throw error;
  }

  // Method 2: Try to write a test document
  console.log("\n4. Testing write operation...");
  try {
    const testRef = db.collection("_connection_test").doc("test");
    await testRef.set({
      message: "Connection test",
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("   ✅ Write successful!");

    // Read it back
    const doc = await testRef.get();
    if (doc.exists) {
      console.log("   ✅ Read successful!");
      console.log("   Data:", doc.data());
      
      // Cleanup
      await testRef.delete();
      console.log("   ✅ Cleanup successful!");
    }
  } catch (error) {
    console.log("   ❌ Write failed:", error.code, error.message);
    throw error;
  }

  console.log("\n✅ All tests passed! Firestore is working correctly.\n");
  
} catch (error) {
  console.log("\n❌ Connection test failed!\n");
  console.log("Error Code:", error.code);
  console.log("Error Message:", error.message);
  console.log("\n📋 Next Steps:");
  console.log("1. Check if database is in Native Firestore mode (not Datastore mode)");
  console.log("2. Verify service account has 'Cloud Datastore User' role");
  console.log("3. Create a new database in Native mode if needed");
  console.log("4. Wait 2-3 minutes after creating database");
  process.exit(1);
}

