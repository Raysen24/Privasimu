# Frontend-Backend Integration Guide

## ✅ What's Been Updated

### 1. API Client (`lib/api.js`)
- Created complete API client using axios
- Handles all backend communication
- Transforms data between backend and frontend formats
- Includes error handling

### 2. Regulation Store (`store/regulationStore.js`)
- Updated to use API instead of local storage
- All operations are now async
- Added loading and error states
- Form data still persists in localStorage (for draft saving)

### 3. Updated Pages
- **regulations.js**: Fetches from API on mount, handles async operations
- **add-regulation.js**: Creates regulations via API
- **edit-regulation.js**: Fetches and updates via API
- **view-regulation.js**: Fetches single regulation from API

## 🚀 How to Use

### 1. Start Backend Server
```bash
cd backend
npm start
```
Server should run on `http://localhost:4000`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
Frontend should run on `http://localhost:3001`

### 3. Test the Integration

1. **View Regulations**: Go to `/regulations` - should load from API
2. **Create Regulation**: Go to `/add-regulation` - creates via API
3. **Edit Regulation**: Click edit on any regulation - updates via API
4. **View Regulation**: Click view - fetches from API

## 🔧 Configuration

### API URL
The API URL is configured in `lib/api.js`:
```javascript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
```

To change it, either:
- Set environment variable: `NEXT_PUBLIC_API_URL=http://your-api-url/api`
- Or edit directly in `lib/api.js`

### User Authentication
Currently, the API uses headers for user identification:
- `x-user-id`: User ID
- `x-user-email`: User email

The API client automatically reads from `localStorage.getItem('user')` if available.

To set user info:
```javascript
localStorage.setItem('user', JSON.stringify({
  id: 'user-id',
  email: 'user@example.com'
}));
```

## 📊 Data Flow

### Creating a Regulation
1. User fills form → `formData` in store
2. User clicks "Save" or "Submit"
3. Store calls `api.regulations.create()`
4. API sends POST to `/api/regulations`
5. Backend saves to Firestore
6. Response transformed and added to store
7. UI updates

### Fetching Regulations
1. Component mounts → calls `fetchRegulations()`
2. Store calls `api.regulations.getAll()`
3. API sends GET to `/api/regulations`
4. Backend fetches from Firestore
5. Response transformed to frontend format
6. Store updates, UI re-renders

## 🐛 Troubleshooting

### Regulations Not Loading
1. Check backend is running: `curl http://localhost:4000/health`
2. Check browser console for errors
3. Verify API URL in `lib/api.js`
4. Check CORS settings in backend

### CORS Errors
If you see CORS errors, make sure backend has CORS enabled:
```javascript
// backend/src/app.js
app.use(cors());
```

### Network Errors
- Check backend server is running
- Verify API URL is correct
- Check firewall/network settings

### Data Format Issues
- Backend returns Firestore timestamps
- Frontend transforms them to readable dates
- Check `lib/api.js` transform functions

## 🔄 Next Steps

### 1. Add Authentication
Currently using simple headers. Consider:
- Firebase Auth integration
- JWT tokens
- Session management

### 2. Error Handling
- Add toast notifications
- Better error messages
- Retry logic for failed requests

### 3. Optimistic Updates
- Update UI immediately
- Rollback on error
- Better UX

### 4. Caching
- Cache regulations in store
- Refresh on focus
- Background sync

## 📝 API Methods Available

All methods are in `lib/api.js`:

```javascript
// Regulations
api.regulations.getAll(filters)
api.regulations.getById(id)
api.regulations.create(data)
api.regulations.update(id, updates)
api.regulations.delete(id)
api.regulations.submit(id)
api.regulations.review(id, action, feedback, reviewedBy)
api.regulations.approve(id, approvedBy)
api.regulations.publish(id, publishedBy)

// Users
api.users.getAll()
api.users.getById(id)
api.users.create(data)
api.users.update(id, updates)

// Statistics
api.statistics.getOverview()

// Deadlines
api.deadlines.getOverdue()
api.deadlines.getUpcoming(days)
```

## ✅ Integration Complete!

Your frontend is now fully integrated with the backend API. All data operations go through Firestore via your backend API.

