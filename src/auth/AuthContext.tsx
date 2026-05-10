import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { firebaseAuth } from '../firebase'
import { syncUserDataFromFirestore, uploadLocalDataToFirestore } from '../db/firestore-sync'

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
    return onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
      if (firebaseUser) {
        const uid = firebaseUser.uid
        syncUserDataFromFirestore(uid)
          .then(() => uploadLocalDataToFirestore(uid))
          .catch(e => console.error('[Firestore sync]', e))
      }
    })
  }, [])

  // Re-sync when the tab becomes visible again or the network returns.
  // Visibility → pull (catch up on changes from other devices).
  // Online → pull + push (catch up AND flush any local writes).
  useEffect(() => {
    if (!user) return
    const uid = user.uid

    function pull() {
      syncUserDataFromFirestore(uid).catch(e => console.error('[Firestore sync]', e))
    }
    function pullAndPush() {
      syncUserDataFromFirestore(uid)
        .then(() => uploadLocalDataToFirestore(uid))
        .catch(e => console.error('[Firestore sync]', e))
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') pull()
    }

    window.addEventListener('online', pullAndPush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', pullAndPush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user])

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
