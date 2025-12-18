# Quick Firestore Setup - Step by Step

## 🎯 What You Need to Do

### 1. Enable Firestore API
✅ **Already done or in progress** - The API enable page should be open

### 2. Create Firestore Database

**Go to**: https://console.firebase.google.com/project/privasimu-8c3fd/firestore

**Click**: "Create database" button

**Choose**:
- **Mode**: 
  - ✅ **"Start in test mode"** (Recommended for now - allows all access for 30 days)
  - OR "Start in production mode" (requires security rules)
  
- **Location**: 
  - Choose closest to you:
    - `us-central1` (Iowa, USA) - Good default
    - `asia-southeast1` (Singapore) - For Asia
    - `europe-west1` (Belgium) - For Europe
  - ⚠️ **Warning**: Location cannot be changed later!

**Click**: "Enable" or "Create"

### 3. That's It!

The database is now ready. Your backend will automatically create all the collections it needs when you start using the API.

## 📦 Collections That Will Be Created Automatically

Your backend creates these when you use the API:

1. **`regulations`** - When you create regulations
2. **`users`** - When you create users  
3. **`access_logs`** - Automatically (logs all API calls)
4. **`deadline_reminders`** - Automatically (from scheduled jobs)

**You don't need to create these manually!** They'll appear automatically.

## ✅ Verify It Works

After creating the database, wait 1-2 minutes, then run:

```bash
cd backend
node verify-firestore.js
```

If you see ✅ messages, you're all set!

## 🔒 Security Rules (Only if you chose Production Mode)

If you chose "Start in production mode", you need to set rules:

1. Go to: Firestore Database → **Rules** tab
2. Paste this (temporary for development):

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

3. Click **"Publish"**

## 🎬 Next Steps

Once database is created:

1. **Restart your server**:
   ```bash
   cd backend
   npm start
   ```

2. **Test the API**:
   ```bash
   curl http://localhost:4000/api/regulations
   ```

3. **Create your first regulation**:
   ```bash
   curl -X POST http://localhost:4000/api/regulations \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Regulation",
       "category": "HR",
       "deadline": "2024-12-31"
     }'
   ```

## ❓ Common Questions

**Q: Do I need to create collections manually?**  
A: No! They're created automatically when you use the API.

**Q: What location should I choose?**  
A: Choose the closest to your users. `us-central1` is a safe default.

**Q: Test mode vs Production mode?**  
A: Use **test mode** for development. It allows all access for 30 days. Switch to production later with proper rules.

**Q: Can I change the location later?**  
A: No, location is permanent. Choose carefully!

**Q: How do I know it's working?**  
A: Run `node verify-firestore.js` - it will test everything.

---

**That's all you need!** Just create the database with test mode, and you're ready to go! 🚀

