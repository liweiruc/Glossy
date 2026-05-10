import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Home from './pages/Home'
import LookupResult from './pages/LookupResult'
import TranslateResult from './pages/TranslateResult'
import ReviewBook from './pages/ReviewBook'
import ReviewSession from './pages/ReviewSession'
import History from './pages/History'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/lookup/:lemma" element={<RequireAuth><LookupResult /></RequireAuth>} />
      <Route path="/translate/:hash" element={<RequireAuth><TranslateResult /></RequireAuth>} />
      <Route path="/review" element={<RequireAuth><ReviewBook /></RequireAuth>} />
      <Route path="/review/session" element={<RequireAuth><ReviewSession /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
