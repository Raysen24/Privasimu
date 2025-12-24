// Firebase v9 modular SDK placeholder
// Replace the config below with your project's values and set them in environment variables.
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAp5vHwnA-YU73pGIMrkJWFOSrxtjpyQuE",
  authDomain: "privasimu-8c3fd.firebaseapp.com",
  projectId: "privasimu-8c3fd",
  storageBucket: "privasimu-8c3fd.firebasestorage.app",
  messagingSenderId: "705874401756",
  appId: "1:705874401756:web:badf9359edf889c2ae1719",
  measurementId: "G-VP5TLSVG0D"
};

if (!getApps().length) {
  initializeApp(firebaseConfig)
}

export const auth = getAuth()
export const db = getFirestore()
