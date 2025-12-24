# How to Enable Firestore

## Quick Steps

### Step 1: Enable Firestore API

1. **Open the direct link** (easiest method):
   - Click here: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=privasimu-8c3fd
   - Click the **"Enable"** button
   - Wait 1-2 minutes for it to activate

   OR

2. **Via Google Cloud Console**:
   - Go to: https://console.cloud.google.com/
   - Select your project: **privasimu-8c3fd**
   - Navigate to: **APIs & Services** > **Library**
   - Search for: **"Cloud Firestore API"**
   - Click on it and press **"Enable"**

### Step 2: Create Firestore Database (if not already created)

1. **Go to Firebase Console**:
   - Visit: https://console.firebase.google.com/
   - Select your project: **privasimu-8c3fd**

2. **Create Firestore Database**:
   - Click on **"Firestore Database"** in the left sidebar
   - If you see "Create database" button, click it
   - Choose:
     - **Mode**: Start in production mode (or test mode for development)
     - **Location**: Choose closest to you (e.g., `us-central1`, `asia-southeast1`)
   - Click **"Create"**

3. **Set Security Rules** (if in production mode):
   - For development, you can use test mode rules temporarily:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.time < timestamp.date(2025, 12, 31);
       }
     }
   }
   ```
   - For production, set proper authentication-based rules

### Step 3: Verify Service Account Key

Make sure your `serviceAccountKey.json` file exists in the `backend` directory and has the correct permissions.

### Step 4: Test the Connection

After enabling Firestore, restart your server and test:

```bash
# Restart server
cd backend
npm start

# In another terminal, test
curl http://localhost:4000/api/regulations
```

## Alternative: Enable via Firebase Console

1. Go to: https://console.firebase.google.com/project/privasimu-8c3fd
2. Click on **"Firestore Database"** in the left menu
3. If you see "Create database", follow the wizard
4. This will automatically enable the Firestore API

## Troubleshooting

### If you get "API not enabled" error:
- Wait 2-3 minutes after enabling
- Make sure you're using the correct project ID
- Check that the service account has Firestore permissions

### If you get permission errors:
- Go to: https://console.cloud.google.com/iam-admin/iam?project=privasimu-8c3fd
- Find your service account
- Ensure it has "Cloud Datastore User" or "Firebase Admin" role

## Quick Check

After enabling, you can verify by checking the API status:
- https://console.cloud.google.com/apis/api/firestore.googleapis.com/overview?project=privasimu-8c3fd

You should see "API enabled" status.

