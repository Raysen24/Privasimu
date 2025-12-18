# API Testing Guide

This guide will help you test if the API is working correctly.

## Prerequisites

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Ensure Firebase is Configured**
   - Make sure `serviceAccountKey.json` exists in the backend directory
   - The Firebase project should be properly configured

## Starting the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server should start on port 4000 by default. You should see:
```
Server running on port 4000
Starting scheduled jobs...
Scheduled jobs started
```

## Testing Methods

### Method 1: Using the Test Script (Node.js)

Run the automated test script:
```bash
node test-api.js
```

This will test multiple endpoints automatically.

### Method 2: Using the Bash Script

Make the script executable and run it:
```bash
chmod +x test-api.sh
./test-api.sh
```

**Note:** This requires `jq` to be installed for JSON formatting:
- macOS: `brew install jq`
- Linux: `sudo apt-get install jq` or `sudo yum install jq`

### Method 3: Manual Testing with cURL

#### 1. Health Check
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-..."}
```

#### 2. Get All Regulations
```bash
curl http://localhost:4000/api/regulations
```

#### 3. Create a User
```bash
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "role": "employee",
    "department": "IT"
  }'
```

#### 4. Create a Regulation
```bash
curl -X POST http://localhost:4000/api/regulations \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{
    "title": "Test Regulation",
    "category": "HR",
    "code": "TEST-001",
    "description": "Test description",
    "deadline": "2024-12-31",
    "createdBy": "YOUR_USER_ID"
  }'
```

#### 5. Submit Regulation for Review
```bash
curl -X POST http://localhost:4000/api/regulations/REGULATION_ID/submit
```

#### 6. Get Statistics
```bash
curl http://localhost:4000/api/statistics/overview
```

#### 7. Check Deadlines
```bash
curl http://localhost:4000/api/deadlines/overdue
curl http://localhost:4000/api/deadlines/upcoming?days=7
```

### Method 4: Using Postman or Insomnia

1. **Import Collection** (if available) or create requests manually
2. **Base URL**: `http://localhost:4000/api`
3. **Headers**: 
   - `Content-Type: application/json`
   - `x-user-id: <user-id>` (for user tracking)

#### Example Requests:

**GET Regulations**
- Method: GET
- URL: `http://localhost:4000/api/regulations`

**POST Create Regulation**
- Method: POST
- URL: `http://localhost:4000/api/regulations`
- Headers: `Content-Type: application/json`
- Body (JSON):
```json
{
  "title": "Employee Code of Conduct",
  "category": "HR",
  "code": "HR-001",
  "description": "Code of conduct for all employees",
  "deadline": "2024-12-31",
  "effectiveDate": "2025-01-01"
}
```

**POST Submit for Review**
- Method: POST
- URL: `http://localhost:4000/api/regulations/{regulationId}/submit`

**POST Review Regulation**
- Method: POST
- URL: `http://localhost:4000/api/regulations/{regulationId}/review`
- Body (JSON):
```json
{
  "action": "approve",
  "feedback": "Looks good!",
  "reviewedBy": "reviewer-id"
}
```

### Method 5: Using Browser

For GET requests, you can simply open in your browser:
- `http://localhost:4000/health`
- `http://localhost:4000/api/regulations`
- `http://localhost:4000/api/statistics/overview`

## Expected Responses

### Success Response Format
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message"
}
```

## Common Issues

### 1. Port Already in Use
If port 4000 is already in use:
```bash
# Find and kill the process
lsof -ti:4000 | xargs kill -9

# Or set a different port
PORT=4001 npm start
```

### 2. Firebase Connection Error
- Check that `serviceAccountKey.json` exists
- Verify the Firebase project is active
- Check Firebase Admin SDK credentials

### 3. CORS Errors
- The server has CORS enabled for all origins
- If issues persist, check the CORS configuration in `app.js`

### 4. Module Not Found
- Run `npm install` to install all dependencies
- Make sure you're in the `backend` directory

## Verifying Access Logging

After making requests, check that access logs are being created:
1. Check your Firebase Firestore console
2. Look for the `access_logs` collection
3. You should see entries for each API request

## Verifying Scheduled Jobs

The deadline reminder jobs run:
- Daily at 9 AM
- Every 6 hours

To manually trigger a deadline check:
```bash
curl -X POST http://localhost:4000/api/deadlines/check
```

## Next Steps

Once the API is working:
1. Integrate with your frontend
2. Set up proper authentication (currently using headers)
3. Configure email notifications for deadline reminders (optional)
4. Set up monitoring and alerts

