const admin = require("firebase-admin");
const path = require("path");

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
