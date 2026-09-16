import { Fragment, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Volume2, CheckCircle } from 'lucide-react'
import { snapshotSenses } from '../db'
import type { ReviewItem, WordSnapshot, SentenceSnapshot, Example } from '../db'
import { getDueItems, updateItemAfterRating, addReviewLog } from '../db/queries'
import { useChineseDisplay } from '../db/settings'
import { applyRating, previewInterval } from '../algorithms/sm2'
import type { Rating } from '../algorithms/sm2'
import { pickWordCard, cardPrompt } from '../algorithms/cards'
import { markTarget } from '../utils/highlight'
import SenseBlock from '../components/SenseBlock'

type Phase = 'loading' | 'front' | 'back' | 'done'

const RATINGS: { key: Rating; label: string; bg: string; color: string }[] = [
  { key: 'again', label: 'Again', bg: '#FCEBEB', color: '#791F1F' },
  { key: 'hard',  label: 'Hard',  bg: '#FAEEDA', color: '#854F0B' },
  { key: 'good',  label: 'Good',  bg: '#EAF3DE', color: '#27500A' },
  { key: 'easy',  label: 'Easy',  bg: '#E6F1FB', color: '#0C447C' },
]

export default function ReviewSession() {
  const navigate = useNavigate()
  const chinese = useChineseDisplay()
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
  const card = currentItem && wordSnap ? pickWordCard(currentItem) : null

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
        <span style={{ fontSize: 17, color: 'var(--text-tertiary)' }}>Loading…</span>
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
        <div style={{ fontSize: 26, fontWeight: 500, color: 'var(--text-primary)', marginTop: 16, marginBottom: 12 }}>
          Session complete
        </div>
        <div style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 2 }}>
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
            padding: '10px 24px', fontSize: 17, fontWeight: 500,
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
      <span style={{ flex: 1, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
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
          {card?.mode === 'fresh' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: 'var(--bg-secondary)', borderRadius: 8,
                padding: '4px 10px', fontSize: 13, color: 'var(--text-secondary)',
              }}>
                new example
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
                {cardPrompt('fresh', undefined)}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
              {card ? cardPrompt(card.mode, card.example?.target) : 'translate this sentence'}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {card && wordSnap && (
            card.mode === 'bare' || !card.example ? (
              <div style={{
                fontSize: 42, fontWeight: 500, color: 'var(--text-primary)',
                letterSpacing: '-1px', textAlign: 'center',
              }}>
                {wordSnap.lemma}
              </div>
            ) : (
              <div style={{
                fontSize: 23, color: 'var(--text-primary)',
                lineHeight: 1.7, maxWidth: 300, textAlign: 'center',
              }}>
                {card.mode === 'cloze' ? (
                  <ClozeSentence example={card.example} lemma={wordSnap.lemma} />
                ) : (
                  <MarkedSentence example={card.example} lemma={wordSnap.lemma} />
                )}
              </div>
            )
          )}

          {sentenceSnap && (
            <div style={{
              fontSize: 23, color: 'var(--text-primary)',
              lineHeight: 1.6, maxWidth: 280, textAlign: 'center',
            }}>
              {sentenceSnap.source_text}
            </div>
          )}

          {/* Cloze gives the meaning as the cue; the others ask for it */}
          {card?.mode === 'cloze' && card.sense && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 10,
              padding: '12px 14px', marginTop: 28, width: '100%', boxSizing: 'border-box',
            }}>
              <div style={{
                fontSize: 13, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
              }}>
                Hint
              </div>
              <div style={{ fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {card.sense.en}
              </div>
              {card.example?.target?.includes(' ') && (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {card.example.target.trim().split(/\s+/).length} words
                </div>
              )}
            </div>
          )}

          {card?.mode === 'cloze' ? (
            <div style={{ height: 24 }} />
          ) : (
            <div style={{ fontSize: 16, color: 'var(--text-tertiary)', marginTop: 20, marginBottom: 24 }}>
              {card && card.mode !== 'bare' && card.example ? 'What does it mean here?' : 'tap to reveal'}
            </div>
          )}
          <button
            onClick={() => setPhase('back')}
            style={{
              background: 'none',
              border: '0.5px solid var(--border-secondary)',
              borderRadius: 8, padding: '9px 22px',
              fontSize: 17, color: 'var(--text-primary)',
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
        {/* Question stays visible at top — a cloze now shows the word it was hiding */}
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            {card ? cardPrompt(card.mode === 'cloze' ? 'context' : card.mode, undefined) : 'translate this sentence'}
          </div>
          {card && wordSnap && (
            card.example ? (
              <div style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                <MarkedSentence example={card.example} lemma={wordSnap.lemma} emphasis />
              </div>
            ) : (
              <div style={{ fontSize: 36, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {wordSnap.lemma}
              </div>
            )
          )}
          {sentenceSnap && (
            <div style={{ fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {sentenceSnap.source_text}
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderTop: '0.5px solid var(--border-tertiary)', margin: '14px 18px' }} />

        {/* Reveal content — opacity fade-in only */}
        <div style={{ animation: 'revealFade 0.15s ease both' }}>
          {/* One sense per card: the meaning is the answer, so it leads. The word itself
              was visible in the question, so it sits underneath as reference. */}
          {wordSnap && card?.sense && card.senses.length === 1 && (
            <div style={{ padding: '0 18px' }}>
              <SenseBlock
                def={card.example
                  ? { ...card.sense, examples: card.sense.examples.filter(ex => ex !== card.example) }
                  : card.sense}
                lemma={wordSnap.lemma}
                chinese={chinese}
                size="answer"
                maxExamples={1}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 17, color: 'var(--text-secondary)' }}>{wordSnap.lemma}</span>
                {wordSnap.phonetic_us && (
                  <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>{wordSnap.phonetic_us}</span>
                )}
                <button
                  onClick={() => speak(wordSnap.lemma)}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex' }}
                >
                  <Volume2 size={13} color="var(--amber-600)" />
                </button>
              </div>
            </div>
          )}

          {/* Cards from before the per-sense split hold every sense at once */}
          {wordSnap && card && card.senses.length > 1 && (
            <>
              <div style={{ padding: '0 18px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {wordSnap.phonetic_uk && (
                    <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>UK {wordSnap.phonetic_uk}</span>
                  )}
                  {wordSnap.phonetic_us && (
                    <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>US {wordSnap.phonetic_us}</span>
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
                {snapshotSenses(wordSnap).map((def, i, senses) => (
                  <div
                    key={i}
                    style={{
                      paddingBottom: 12,
                      borderBottom: i < senses.length - 1 ? '0.5px solid var(--border-tertiary)' : 'none',
                      marginBottom: i < senses.length - 1 ? 12 : 0,
                    }}
                  >
                    <SenseBlock
                      def={def}
                      lemma={wordSnap.lemma}
                      chinese={chinese}
                      size="compact"
                    />
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
                      fontSize: 14, color: '#854F0B',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                      marginBottom: 5,
                    }}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.5 }}>
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
                <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, opacity: 0.75 }}>{previewInterval(currentItem, key)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// The sentence with the word being tested marked inside it. On the question side the
// mark is all the emphasis there is; on the answer side the word also darkens.
function MarkedSentence({ example, lemma, emphasis }: {
  example: Example; lemma: string; emphasis?: boolean
}) {
  return (
    <>
      {markTarget(example.en, example.target, lemma).map((part, i) =>
        part.target ? (
          <span
            key={i}
            style={{
              fontWeight: 600,
              color: emphasis ? 'var(--text-primary)' : undefined,
              borderBottom: '2px solid var(--border-primary)',
            }}
          >
            {part.text}
          </span>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  )
}

// The same sentence with the word taken out. The blank is sized from the answer so it
// hints at length without spelling anything out.
function ClozeSentence({ example, lemma }: { example: Example; lemma: string }) {
  return (
    <>
      {markTarget(example.en, example.target, lemma).map((part, i) =>
        part.target ? (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: Math.min(190, Math.max(64, part.text.length * 12)),
              borderBottom: '2px solid var(--border-primary)',
            }}
          />
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  )
}
