# Fix Service Account Permissions

## The Problem

You're seeing an error in the logs:
```
methodName: "SetIamPolicy"
severity: "ERROR"
```

This means your service account doesn't have the right permissions to access Firestore.

## Solution: Add Required Roles

### Step 1: Go to IAM & Admin

1. **Open this link**: https://console.cloud.google.com/iam-admin/iam?project=privasimu-8c3fd

2. **Find your service account**:
   - Look for an email that ends with `@privasimu-8c3fd.iam.gserviceaccount.com`
   - It might be named something like:
     - `firebase-adminsdk-xxxxx@privasimu-8c3fd.iam.gserviceaccount.com`
     - Or check your `serviceAccountKey.json` file for `client_email`

### Step 2: Add Required Roles

1. **Click the pencil icon** (Edit) next to your service account

2. **Click "+ ADD ANOTHER ROLE"**

3. **Add these roles** (one at a time):
   - ✅ **"Cloud Datastore User"** (this is the main one for Firestore)
   - ✅ **"Firebase Admin SDK Administrator Service Agent"**
   - ✅ **"Firebase Admin"** (if available)

4. **Click "SAVE"**

### Step 3: Alternative - Grant via Firebase Console

1. Go to: https://console.firebase.google.com/project/privasimu-8c3fd/settings/serviceaccounts/adminsdk

2. Look for your service account

3. Make sure it has "Firebase Admin" permissions

## Quick Check: What Roles Are Needed

Your service account needs at least one of these:
- ✅ **Cloud Datastore User** (minimum required)
- ✅ **Firebase Admin SDK Administrator Service Agent** (recommended)
- ✅ **Firebase Admin** (full access)

## After Adding Permissions

1. **Wait 1-2 minutes** for permissions to propagate

2. **Test the connection**:
   ```bash
   cd backend
   node verify-firestore.js
   ```

3. **If still not working**, try:
   - Restart your server
   - Wait another minute
   - Check if the service account email in `serviceAccountKey.json` matches the one in IAM

## Verify Service Account

To find your service account email:

```bash
cd backend
cat serviceAccountKey.json | grep client_email
```

Then check that email in IAM: https://console.cloud.google.com/iam-admin/iam?project=privasimu-8c3fd

