import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code === 'auth/email-already-in-use') return '该邮箱已被注册'
  if (code === 'auth/weak-password') return '密码至少需要 6 位'
  if (code === 'auth/invalid-email') return '邮箱格式不正确'
  return '注册失败，请稍后重试'
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      await register(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(mapFirebaseError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100dvh',
      padding: '0 24px', background: 'var(--bg-primary)',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--amber-600)', letterSpacing: '-0.5px' }}>
            Glossy
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            创建账号
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
          <input
            id="password"
            name="password"
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={inputStyle}
          />
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            placeholder="确认密码"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            style={inputStyle}
          />

          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', textAlign: 'center' }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={btnStyle(loading)}
          >
            {loading ? '注册中…' : '注册'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          已有账号？{' '}
          <Link to="/login" style={{ color: 'var(--amber-600)', textDecoration: 'none' }}>
            登录
          </Link>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg-secondary)',
  border: '0.5px solid var(--border-tertiary)',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
}

function btnStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: loading ? 'var(--text-tertiary)' : 'var(--amber-600)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 0',
    fontSize: 14,
    fontWeight: 500,
    cursor: loading ? 'not-allowed' : 'pointer',
    marginTop: 4,
  }
}
