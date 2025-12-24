# Privasimu Frontend (Next.js + Tailwind + React Query + Firebase placeholders)

## Setup
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Add Firebase config (in `.env.local`):
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
3. Run dev:
   ```bash
   npm run dev
   ```

This scaffold includes:
- Next.js pages (index, regulations)
- Tailwind CSS configuration
- React Query setup in `_app.js`
- `lib/firebase.js` (placeholder, replace with your Firebase project config)
