import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, LogOut, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  DEFAULT_REVIEW_SETTINGS, REVIEW_LIMITS, setChineseDisplay, setReviewSettings, useChineseDisplay,
  useReviewSettings,
} from '../db/settings'
import type { ChineseDisplay, ReviewSettings } from '../db/settings'
import { parseSteps } from '../algorithms/fsrs'
import type { NewCardOrder } from '../algorithms/queue'
import { useToast } from '../components/Toast'

/** The commit this build came from (vite.config.ts). */
declare const __BUILD_ID__: string

const CHINESE_OPTIONS: { value: ChineseDisplay; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'tap', label: 'On tap' },
  { value: 'never', label: 'Never' },
]

const ORDER_OPTIONS: { value: NewCardOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

const INPUT: CSSProperties = {
  height: 40, boxSizing: 'border-box', border: 'none', borderRadius: 10, outline: 'none',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontSize: 18, fontFamily: 'inherit',
}

function sameSettings(a: ReviewSettings, b: ReviewSettings): boolean {
  return (Object.keys(b) as (keyof ReviewSettings)[]).every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]))
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const chinese = useChineseDisplay()
  const review = useReviewSettings()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function save(patch: Partial<ReviewSettings>) {
    setReviewSettings(patch).catch(e => {
      console.error('[settings]', e)
      showToast("Couldn't save that — try again")
    })
  }

  return (
    <div className="screen" style={{ background: 'var(--bg-primary)' }}>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 18px calc(24px + env(safe-area-inset-bottom))' }}>
        <SectionTitle>Account</SectionTitle>

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

        <SectionTitle top={28}>Review</SectionTitle>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: -6 }}>
          Saved to your account, so every device studies the same way.
        </div>

        {review && (
          <>
            <NumberField
              label="New cards per day"
              hint="One card per meaning. 0 pauses new cards."
              value={review.newPerDay}
              limits={REVIEW_LIMITS.newPerDay}
              onSave={newPerDay => save({ newPerDay })}
            />
            <NumberField
              label="Reviews per day"
              hint="The cards closest to slipping come first; the rest wait for tomorrow."
              value={review.reviewsPerDay}
              limits={REVIEW_LIMITS.reviewsPerDay}
              onSave={reviewsPerDay => save({ reviewsPerDay })}
            />
            <RetentionField value={review.retention} onSave={retention => save({ retention })} />
            <NumberField
              label="Maximum interval"
              hint="The longest a card can go between reviews, in days."
              value={review.maxIntervalDays}
              limits={REVIEW_LIMITS.maxIntervalDays}
              onSave={maxIntervalDays => save({ maxIntervalDays })}
            />
            <StepsField
              label="Learning steps"
              hint="When a new card comes back on the day you learn it: m minutes, h hours, d days. Leave it empty to go straight to days."
              value={review.learningSteps}
              onSave={learningSteps => save({ learningSteps })}
            />
            <StepsField
              label="Relearning steps"
              hint="The same, for a card you forgot."
              value={review.relearningSteps}
              onSave={relearningSteps => save({ relearningSteps })}
            />
            <Field label="New cards" hint="Newest first brings the word you just looked up to the front.">
              <Segmented value={review.newOrder} options={ORDER_OPTIONS} onChange={newOrder => save({ newOrder })} />
            </Field>
            <Field
              label="Pronounce words"
              hint="Say the word on a new card, and when the answer is revealed."
              aside={<Switch on={review.autoSpeak} label="Pronounce words" onChange={autoSpeak => save({ autoSpeak })} />}
            />
            {!sameSettings(review, DEFAULT_REVIEW_SETTINGS) && (
              <button
                onClick={() => {
                  save(DEFAULT_REVIEW_SETTINGS)
                  showToast('Review settings reset')
                }}
                style={{
                  background: 'none', border: 'none', padding: '14px 0 0', cursor: 'pointer',
                  fontSize: 16, color: 'var(--amber-600)', fontFamily: 'inherit',
                }}
              >
                Reset to defaults
              </button>
            )}
          </>
        )}

        <SectionTitle top={28}>Learning</SectionTitle>

        <div style={{ fontSize: 17, color: 'var(--text-primary)' }}>Chinese translation</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
          English comes first everywhere. Tap 中文 on a sense when you are stuck.
        </div>
        <Segmented value={chinese} options={CHINESE_OPTIONS} onChange={setChineseDisplay} />

        <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 36 }}>
          Build {__BUILD_ID__}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ top = 0, children }: { top?: number; children: ReactNode }) {
  return (
    <div style={{
      fontSize: 14, color: 'var(--text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      fontWeight: 500, margin: `${top}px 0 12px`,
    }}>
      {children}
    </div>
  )
}

