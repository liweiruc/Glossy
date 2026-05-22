import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch {
      setError('邮箱或密码不正确')
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
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--amber-600)', letterSpacing: '-0.5px' }}>
            Glossy
          </div>
          <div style={{ marginTop: 6, fontSize: 17, color: 'var(--text-secondary)' }}>
            登录继续
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
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />

          {error && (
            <div style={{ fontSize: 16, color: '#dc2626', textAlign: 'center' }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={btnStyle(loading)}
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 17, color: 'var(--text-secondary)' }}>
          还没有账号？{' '}
          <Link to="/register" style={{ color: 'var(--amber-600)', textDecoration: 'none' }}>
            注册
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
  fontSize: 18,
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
    fontSize: 18,
    fontWeight: 500,
    cursor: loading ? 'not-allowed' : 'pointer',
    marginTop: 4,
  }
}
