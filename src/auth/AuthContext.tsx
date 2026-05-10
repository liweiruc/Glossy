import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { firebaseAuth } from '../firebase'
import { uploadLocalDataToFirestore, subscribeToUserData } from '../db/firestore-sync'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeData: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      // Tear down any previous user's subscription
      if (unsubscribeData) {
        unsubscribeData()
        unsubscribeData = null
      }

      if (firebaseUser) {
        const uid = firebaseUser.uid
        // Push any local-only data first so the listener doesn't overwrite it with stale remote data
        try {
          await uploadLocalDataToFirestore(uid)
        } catch (e) {
          console.error('[Firestore sync]', e)
        }
        // Then subscribe — first snapshot acts as the initial pull, subsequent ones are real-time
        unsubscribeData = subscribeToUserData(uid)
      }
    })

    return () => {
      unsubAuth()
      if (unsubscribeData) unsubscribeData()
    }
  }, [])

  // When network returns, re-push any local-only writes that may have been queued during outage
  useEffect(() => {
    function handleOnline() {
      const uid = firebaseAuth.currentUser?.uid
      if (uid) {
        uploadLocalDataToFirestore(uid).catch(e => console.error('[Firestore sync]', e))
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(firebaseAuth, email, password)
  }

  async function register(email: string, password: string) {
    await createUserWithEmailAndPassword(firebaseAuth, email, password)
  }

  async function logout() {
    await signOut(firebaseAuth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
