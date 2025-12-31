const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let serviceAccount;

// 1) Use env var on Vercel (recommended)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON:", err);
    process.exit(1);
  }
} else {
  // 2) Fallback for local dev using file
  const serviceAccountPath = path.join(__dirname, "../../serviceAccountKey.json");
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error("\n❌ ERROR: Firebase service account key not found!");
    console.error("\n📋 To fix this, you have two options:\n");
    console.error("Option 1: Use environment variable (recommended for production)");
    console.error("  Set FIREBASE_SERVICE_ACCOUNT environment variable with your service account JSON\n");
    console.error("Option 2: Add service account key file");
    console.error(`  Place your service account key file at: ${serviceAccountPath}`);
    console.error("  You can download it from:");
    console.error("  https://console.firebase.google.com/project/privasimu-8c3fd/settings/serviceaccounts/adminsdk\n");
    console.error("  Then rename it to 'serviceAccountKey.json' and place it in the backend/ directory\n");
    process.exit(1);
  }
  
  serviceAccount = require(serviceAccountPath);
}

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
  process.exit(1);
}

const db = admin.firestore();
module.exports = { admin, db };
