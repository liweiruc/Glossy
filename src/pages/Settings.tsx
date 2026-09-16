import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useChineseDisplay, setChineseDisplay } from '../db/settings'
import type { ChineseDisplay } from '../db/settings'

const CHINESE_OPTIONS: { value: ChineseDisplay; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'tap', label: 'On tap' },
  { value: 'never', label: 'Never' },
]

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const chinese = useChineseDisplay()

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
          Account
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
            Sign out
          </button>
        </div>

        <div style={{
          fontSize: 14, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          fontWeight: 500, margin: '28px 0 12px',
        }}>
          Learning
        </div>

        <div style={{ fontSize: 17, color: 'var(--text-primary)' }}>Chinese translation</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
          English comes first everywhere. Tap 中文 on a sense when you are stuck.
        </div>

        <div style={{
          display: 'flex', gap: 3,
          background: 'var(--bg-secondary)', borderRadius: 10,
          padding: 3, marginTop: 12,
        }}>
          {CHINESE_OPTIONS.map(({ value, label }) => {
            const active = chinese === value
            return (
              <button
                key={value}
                onClick={() => setChineseDisplay(value)}
                style={{
                  flex: 1, padding: '11px 0',
                  border: 'none', borderRadius: 8,
                  background: active ? 'var(--amber-900)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontSize: 16, fontWeight: active ? 500 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
