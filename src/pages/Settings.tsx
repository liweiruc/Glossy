import { useState, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Info, Eye, EyeOff, ShieldCheck, Check, ExternalLink,
} from 'lucide-react'
import { db } from '../db'
import { useToast } from '../components/Toast'

const KEYS = ['api_base_url', 'api_key', 'model_lookup', 'model_translate'] as const
type SettingKey = typeof KEYS[number]

const DEFAULTS: Record<SettingKey, string> = {
  api_base_url: 'https://api.deepseek.com/v1',
  api_key: '',
  model_lookup: 'deepseek-chat',
  model_translate: 'deepseek-chat',
}

export default function Settings() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [values, setValues] = useState<Record<SettingKey, string>>(DEFAULTS)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db.settings.bulkGet([...KEYS]).then(records => {
      setValues(prev => {
        const next = { ...prev }
        records.forEach((r, i) => { if (r) next[KEYS[i]] = r.value })
        return next
      })
    })
  }, [])

  function set(key: SettingKey) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await db.settings.bulkPut(
        KEYS.map(key => ({ key, value: values[key] }))
      )
      showToast('设置已保存')
      navigate(-1)
    } finally {
      setSaving(false)
    }
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
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          fontWeight: 500, marginBottom: 12,
        }}>
          AI model
        </div>

        {/* GuideCard */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 10,
          padding: '12px 14px', marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Info size={14} color="var(--amber-600)" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
              How to get an API key
            </span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>Sign up at the provider's site</li>
            <li>Top up a small balance (a few dollars goes far)</li>
            <li>Create an API key in their dashboard</li>
            <li>Paste it below</li>
          </ol>
          <div style={{ marginTop: 10 }}>
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--amber-600)', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
            >
              DeepSeek setup guide <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Base URL */}
        <FieldGroup
          label="Base URL"
          required
          help="The endpoint for an OpenAI-compatible API. Default is DeepSeek."
        >
          <input
            type="url"
            value={values.api_base_url}
            onChange={set('api_base_url')}
            style={inputStyle({ mono: true })}
          />
        </FieldGroup>

        {/* API Key */}
        <FieldGroup
          label="API Key"
          required
          help="Stored only on this device. Never sent anywhere except to the API."
        >
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={values.api_key}
              onChange={set('api_key')}
              autoComplete="off"
              placeholder="sk-..."
              style={{ ...inputStyle({}), paddingRight: 38 }}
            />
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              {showKey
                ? <EyeOff size={16} color="var(--text-tertiary)" />
                : <Eye size={16} color="var(--text-tertiary)" />}
            </button>
          </div>
        </FieldGroup>

        {/* Lookup Model */}
        <FieldGroup
          label="Lookup Model"
          help="Used for word lookups. A faster, cheaper model is fine here."
        >
          <input
            type="text"
            value={values.model_lookup}
            onChange={set('model_lookup')}
            placeholder="deepseek-chat"
            style={inputStyle({ mono: true })}
          />
        </FieldGroup>

        {/* Translate Model */}
        <FieldGroup
          label="Translate Model"
          help="Used for sentence translation. A stronger model gives more natural results."
        >
          <input
            type="text"
            value={values.model_translate}
            onChange={set('model_translate')}
            placeholder="deepseek-chat"
            style={inputStyle({ mono: true })}
          />
        </FieldGroup>

        {/* SecurityNote */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          background: 'var(--bg-secondary)', borderRadius: 8,
          padding: '10px 12px', marginTop: 14, marginBottom: 24,
        }}>
          <ShieldCheck size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Your API key lives in this browser only. Don't enter it on a shared or public computer. Clearing site data will erase it.
          </span>
        </div>
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
  label, required, help, children,
}: {
  label: string
  required?: boolean
  help: string
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label htmlFor={id} style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
          {label}
        </label>
        {required && <span style={{ fontSize: 12, color: '#dc2626' }}>*</span>}
      </div>
      <div id={id}>{children}</div>
      <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        {help}
      </p>
    </div>
  )
}

function inputStyle({ mono = false }: { mono?: boolean }): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-secondary)',
    border: '0.5px solid var(--border-tertiary)',
    borderRadius: 8,
    padding: '9px 11px',
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: mono ? 'ui-monospace, Consolas, monospace' : 'inherit',
  }
}
