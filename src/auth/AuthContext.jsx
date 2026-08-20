import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'

/**
 * Firebase Authentication context (Google sign-in).
 *
 * Replaces the old Google Identity Services flow. `user.uid` is what scopes a
 * user's resumes in Firestore, so only their own documents are ever loaded.
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setUser(
        fbUser
          ? {
              uid: fbUser.uid,
              email: fbUser.email,
              name: fbUser.displayName,
              picture: fbUser.photoURL,
            }
          : null
      )
      setReady(true)
    })
  }, [])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      // Ignore the benign "user closed the popup" case.
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err?.message || 'Sign-in failed.')
      }
    }
  }, [])

  const signOut = useCallback(() => fbSignOut(auth), [])

  const value = {
    ready,
    user,
    isAuthenticated: Boolean(user),
    error,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
