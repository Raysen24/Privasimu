# Firestore Database Setup Guide

## What to Create in Firestore

When you create your Firestore database, here's what you need to configure:

### Step 1: Create the Database

1. **Go to Firebase Console**: https://console.firebase.google.com/project/privasimu-8c3fd
2. Click **"Firestore Database"** in the left sidebar
3. Click **"Create database"** button

### Step 2: Choose Database Mode

**For Development/Testing:**
- Select **"Start in test mode"**
- This allows read/write access for 30 days (good for testing)
- Click **"Next"**

**For Production:**
- Select **"Start in production mode"**
- You'll need to set up security rules (see below)
- Click **"Next"**

### Step 3: Choose Location

Select a location closest to your users:
- **Recommended**: `us-central1` (Iowa, USA) - Good default
- **For Asia**: `asia-southeast1` (Singapore)
- **For Europe**: `europe-west1` (Belgium)

**Important**: Once set, this cannot be changed!

Click **"Enable"** to create the database.

### Step 4: Security Rules (If in Production Mode)

If you chose production mode, you'll need to set security rules. For now, you can use these basic rules for development:

**Go to**: Firestore Database → Rules tab

**Development Rules** (temporary - for testing only):
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

**Production Rules** (for later, when you add authentication):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Regulations - authenticated users can read, creators can write
    match /regulations/{regulationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        resource.data.createdBy == request.auth.uid;
    }
    
    // Access logs - only admins
    match /access_logs/{logId} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Deadline reminders - authenticated users
    match /deadline_reminders/{reminderId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **"Publish"** to save the rules.

## Collections That Will Be Created Automatically

Your backend will automatically create these collections when you use the API:

### 1. **regulations** - Main regulation data
   - Created when: You POST to `/api/regulations`
   - Structure: See regulation schema below

### 2. **users** - User accounts
   - Created when: You POST to `/api/users`
   - Structure: See user schema below

### 3. **access_logs** - API access logging
   - Created automatically by middleware
   - Logs every API request

### 4. **deadline_reminders** - Deadline alerts
   - Created by scheduled jobs
   - Tracks upcoming and overdue deadlines

### 5. **_test** - Temporary test collection
   - Used by verification script
   - Can be ignored

## Data Schemas

### Regulation Document Structure
```javascript
{
  title: "Employee Code of Conduct",
  category: "HR",
  code: "HR-001",
  description: "Rich text description",
  notes: "Author notes",
  deadline: Timestamp,
  effectiveDate: Timestamp,
  version: "v1.0",
  status: "Draft" | "Pending Review" | "Needs Revision" | "Pending Approval" | "Pending Publish" | "Published",
  ref: "A1234", // Auto-generated reference number
  workflow: {
    currentStage: "draft",
    stages: {
      draft: { status: "active", timestamp: Timestamp },
      review: { status: "pending", timestamp: null },
      approval: { status: "pending", timestamp: null },
      publish: { status: "pending", timestamp: null }
    }
  },
  createdBy: "user-id",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  submittedAt: Timestamp | null,
  reviewedAt: Timestamp | null,
  approvedAt: Timestamp | null,
  publishedAt: Timestamp | null,
  feedback: "Review feedback",
  attachments: []
}
```

### User Document Structure
```javascript
{
  email: "user@example.com",
  name: "User Name",
  role: "employee" | "reviewer" | "approver" | "admin",
  department: "IT",
  password: "hashed-password", // Should be hashed in production
  createdAt: Timestamp,
  updatedAt: Timestamp,
  isActive: true,
  lastLogin: Timestamp | null
}
```

### Access Log Document Structure
```javascript
{
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: "/api/regulations",
  url: "/api/regulations?status=Draft",
  query: {},
  statusCode: 200,
  duration: 45, // milliseconds
  ip: "127.0.0.1",
  userAgent: "Mozilla/5.0...",
  userId: "user-id" | null,
  userEmail: "user@example.com" | null,
  timestamp: Timestamp,
  responseSize: 1024
}
```

### Deadline Reminder Document Structure
```javascript
{
  regulationId: "regulation-id",
  regulationTitle: "Regulation Title",
  deadline: Timestamp,
  daysUntilDeadline: 3,
  daysOverdue: 0,
  status: "Draft",
  createdBy: "user-id",
  type: "upcoming" | "overdue",
  priority: "high" | "medium",
  createdAt: Timestamp,
  notified: false,
  notifiedAt: Timestamp | null
}
```

## Indexes (Optional - Firestore will prompt if needed)

Firestore may ask you to create indexes for complex queries. If you see an error about missing indexes:

1. Click the link in the error message
2. Click "Create Index" in the Firebase Console
3. Wait for the index to build (usually 1-2 minutes)

Common indexes you might need:
- `regulations`: `status` + `createdAt`
- `regulations`: `category` + `createdAt`
- `regulations`: `createdBy` + `createdAt`

## Verification Checklist

After setup, verify:

- [ ] Database created in Firebase Console
- [ ] Location selected (cannot be changed later)
- [ ] Security rules set (test mode or production)
- [ ] Service account key file exists (`serviceAccountKey.json`)
- [ ] Run verification script: `node verify-firestore.js`
- [ ] Test API endpoint: `curl http://localhost:4000/api/regulations`

## Quick Setup Summary

**Minimum Setup (Test Mode):**
1. Create database → Test mode
2. Choose location
3. Enable
4. Done! (Rules auto-configured for 30 days)

**Production Setup:**
1. Create database → Production mode
2. Choose location
3. Enable
4. Set security rules (use production rules above)
5. Configure authentication (later)

That's it! Your backend will create all collections automatically when you start using the API.

