import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Home from './pages/Home'
import LookupResult from './pages/LookupResult'
import TranslateResult from './pages/TranslateResult'
import ReviewBook from './pages/ReviewBook'
import ReviewSession from './pages/ReviewSession'
import History from './pages/History'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lookup/:lemma" element={<LookupResult />} />
          <Route path="/translate/:hash" element={<TranslateResult />} />
          <Route path="/review" element={<ReviewBook />} />
          <Route path="/review/session" element={<ReviewSession />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
