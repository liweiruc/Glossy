import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, Clock } from 'lucide-react'

const TABS = [
  { path: '/', label: 'Home', Icon: Home },
  { path: '/review', label: 'Review', Icon: BookOpen },
  { path: '/history', label: 'History', Icon: Clock },
] as const

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 430,
      borderTop: '0.5px solid var(--border-tertiary)',
      background: 'var(--bg-primary)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(({ path, label, Icon }) => {
        const active = isActive(path)
        const color = active ? 'var(--amber-600)' : 'var(--text-tertiary)'
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '8px 0 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Icon size={20} color={color} />
            <span style={{ fontSize: 13, color, lineHeight: 1 }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