// One setting: its name and what it does, with its control beside them (`aside`) or
// underneath (`children`).
function Field({ label, hint, aside, children }: {
  label: string
  hint?: string
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '0.5px solid var(--border-tertiary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, color: 'var(--text-primary)' }}>{label}</div>
          {hint && (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: 3 }}>{hint}</div>
          )}
        </div>
        {aside}
      </div>
      {children}
    </div>
  )
}

// A field's own copy of its saved value while it is edited. A save — from here, or synced
// in from another device — replaces the copy.
function useDraft<T>(saved: T): [T, (value: T) => void] {
  const [draft, setDraft] = useState(saved)
  const [base, setBase] = useState(saved)
  if (!Object.is(base, saved)) {
    setBase(saved)
    setDraft(saved)
  }
  return [draft, setDraft]
}

// Saved when the box is left, or on Enter — a half-typed "15" on the way to "150" is never
// written. Out-of-range numbers are pulled back into range; anything else puts the saved
// value back.
function NumberField({ label, hint, value, limits, onSave }: {
  label: string
  hint: string
  value: number
  limits: { min: number; max: number }
  onSave: (value: number) => void
}) {
  const [draft, setDraft] = useDraft(String(value))

  function commit() {
    const n = Number.parseInt(draft, 10)
    const next = Number.isNaN(n) ? value : Math.min(limits.max, Math.max(limits.min, n))
    setDraft(String(next))
    if (next !== value) onSave(next)
  }

  return (
    <Field
      label={label}
      hint={hint}
      aside={
        <input
          value={draft}
          onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={label}
          style={{ ...INPUT, width: 92, flexShrink: 0, textAlign: 'center' }}
        />
      }
    />
  )
}

// Saved when the thumb is let go. React's onChange fires at every step of a drag; the
// native change event fires once, at the end.
function RetentionField({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useDraft(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const commit = () => onSave(Number(el.value))
    el.addEventListener('change', commit)
    return () => el.removeEventListener('change', commit)
  }, [onSave])

  return (
    <Field
      label="Target retention"
      hint="How likely you should be to remember a card when it comes back. Higher means more reviews."
      aside={
        <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(draft * 100)}%
        </span>
      }
    >
      <input
        ref={ref}
        type="range"
        min={REVIEW_LIMITS.retention.min}
        max={REVIEW_LIMITS.retention.max}
        step={0.01}
        value={draft}
        onChange={e => setDraft(Number(e.target.value))}
        aria-label="Target retention"
        style={{ width: '100%', marginTop: 12, accentColor: 'var(--amber-600)' }}
      />
    </Field>
  )
}

// Saved when the box is left. A list that is not all steps stays in the box, unsaved, with
// a note under it.
function StepsField({ label, hint, value, onSave }: {
  label: string
  hint: string
  value: string[]
  onSave: (steps: string[]) => void
}) {
  const [draft, setDraft] = useDraft(value.join(' '))
  const [rejected, setRejected] = useState<string | null>(null)
  const invalid = rejected !== null && rejected === draft

  function commit() {
    const steps = parseSteps(draft)
    if (!steps) {
      setRejected(draft)
      return
    }
    setDraft(steps.join(' '))
    if (steps.join(' ') !== value.join(' ')) onSave(steps)
  }

  return (
    <Field label={label} hint={hint}>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder="None"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={label}
        aria-invalid={invalid}
        style={{
          ...INPUT, width: '100%', marginTop: 10, padding: '0 12px',
          boxShadow: invalid ? 'inset 0 0 0 1.5px #dc2626' : 'none',
        }}
      />
      {invalid && (
        <div style={{ fontSize: 16, color: '#dc2626', marginTop: 6 }}>
          Use whole numbers with m, h or d — like 1m 10m.
        </div>
      )}
    </Field>
  )
}

function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 3,
      background: 'var(--bg-secondary)', borderRadius: 10,
      padding: 3, marginTop: 12,
    }}>
      {options.map(({ value: option, label }) => {
        const active = value === option
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            aria-pressed={active}
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
  )
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width: 50, height: 30, flexShrink: 0, padding: 2,
        border: 'none', borderRadius: 15, cursor: 'pointer',
        background: on ? 'var(--amber-600)' : 'var(--border-primary)',
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        display: 'block', width: 26, height: 26, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transform: on ? 'translateX(20px)' : 'none',
        transition: 'transform 0.15s',
      }} />
    </button>
  )
}
