# Fixing NOT_FOUND Error

## Current Status ✅
- ✅ Firestore API is enabled (green checkmark)
- ✅ Database exists in Firebase Console
- ❌ Getting `NOT_FOUND` error when connecting

## The Problem

The `NOT_FOUND` error usually means your database is in **Datastore mode** instead of **Native Firestore mode**.

Firebase has two database types:
- **Cloud Firestore (Native mode)** ✅ - What we need
- **Cloud Datastore** ❌ - Won't work with our code

## How to Check

1. Go to: https://console.firebase.google.com/project/privasimu-8c3fd/firestore

2. Look at the **top of the page**:
   - Does it say **"Cloud Firestore"**? ✅ Good!
   - Does it say **"Cloud Datastore"**? ❌ Problem!

3. Also check the **URL**:
   - If URL contains `/datastore/` → Datastore mode ❌
   - If URL contains `/firestore/` → Firestore mode ✅

## Solution: Create a New Database in Native Mode

Since your current database might be in Datastore mode, create a NEW one in Native Firestore mode:

### Step 1: Create New Database

1. Go to: https://console.firebase.google.com/project/privasimu-8c3fd/firestore

2. Look for **"Add database"** button (or a "+" icon)

3. Click it

4. You'll see options:
   - **"Start in production mode"** or **"Start in test mode"**
   - Choose **"Start in test mode"** (easier for development)

5. **IMPORTANT**: Make sure it says:
   - ✅ **"Cloud Firestore"** 
   - ❌ NOT "Cloud Datastore"

6. Choose location: `asia-east1` (or your preferred region)

7. Click **"Enable"** or **"Create"**

### Step 2: Wait and Test

1. **Wait 2-3 minutes** for the database to be fully created

2. **Test the connection**:
   ```bash
   cd backend
   node verify-firestore.js
   ```

3. You should see:
   ```
   ✅ Write successful!
   ✅ Read successful!
   ✅ All Firestore operations working correctly!
   ```

## Alternative: Check Service Account Permissions

If creating a new database doesn't work, check permissions:

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=privasimu-8c3fd

2. Find your service account (looks like: `xxxxx@privasimu-8c3fd.iam.gserviceaccount.com`)

3. Check if it has these roles:
   - ✅ "Cloud Datastore User"
   - ✅ "Firebase Admin SDK Administrator Service Agent"

4. If missing, click "Edit" and add the role

## Quick Visual Check

In Firebase Console, you should see:
- **Tabs**: "Data", "Indexes", "Disaster Recovery", "Usage" ✅
- **Button**: "+ Add collection" ✅
- **Text**: "Your database is ready to go" ✅

If you see "Datastore" anywhere in the interface, that's the problem!

## After Fixing

Once you have a Native Firestore database:

1. Restart your server:
   ```bash
   npm start
   ```

2. Test the API:
   ```bash
   curl http://localhost:4000/api/regulations
   ```

3. You should get: `{"success":true,"data":[]}` instead of an error!

