import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, X, Plus, Check, Tag } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WordSnapshot, WordContext } from '../db'
import { findChunks, explainInContext } from '../api/capture'
import type { ContextSense } from '../api/capture'
import { getErrorMessage } from '../api/llm'
import { addContextCard, updateCapture } from '../db/queries'
import { useChineseDisplay } from '../db/settings'
import { sentenceAt } from '../utils/sentences'
import { markTarget } from '../utils/highlight'
import ClickableText from '../components/ClickableText'
import ErrorBanner from '../components/ErrorBanner'
import SenseBlock from '../components/SenseBlock'

interface Tap {
  phrase: string
  sentence: string
}

export default function CaptureText() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const chinese = useChineseDisplay()

  const capture = useLiveQuery(() => (id ? db.captures.get(id) : undefined), [id])
  const savedCount = useLiveQuery(async () => {
    if (!id) return 0
    const items = await db.review_items.toArray()
    return items.filter(item =>
      item.type === 'word'
      && ((item.snapshot as WordSnapshot).contexts ?? []).some(c => c.capture_id === id)
    ).length
  }, [id], 0)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [tap, setTap] = useState<Tap | null>(null)
  const [sense, setSense] = useState<ContextSense | null>(null)
  const [senseLoading, setSenseLoading] = useState(false)
  const [senseError, setSenseError] = useState<string | null>(null)
  const [savedContext, setSavedContext] = useState<WordContext | null>(null)
  const [editingSource, setEditingSource] = useState(false)
  const chunksRequested = useRef<string | null>(null)
  const lastTap = useRef('')

  // The chunks a passage needs are asked for once and kept with it, so reopening the
  // passage — or opening it on another device — costs nothing.
  useEffect(() => {
    if (!capture || capture.chunks !== undefined) return
    if (chunksRequested.current === capture.id) return
    chunksRequested.current = capture.id

    findChunks(capture.text)
      .then(chunks => updateCapture(capture.id, { chunks }))
      .catch(err => setErrorMsg(getErrorMessage(err)))
  }, [capture])

  useEffect(() => {
    if (!tap) return
    const controller = new AbortController()
    let cancelled = false

    explainInContext(tap.phrase, tap.sentence, controller.signal)
      .then(result => { if (!cancelled) setSense(result) })
      .catch(err => {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setSenseError(getErrorMessage(err))
      })
      .finally(() => { if (!cancelled) setSenseLoading(false) })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tap])

  const handleTap = useCallback((phrase: string, start: number) => {
    const sentence = sentenceAt(capture?.text ?? '', start)
    const key = JSON.stringify([phrase, sentence])
    // Tapping the same phrase in the same sentence again must not re-ask the model.
    if (key === lastTap.current) return
    lastTap.current = key

    setSense(null)
    setSavedContext(null)
    setSenseError(null)
    setSenseLoading(true)
    setTap({ phrase, sentence })
  }, [capture])

  async function handleSave() {
    if (!capture || !tap || !sense) return
    const context: WordContext = {
      en: tap.sentence,
      target: sense.target,
      source: capture.source,
      capture_id: capture.id,
    }
    await addContextCard(sense.lemma, sense.sense, context)
    setSavedContext(context)
  }

  function closeSheet() {
    lastTap.current = ''
    setTap(null)
    setSense(null)
    setSavedContext(null)
    setSenseError(null)
  }

  if (!capture) {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 17, color: 'var(--text-tertiary)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div className="screen">
      {/* AppBar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center',
        padding: '0 18px', borderBottom: '0.5px solid var(--border-tertiary)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', marginLeft: -4 }}
        >
          <ChevronLeft size={20} color="var(--text-secondary)" />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 18, color: 'var(--text-secondary)' }}>
          Read
        </span>
        <div style={{ width: 20 }} />
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />}

      {/* Passage */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 28px' }}>
        {editingSource ? (
          <input
            autoFocus
            defaultValue={capture.source ?? ''}
            placeholder="Where is this from?"
            onBlur={e => {
              updateCapture(capture.id, { source: e.target.value.trim() || undefined })
              setEditingSource(false)
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 14,
              background: 'var(--bg-secondary)', border: 'none', borderRadius: 8,
              padding: '10px 12px', fontSize: 16, color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingSource(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
              background: 'none', border: 'none', padding: '4px 0',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Tag size={14} color="var(--text-tertiary)" />
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
              {capture.source || 'Where is this from?'}
            </span>
          </button>
        )}

        <div style={{ fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.75 }}>
          <ClickableText text={capture.text} onWordClick={handleTap} chunks={capture.chunks} />
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.5, marginTop: 20 }}>
          {capture.chunks === undefined
            ? 'Finding the phrases worth learning…'
            : 'Tap any word. Shaded phrases are looked up whole.'}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '0.5px solid var(--border-tertiary)',
        padding: '10px 18px 14px',
        flexShrink: 0, background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-tertiary)' }}>
          {savedCount === 1 ? '1 saved from this text' : `${savedCount} saved from this text`}
        </span>
        <button
          onClick={() => navigate('/')}
          style={{
            border: '0.5px solid var(--border-secondary)', background: 'none',
            borderRadius: 8, padding: '11px 16px', fontSize: 16,
            color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Done
        </button>
      </div>

      {tap && (
        <>
          <div
            onClick={closeSheet}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', left: 14, right: 14, bottom: 14, zIndex: 201,
            background: 'var(--bg-primary)', borderRadius: 16,
            padding: '14px 16px 12px', border: '0.5px solid var(--border-secondary)',
            maxWidth: 430 - 28, marginLeft: 'auto', marginRight: 'auto',
          }}>
            <div style={{
              width: 32, height: 3, borderRadius: 2,
              background: 'var(--border-tertiary)', margin: '0 auto 12px',
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 29, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                {tap.phrase}
              </div>
              <button
                onClick={closeSheet}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', marginTop: 4 }}
              >
                <X size={20} color="var(--text-tertiary)" />
              </button>
            </div>

            {senseLoading && (
              <div style={{ padding: '18px 0', fontSize: 17, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Reading the sentence…
              </div>
            )}

            {senseError && !senseLoading && (
              <div style={{ padding: '12px 0', fontSize: 17, color: 'var(--text-secondary)', textAlign: 'center' }}>
                {senseError}
              </div>
            )}

            {sense && !senseLoading && (
              <>
                <div style={{ borderTop: '0.5px solid var(--border-tertiary)', marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    in this sentence
                  </div>
                  <div style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {markTarget(tap.sentence, sense.target, sense.lemma).map((part, i) =>
                      part.target
                        ? <span key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part.text}</span>
                        : <span key={i}>{part.text}</span>
                    )}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <SenseBlock
                      def={sense.sense}
                      lemma={sense.lemma}
                      chinese={chinese}
                      size="answer"
                      maxExamples={0}
                    />
                  </div>
                </div>

                {savedContext ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderTop: '0.5px solid var(--border-tertiary)',
                    marginTop: 12, paddingTop: 12,
                  }}>
                    <Check size={16} color="var(--amber-600)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 17, color: 'var(--text-primary)' }}>
                      Saved with this sentence
                    </span>
                    <button
                      onClick={closeSheet}
                      style={{
                        background: 'var(--amber-600)', color: '#fff',
                        border: 'none', borderRadius: 8, padding: '11px 16px',
                        fontSize: 17, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Keep reading
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', gap: 8,
                    borderTop: '0.5px solid var(--border-tertiary)',
                    marginTop: 12, paddingTop: 12,
                  }}>
                    <button
                      onClick={handleSave}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        background: 'var(--amber-600)', color: '#fff',
                        border: 'none', borderRadius: 8, padding: '12px 0',
                        fontSize: 17, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Plus size={12} />
                      Save with this sentence
                    </button>
                    <button
                      onClick={() => navigate('/lookup/' + sense.lemma)}
                      style={{
                        background: 'none', border: '0.5px solid var(--border-secondary)',
                        borderRadius: 8, padding: '12px 14px', fontSize: 16,
                        color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      Open full
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
