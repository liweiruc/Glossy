import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Definition, Example } from '../db'
import type { ChineseDisplay } from '../db/settings'
import { markTarget } from '../utils/highlight'
import ClickableText from './ClickableText'

interface Props {
  def: Definition
  lemma: string
  chinese: ChineseDisplay
  size?: 'full' | 'compact'
  maxExamples?: number
  onWordClick?: (word: string) => void
  action?: ReactNode
}

const SIZES = {
  full: { pos: 14, def: 17, example: 16, gap: 8, toggleRow: 44 },
  compact: { pos: 13, def: 17, example: 14, gap: 6, toggleRow: 38 },
}

// One sense of a word, rendered the same way everywhere it appears: the English
// definition carries the meaning and the Chinese stays folded until asked for.
export default function SenseBlock({ def, lemma, chinese, size = 'full', maxExamples, onWordClick, action }: Props) {
  const [revealed, setRevealed] = useState(false)
  const s = SIZES[size]
  const showChinese = chinese === 'always' || (chinese === 'tap' && revealed)
  // "neutral" is the default a learner should assume; only the marked cases are worth ink.
  const register = def.register && def.register !== 'neutral' ? def.register : null

  function english(value: string) {
    return onWordClick ? <ClickableText text={value} onWordClick={onWordClick} /> : value
  }

  function exampleText(ex: Example) {
    return markTarget(ex.en, ex.target, lemma).map((part, i) =>
      part.target ? (
        <span key={i} style={{ fontWeight: 600, borderBottom: '2px solid rgba(0,0,0,0.10)' }}>
          {part.text}
        </span>
      ) : onWordClick ? (
        <ClickableText key={i} text={part.text} onWordClick={onWordClick} />
      ) : (
        <Fragment key={i}>{part.text}</Fragment>
      )
    )
  }

  return (
    <div style={{ paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: s.pos, fontStyle: 'italic',
          color: 'var(--amber-700)', background: 'var(--amber-50)',
          borderRadius: 4, padding: '1px 7px',
        }}>
          {def.pos}
        </span>
        {register && (
          <span style={{ fontSize: s.pos, color: 'var(--text-tertiary)' }}>{register}</span>
        )}
        {action && (
          <>
            <span style={{ flex: 1 }} />
            {action}
          </>
        )}
      </div>

      <div style={{ fontSize: s.def, color: 'var(--text-primary)', lineHeight: 1.45, marginTop: 4 }}>
        {english(def.en)}
      </div>

      {chinese === 'tap' && (
        <div style={{ minHeight: s.toggleRow, display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setRevealed(r => !r)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 26, padding: '0 10px',
              border: '0.5px solid var(--border-secondary)', borderRadius: 8,
              background: revealed ? 'var(--bg-secondary)' : 'none',
              color: revealed ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            中文
            {revealed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      )}

      {showChinese && (
        <div style={{
          fontSize: s.def, color: 'var(--text-secondary)', lineHeight: 1.45,
          marginTop: chinese === 'always' ? 2 : 0, marginBottom: 6,
        }}>
          {def.cn}
        </div>
      )}

      {(maxExamples ? def.examples.slice(0, maxExamples) : def.examples).map((ex, i) => (
        <div key={i} style={{ display: 'flex', marginTop: 6 }}>
          <div style={{
            width: 2, background: 'var(--border-tertiary)', borderRadius: 1,
            flexShrink: 0, marginRight: s.gap,
          }} />
          <div>
            <div style={{ fontSize: s.example, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
              {exampleText(ex)}
            </div>
            {showChinese && (
              <div style={{ fontSize: s.example, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {ex.cn}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
