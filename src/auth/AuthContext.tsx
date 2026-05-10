import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { firebaseAuth } from '../firebase'
import {
  pushLocalOnlyItems,
  subscribeToUserData,
  verifyFirestoreAccess,
} from '../db/firestore-sync'

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

        // Subscribe FIRST — never miss a server-pushed update from another device.
        // Previously this ran AFTER uploadLocalDataToFirestore, which was destructive
        // (it overwrote newer remote state with stale local copies on every login).
        unsubscribeData = subscribeToUserData(uid)

        // Health check — surfaces rule deployment issues that are otherwise silent
        // because setDoc+persistentLocalCache resolves on local write.
        verifyFirestoreAccess(uid).catch(() => { /* already logged */ })

        // Then non-destructively push only items that are missing from the remote.
        pushLocalOnlyItems(uid).catch(e => console.error('[sync upload]', e))
      }
    })

    return () => {
      unsubAuth()
      if (unsubscribeData) unsubscribeData()
    }
  }, [])

  // When network returns, retry the local-only-items push for any items created offline.
  useEffect(() => {
    function handleOnline() {
      const uid = firebaseAuth.currentUser?.uid
      if (uid) {
        pushLocalOnlyItems(uid).catch(e => console.error('[sync upload]', e))
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
