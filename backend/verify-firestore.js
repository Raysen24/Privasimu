/**
 * Script to verify Firestore is enabled and working
 * Run: node verify-firestore.js
 */

const { db } = require("./src/firebase");

async function verifyFirestore() {
  console.log("Verifying Firestore connection...\n");

  try {
    // Test 1: Try to write a test document
    console.log("1. Testing write operation...");
    const testRef = db.collection("_test").doc("connection-test");
    await testRef.set({
      message: "Firestore connection test",
      timestamp: new Date(),
    });
    console.log("   ✅ Write successful!");

    // Test 2: Try to read the document
    console.log("2. Testing read operation...");
    const doc = await testRef.get();
    if (doc.exists) {
      console.log("   ✅ Read successful!");
      console.log("   Data:", doc.data());
    } else {
      console.log("   ❌ Document not found");
    }

    // Test 3: Try to query
    console.log("3. Testing query operation...");
    const snapshot = await db.collection("_test").limit(1).get();
    console.log("   ✅ Query successful!");
    console.log("   Documents found:", snapshot.size);

    // Cleanup: Delete test document
    console.log("4. Cleaning up test document...");
    await testRef.delete();
    console.log("   ✅ Cleanup complete!");

    console.log("\n✅ All Firestore operations working correctly!");
    console.log("Your Firestore is properly enabled and configured.\n");
    return true;
  } catch (error) {
    console.error("\n❌ Firestore verification failed!");
    console.error("Error:", error.message);
    console.error("\nPossible issues:");
    console.error("1. Firestore API not enabled - Enable it at:");
    console.error("   https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=privasimu-8c3fd");
    console.error("2. Database not created - Create it at:");
    console.error("   https://console.firebase.google.com/project/privasimu-8c3fd/firestore");
    console.error("3. Service account permissions - Check IAM settings");
    console.error("4. Wait 2-3 minutes after enabling the API\n");
    return false;
  }
}

// Run verification
verifyFirestore()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });

