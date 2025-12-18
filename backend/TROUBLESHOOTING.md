# Firestore Troubleshooting

## Current Issue: NOT_FOUND Error

You're seeing: `Error: 5 NOT_FOUND`

This usually means one of these:

### 1. Database Mode Issue (Most Common)

Firebase has two database modes:
- **Native Mode (Firestore)** ✅ - What we need
- **Datastore Mode** ❌ - Won't work with our code

**Check and Fix:**

1. Go to: https://console.firebase.google.com/project/privasimu-8c3fd/firestore
2. Look at the top - do you see tabs for "Data", "Indexes", etc.?
3. If you see "Datastore" anywhere, that's the problem

**Solution:**
- You need to create a **NEW** database in **Native mode**
- Go to: https://console.firebase.google.com/project/privasimu-8c3fd/firestore
- Click "Add database" (or the "+" button)
- Choose **"Start in production mode"** or **"Start in test mode"**
- Make sure it says **"Cloud Firestore"** not "Cloud Datastore"
- Location: `asia-east1` (to match your existing one, or choose a new one)

### 2. Firestore API Not Enabled

Even if the database exists, the API might not be enabled.

**Check:**
1. Go to: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=privasimu-8c3fd
2. Look for "API enabled" status
3. If you see "Enable API", click it

### 3. Service Account Permissions

The service account might not have the right permissions.

**Check:**
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=privasimu-8c3fd
2. Find your service account (usually ends with `@privasimu-8c3fd.iam.gserviceaccount.com`)
3. Make sure it has one of these roles:
   - "Firebase Admin SDK Administrator Service Agent"
   - "Cloud Datastore User"
   - "Firebase Admin"

**Fix:**
- Click "Edit" on the service account
- Add role: "Cloud Datastore User" or "Firebase Admin"

### 4. Database Location Mismatch

If your database is in a different location than expected.

**Check:**
- Your database location: `asia-east1` (from the screenshot)
- Make sure your service account has access to that region

## Quick Diagnostic Steps

1. **Verify API is enabled:**
   ```bash
   # Check this URL shows "API enabled"
   open "https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=privasimu-8c3fd"
   ```

2. **Check database mode:**
   - Go to Firestore console
   - Make sure it says "Cloud Firestore" not "Cloud Datastore"

3. **Verify service account:**
   - Check that `serviceAccountKey.json` exists
   - Check IAM permissions

4. **Try creating a new database:**
   - Sometimes it's easier to create a fresh one in Native mode
   - Delete the old one if it's in Datastore mode

## Most Likely Solution

Based on the NOT_FOUND error, the database is probably in **Datastore mode** instead of **Native Firestore mode**.

**Fix:**
1. Create a NEW database in Native mode
2. Make sure it says "Cloud Firestore" 
3. Choose test mode for development
4. Wait 2-3 minutes
5. Run verification again

