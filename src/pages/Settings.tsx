import { useState, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, LogOut, User } from 'lucide-react'
import { db } from '../db'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'

const MODEL_KEYS = ['model_lookup', 'model_translate'] as const
type ModelKey = typeof MODEL_KEYS[number]

const DEFAULTS: Record<ModelKey, string> = {
  model_lookup: 'deepseek-chat',
  model_translate: 'deepseek-chat',
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [values, setValues] = useState<Record<ModelKey, string>>(DEFAULTS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db.settings.bulkGet([...MODEL_KEYS]).then(records => {
      setValues(prev => {
        const next = { ...prev }
        records.forEach((r, i) => { if (r) next[MODEL_KEYS[i]] = r.value })
        return next
      })
    })
  }, [])

  function set(key: ModelKey) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await db.settings.bulkPut(
        MODEL_KEYS.map(key => ({ key, value: values[key] }))
      )
      showToast('设置已保存')
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

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
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
          Settings
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 0' }}>

        {/* Account section */}
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          fontWeight: 500, marginBottom: 12,
        }}>
          账号
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 10,
          padding: '12px 14px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={16} color="var(--text-secondary)" />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {user?.email ?? ''}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0',
            }}
          >
            <LogOut size={14} />
            退出
          </button>
        </div>

        {/* AI Model section */}
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          fontWeight: 500, marginBottom: 12,
        }}>
          AI 模型
        </div>

        <FieldGroup
          label="Lookup Model"
          help="用于查词。deepseek-chat 速度快、成本低，推荐使用。"
        >
          <input
            type="text"
            value={values.model_lookup}
            onChange={set('model_lookup')}
            placeholder="deepseek-chat"
            style={inputStyle}
          />
        </FieldGroup>

        <FieldGroup
          label="Translate Model"
          help="用于翻译。deepseek-reasoner 效果更佳，但速度较慢。"
        >
          <input
            type="text"
            value={values.model_translate}
            onChange={set('model_translate')}
            placeholder="deepseek-chat"
            style={inputStyle}
          />
        </FieldGroup>
      </div>

      {/* SaveBar */}
      <div style={{
        borderTop: '0.5px solid var(--border-tertiary)',
        padding: '10px 18px 14px',
        flexShrink: 0,
        background: 'var(--bg-primary)',
      }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            background: saving ? 'var(--text-tertiary)' : 'var(--amber-600)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 0',
            fontSize: 14,
            fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.15s',
          }}
        >
          <Check size={14} />
          Save
        </button>
      </div>
    </div>
  )
}

function FieldGroup({
  label, help, children,
}: {
  label: string
  help: string
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 6 }}>
        <label htmlFor={id} style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
          {label}
        </label>
      </div>
      <div id={id}>{children}</div>
      <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {help}
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--bg-secondary)',
  border: '0.5px solid var(--border-tertiary)',
  borderRadius: 8,
  padding: '9px 11px',
  fontSize: 13,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'ui-monospace, Consolas, monospace',
}
