// Central Firebase initialization. Everything client-side (auth, Firestore,
// and the Gemini call via Firebase AI Logic) flows through these exports — there
// is no backend server anymore.
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAI, GoogleAIBackend } from 'firebase/ai'

const firebaseConfig = {
  apiKey: 'AIzaSyDy5ukZ1B9rxzrs8pMG1XBo5ouGq77u2k0',
  authDomain: 'resume-builder-501811.firebaseapp.com',
  projectId: 'resume-builder-501811',
  storageBucket: 'resume-builder-501811.firebasestorage.app',
  messagingSenderId: '1011943933953',
  appId: '1:1011943933953:web:f3aa9df8de756636cdd800',
  measurementId: 'G-PJ083S1289',
}

export const app = initializeApp(firebaseConfig)

// --- App Check ---------------------------------------------------------------
// Your Firebase project enforces App Check on the AI Logic / Firestore APIs, so
// requests must carry a valid App Check token or Google returns 401.
//
// Local dev: set a debug token. On first run App Check prints a debug token to
// the console — copy it into Firebase console → App Check → Apps → (your web
// app) → Manage debug tokens. Or pin one via VITE_APPCHECK_DEBUG_TOKEN.
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-undef
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true
}

// reCAPTCHA v3 site key from Firebase console → App Check → register this web
// app with the reCAPTCHA v3 provider. Required to initialize App Check (even in
// debug mode the provider must be constructed).
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
} else {
  console.warn(
    '[AppCheck] VITE_RECAPTCHA_SITE_KEY is not set — App Check is NOT initialized. ' +
      'If enforcement is on, AI/Firestore calls will fail with 401. ' +
      'Set the key (and register a debug token for localhost), or turn off App Check enforcement.'
  )
}

// Authentication (Google sign-in).
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Firestore — per-user resume storage.
export const db = getFirestore(app)

// Firebase AI Logic — calls Gemini from the browser with no exposed API key.
// Uses the Gemini Developer API backend (enable "Firebase AI Logic" in the
// Firebase console once for this project).
export const ai = getAI(app, { backend: new GoogleAIBackend() })
