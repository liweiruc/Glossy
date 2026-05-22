import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)' }}>
      {/* AppBar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center',
        padding: '0 18px', borderBottom: '0.5px solid var(--border-tertiary)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: -4 }}
        >
          <ChevronLeft size={20} color="var(--text-secondary)" />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 18, color: 'var(--text-secondary)', fontWeight: 400 }}>
          Settings
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px' }}>
        <div style={{
          fontSize: 14, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          fontWeight: 500, marginBottom: 12,
        }}>
          账号
        </div>

        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 10,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={16} color="var(--text-secondary)" />
            <span style={{ fontSize: 17, color: 'var(--text-primary)' }}>
              {user?.email ?? ''}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 17, color: 'var(--text-secondary)', padding: '4px 0',
            }}
          >
            <LogOut size={14} />
            退出
          </button>
        </div>
      </div>
    </div>
  )
}
