# Privasimu Server (Express)

This is a minimal Express scaffold.

## Setup
1. Install dependencies:
   ```
   cd server
   npm install
   ```
2. To integrate with Firestore using the Admin SDK:
   - Create a Firebase service account JSON and set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json`.
   - Or initialize `firebase-admin` with the service account manually in `index.js`.
3. Run:
   ```
   npm start
   ```
