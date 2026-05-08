import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Volume2, CheckCircle } from 'lucide-react'
import type { ReviewItem, WordSnapshot, SentenceSnapshot } from '../db'
import { getDueItems, updateItemAfterRating, addReviewLog } from '../db/queries'
import { applyRating, previewInterval } from '../algorithms/sm2'
import type { Rating } from '../algorithms/sm2'

type Phase = 'loading' | 'front' | 'back' | 'done'

const RATINGS: { key: Rating; label: string; bg: string; color: string }[] = [
  { key: 'again', label: 'Again', bg: '#FCEBEB', color: '#791F1F' },
  { key: 'hard',  label: 'Hard',  bg: '#FAEEDA', color: '#854F0B' },
  { key: 'good',  label: 'Good',  bg: '#EAF3DE', color: '#27500A' },
  { key: 'easy',  label: 'Easy',  bg: '#E6F1FB', color: '#0C447C' },
]

export default function ReviewSession() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const lastRatings = useRef(new Map<string, Rating>())

  useEffect(() => {
    getDueItems().then(items => {
      setQueue(items)
      setPhase(items.length > 0 ? 'front' : 'done')
    })
  }, [])

  const currentItem = queue[currentIndex] ?? null
  const wordSnap = currentItem?.type === 'word' ? currentItem.snapshot as WordSnapshot : null
  const sentenceSnap = currentItem?.type === 'sentence' ? currentItem.snapshot as SentenceSnapshot : null

  async function handleRate(rating: Rating) {
    if (!currentItem || phase !== 'back') return
    const result = applyRating(currentItem, rating)

    await updateItemAfterRating(currentItem.id, result)
    await addReviewLog({
      item_id: currentItem.id,
      rating,
      prev_interval: currentItem.interval_days,
      new_interval: result.interval_days,
      reviewed_at: Date.now(),
    })

    lastRatings.current.set(currentItem.id, rating)
    const nextIndex = currentIndex + 1

    if (rating === 'again') {
      const requeued: ReviewItem = { ...currentItem, ...result }
      setQueue(prev => [...prev, requeued])
      setCurrentIndex(nextIndex)
      setPhase('front')
    } else {
      if (nextIndex >= queue.length) {
        setPhase('done')
      } else {
        setCurrentIndex(nextIndex)
        setPhase('front')
      }
    }
  }

  function speak(word: string) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(word)
    utt.lang = 'en-US'
    utt.rate = 0.9
    window.speechSynthesis.speak(utt)
  }

  /* ── Loading ── */
  if (phase === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</span>
      </div>
    )
  }

  /* ── Completion ── */
  if (phase === 'done') {
    const ratings = [...lastRatings.current.values()]
    const reviewed = lastRatings.current.size
    const remembered = ratings.filter(r => r === 'good' || r === 'easy').length
    const needPractice = ratings.filter(r => r === 'again').length

    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', textAlign: 'center',
      }}>
        <CheckCircle size={48} color="#22c55e" />
        <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', marginTop: 16, marginBottom: 12 }}>
          Session complete
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 2 }}>
          <div>Reviewed: {reviewed}</div>
          <div>Remembered: {remembered}</div>
          <div>Need more practice: {needPractice}</div>
        </div>
        <button
          onClick={() => navigate('/review')}
          style={{
            marginTop: 24,
            background: 'var(--amber-600)', color: '#fff',
            border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Back to review book
        </button>
      </div>
    )
  }

  /* ── AppBar (shared between front & back) ── */
  const appBar = (
    <div style={{
      height: 48, display: 'flex', alignItems: 'center',
      padding: '0 18px', borderBottom: '0.5px solid var(--border-tertiary)',
      flexShrink: 0,
    }}>
      <button
        onClick={() => navigate('/review')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', marginLeft: -4 }}
      >
        <X size={20} color="var(--text-secondary)" />
      </button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
        {currentIndex + 1} / {queue.length}
      </span>
      <div style={{ width: 28 }} />
    </div>
  )

  /* ── Front face ── */
  if (phase === 'front') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        {appBar}
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '24px 32px',
            animation: 'revealFade 0.2s ease',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {wordSnap ? 'recall the meaning' : 'translate this sentence'}
          </div>
          <div style={{ flex: 1 }} />
          {wordSnap ? (
            <div style={{
              fontSize: 42, fontWeight: 500, color: 'var(--text-primary)',
              letterSpacing: '-1px', textAlign: 'center',
            }}>
              {wordSnap.lemma}
            </div>
          ) : (
            <div style={{
              fontSize: 18, color: 'var(--text-primary)',
              lineHeight: 1.6, maxWidth: 280, textAlign: 'center',
            }}>
              {sentenceSnap?.source_text}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 14, marginBottom: 30 }}>
            tap to reveal
          </div>
          <button
            onClick={() => setPhase('back')}
            style={{
              background: 'none',
              border: '0.5px solid var(--border-secondary)',
              borderRadius: 8, padding: '9px 22px',
              fontSize: 13, color: 'var(--text-primary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Show answer
          </button>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    )
  }

  /* ── Back face ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {appBar}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {/* Question stays visible at top */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            {wordSnap ? 'recall the meaning' : 'translate this sentence'}
          </div>
          {wordSnap ? (
            <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {wordSnap.lemma}
            </div>
          ) : (
            <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {sentenceSnap?.source_text}
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderTop: '0.5px solid var(--border-tertiary)', margin: '14px 18px' }} />

        {/* Reveal content — opacity fade-in only */}
        <div style={{ animation: 'revealFade 0.15s ease both' }}>
          {wordSnap && (
            <>
              <div style={{ padding: '0 18px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {wordSnap.phonetic_uk && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>UK {wordSnap.phonetic_uk}</span>
                  )}
                  {wordSnap.phonetic_us && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>US {wordSnap.phonetic_us}</span>
                  )}
                  <button
                    onClick={() => speak(wordSnap.lemma)}
                    style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex' }}
                  >
                    <Volume2 size={13} color="var(--amber-600)" />
                  </button>
                </div>
              </div>
              <div style={{ padding: '0 18px' }}>
                {wordSnap.definitions.map((def, i) => (
                  <div
                    key={i}
                    style={{
                      paddingBottom: 12,
                      borderBottom: i < wordSnap.definitions.length - 1 ? '0.5px solid var(--border-tertiary)' : 'none',
                      marginBottom: i < wordSnap.definitions.length - 1 ? 12 : 0,
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontStyle: 'italic',
                      color: '#854F0B', background: '#FAEEDA',
                      borderRadius: 4, padding: '1px 7px',
                    }}>
                      {def.pos}
                    </span>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45, marginTop: 4 }}>
                      {def.en}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 6 }}>
                      {def.cn}
                    </div>
                    {def.examples.map((ex, j) => (
                      <div key={j} style={{ display: 'flex', marginTop: 4 }}>
                        <div style={{
                          width: 2, background: 'var(--border-tertiary)',
                          borderRadius: 1, flexShrink: 0, marginRight: 8,
                        }} />
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                            {ex.en}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {ex.cn}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {sentenceSnap && (
            <div style={{ padding: '0 18px' }}>
              {(['casual', 'formal', 'idiomatic'] as const)
                .filter(v => sentenceSnap[`${v}_en`])
                .map(v => (
                  <div key={v} style={{ marginBottom: 14 }}>
                    <div style={{
                      fontSize: 11, color: '#854F0B',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                      marginBottom: 5,
                    }}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {sentenceSnap[`${v}_en`]}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* RatingBar */}
      {currentItem && (
        <div style={{
          borderTop: '0.5px solid var(--border-tertiary)',
          padding: '10px 14px 14px',
          flexShrink: 0,
          background: 'var(--bg-primary)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {RATINGS.map(({ key, label, bg, color }) => (
              <button
                key={key}
                onClick={() => handleRate(key)}
                style={{
                  background: bg, color,
                  border: 'none', borderRadius: 8,
                  padding: '10px 4px',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 10, opacity: 0.75 }}>{previewInterval(currentItem, key)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
