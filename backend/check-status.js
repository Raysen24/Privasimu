/**
 * Quick status checker for Firestore
 * Run: node check-status.js
 */

const { db } = require("./src/firebase");

async function checkStatus() {
  console.log("🔍 Checking Firestore status...\n");

  try {
    // Try a simple read operation
    const testRef = db.collection("_status_check").doc("test");
    await testRef.get();
    
    console.log("✅ SUCCESS! Firestore is enabled and working!\n");
    console.log("You can now:");
    console.log("  1. Restart your server: npm start");
    console.log("  2. Test the API: curl http://localhost:4000/api/regulations");
    console.log("  3. Run full verification: node verify-firestore.js\n");
    return true;
  } catch (error) {
    console.log("❌ Firestore is not ready yet.\n");
    console.log("Error:", error.message);
    console.log("\n📋 Checklist:");
    console.log("  [ ] 1. Enable Firestore API:");
    console.log("      https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=privasimu-8c3fd");
    console.log("  [ ] 2. Create Firestore Database:");
    console.log("      https://console.firebase.google.com/project/privasimu-8c3fd/firestore");
    console.log("  [ ] 3. Wait 2-3 minutes after enabling\n");
    console.log("💡 After completing the checklist, run this script again.\n");
    return false;
  }
}

checkStatus()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error.message);
    process.exit(1);
  });

