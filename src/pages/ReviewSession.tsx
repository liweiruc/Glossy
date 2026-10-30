import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CircleCheck, CircleX, Lightbulb, PartyPopper, TriangleAlert, Undo2, Volume2, X,
} from 'lucide-react'
import { snapshotSenses } from '../db'
import type { Definition, Example, ReviewItem, SentenceSnapshot, WordSnapshot } from '../db'
import { getTodayQueue, saveRating, undoRating } from '../db/queries'
import { getReviewSettings, useChineseDisplay } from '../db/settings'
import type { ChineseDisplay } from '../db/settings'
import { formatInterval } from '../algorithms/fsrs'
import type { Rating } from '../algorithms/fsrs'
import { cardAnswer, cardPrompt, pickWordCard } from '../algorithms/cards'
import { diffChars, judgeAnswer, letterHint, suggestRating } from '../algorithms/answer'
import type { Outcome } from '../algorithms/answer'
import { StudySession } from '../algorithms/session'
import type { Intervals, SessionDeps, SessionSummary, StudyProgress, StudyStep } from '../algorithms/session'
import { markTarget } from '../utils/highlight'
import { formatDuration } from '../utils/time'
import SenseBlock, { ChineseToggle } from '../components/SenseBlock'
import StatTile from '../components/StatTile'
import { useToast } from '../components/Toast'

const RATINGS: { key: Rating; label: string; bg: string; color: string }[] = [
  { key: 'again', label: 'Again', bg: '#FCEBEB', color: '#791F1F' },
  { key: 'hard',  label: 'Hard',  bg: '#FAEEDA', color: '#854F0B' },
  { key: 'good',  label: 'Good',  bg: '#EAF3DE', color: '#27500A' },
  { key: 'easy',  label: 'Easy',  bg: '#E6F1FB', color: '#0C447C' },
]

// The verdict borrows the rating colours: right reads like Good, close like Hard, a miss
// like Again — so the suggested rating below it never comes as a surprise.
const TONES = {
  right: { background: '#EAF3DE', color: '#27500A' },
  close: { background: '#FAEEDA', color: '#854F0B' },
  miss: { background: '#FCEBEB', color: '#791F1F' },
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const PRIMARY: CSSProperties = {
  height: 46, padding: '0 18px', border: 'none', borderRadius: 10,
  background: 'var(--amber-600)', color: '#fff', fontSize: 18, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}
const SECONDARY: CSSProperties = {
  ...PRIMARY,
  background: 'none', color: 'var(--text-primary)', fontWeight: 400,
  border: '0.5px solid var(--border-secondary)',
}
const QUIET: CSSProperties = {
  ...PRIMARY,
  height: 42, padding: '0 12px', background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)', fontSize: 16, fontWeight: 400,
}

// Every rating is written the moment it is made, so leaving mid-session loses nothing.
const DEPS: SessionDeps = { save: saveRating, restore: undoRating, now: () => Date.now() }

// The settings are read once: a change made mid-session, here or on another device, waits
// for the next one.
async function startSession() {
  const settings = await getReviewSettings()
  const queue = await getTodayQueue(settings)
  return {
    session: new StudySession(DEPS, queue.entries, settings),
    studiedWords: queue.studiedWords,
    autoSpeak: settings.autoSpeak,
  }
}

function speak(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'en-US'
  utt.rate = 0.9
  window.speechSynthesis.speak(utt)
}

// Keyboard shortcuts for whatever is on screen, for review on an iPad or a laptop.
// Held-down repeats and IME composition are ignored; so is typing in the answer box, and
// Enter or Space on a focused button, which presses that button already.
function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler)
  useLayoutEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.isComposing || e.defaultPrevented) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('input, textarea') && !e.ctrlKey && !e.metaKey && e.key !== 'Escape') return
      if (target?.closest('button, a, summary') && (e.key === 'Enter' || e.key === ' ')) return
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function ReviewSession() {
  const navigate = useNavigate()
  const chinese = useChineseDisplay()
  const { showToast } = useToast()
  const session = useRef<StudySession | null>(null)
  const busy = useRef(false)
  const [step, setStep] = useState<StudyStep | null>(null)
  const [studiedWords, setStudiedWords] = useState<Set<string>>(() => new Set())
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    startSession()
      .then(started => {
        if (cancelled) return
        session.current = started.session
        setStudiedWords(started.studiedWords)
        setAutoSpeak(started.autoSpeak)
        setStep(started.session.step())
      })
      .catch(e => {
        console.error('[review]', e)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // One action at a time: a second tap while a rating is being written would land on the
  // next card.
  async function run(action: (s: StudySession) => StudyStep | Promise<StudyStep>) {
    const s = session.current
    if (!s || busy.current) return
    busy.current = true
    try {
      setStep(await action(s))
    } catch (e) {
      console.error('[review]', e)
      showToast("Couldn't save that — try again")
    } finally {
      busy.current = false
    }
  }

  function exit() {
    navigate('/review')
  }

  function undo() {
    run(s => s.undo())
  }

  // The answer side is up: what each rating would do, for the buttons to show.
  function reveal(): Intervals | null {
    return session.current?.reveal() ?? null
  }

  useKeys(e => {
    if (e.key === 'Escape') {
      e.preventDefault()
      exit()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && step?.canUndo) {
      // In a half-typed answer, Ctrl+Z takes back the typing, not the last card.
      const el = document.activeElement
      if (el instanceof HTMLInputElement && el.value) return
      e.preventDefault()
      undo()
    }
  })

  let body: ReactNode
  if (failed) {
    body = (
      <Screen center footer={<button onClick={exit} style={{ ...PRIMARY, width: '100%' }}>Back to review</button>}>
        <div style={{ textAlign: 'center', fontSize: 17, color: 'var(--text-secondary)' }}>
          Couldn't load your cards.
        </div>
      </Screen>
    )
  } else if (!step) {
    body = (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 17, color: 'var(--text-tertiary)' }}>Loading…</span>
      </div>
    )
  } else if (step.kind === 'done') {
    body = <DoneCard summary={step.summary} onExit={exit} />
  } else if (step.kind === 'intro') {
    body = (
      <IntroCard
        key={`intro-${step.item.id}`}
        item={step.item}
        chinese={chinese}
        autoSpeak={autoSpeak}
        newWord={!studiedWords.has((step.item.snapshot as WordSnapshot).lemma)}
        onContinue={() => run(s => s.continueIntro())}
        onKnown={() => run(s => s.rate('easy'))}
      />
    )
  } else if (step.item.type === 'word' && snapshotSenses(step.item.snapshot as WordSnapshot).length > 0) {
    body = (
      <WordCard
        key={`ask-${step.item.id}-${step.progress.done}`}
        item={step.item}
        chinese={chinese}
        autoSpeak={autoSpeak}
        onReveal={reveal}
        onRate={r => run(s => s.rate(r))}
      />
    )
  } else {
    body = (
      <SelfCard
        key={`ask-${step.item.id}-${step.progress.done}`}
        item={step.item}
        autoSpeak={autoSpeak}
        onReveal={reveal}
        onRate={r => run(s => s.rate(r))}
      />
    )
  }

  // Desktop browsers leave a clicked button focused, and Enter would then press it again —
  // fold the 中文 chip back, or undo a second card — instead of checking or rating. So a
  // click never moves focus onto a button; Tab still does. On a phone this also keeps the
  // keyboard up when a hint is tapped.
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}
      onMouseDown={e => {
        if (e.target instanceof Element && e.target.closest('button, summary')) e.preventDefault()
      }}
    >
      <SessionBar
        progress={step && step.kind !== 'done' ? step.progress : null}
        canUndo={!!step?.canUndo}
        onExit={exit}
        onUndo={undo}
      />
      {body}
    </div>
  )
}

function SessionBar({ progress, canUndo, onExit, onUndo }: {
  progress: StudyProgress | null
  canUndo: boolean
  onExit: () => void
  onUndo: () => void
}) {
  const total = progress
    ? progress.done + progress.newLeft + progress.reviewLeft + progress.learningLeft
    : 0
  return (
    <div style={{
      flexShrink: 0, borderBottom: '0.5px solid var(--border-tertiary)',
      padding: '6px 10px 8px',
    }}>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onExit}
          aria-label="End review"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}
        >
          <X size={20} color="var(--text-secondary)" />
        </button>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: progress ? 'var(--bg-secondary)' : 'none', overflow: 'hidden' }}>
          {progress && (
            <div style={{
              height: '100%', borderRadius: 3, background: 'var(--amber-600)',
              width: `${total ? (progress.done / total) * 100 : 0}%`,
              transition: 'width 0.3s ease',
            }} />
          )}
        </div>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo the last card"
          style={{
            visibility: canUndo ? 'visible' : 'hidden',
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 16, color: 'var(--text-secondary)', fontFamily: 'inherit',
          }}
        >
          <Undo2 size={17} />
          Undo
        </button>
      </div>
      {progress && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 14,
          fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums',
        }}>
          <span>New {progress.newLeft}</span>
          <span>Review {progress.reviewLeft}</span>
          <span>Learning {progress.learningLeft}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>Done {progress.done}</span>
        </div>
      )}
    </div>
  )
}

// A card's own scrolling area, with a bar pinned under it for the buttons the thumb needs.
function Screen({ children, footer, center = false }: {
  children: ReactNode
  footer?: ReactNode
  center?: boolean
}) {
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{
          minHeight: '100%', boxSizing: 'border-box', padding: '20px 18px 28px',
          display: 'flex', flexDirection: 'column',
          justifyContent: center ? 'center' : 'flex-start',
          animation: 'revealFade 0.2s ease',
        }}>
          {children}
        </div>
      </div>
      {footer && (
        <div style={{
          flexShrink: 0, borderTop: '0.5px solid var(--border-tertiary)',
          padding: '10px 14px calc(14px + env(safe-area-inset-bottom))',
          background: 'var(--bg-primary)',
        }}>
          {footer}
        </div>
      )}
    </>
  )
}

/* ── Intro: a new card, shown whole before it is ever asked ── */

function IntroCard({ item, chinese, autoSpeak, newWord, onContinue, onKnown }: {
  item: ReviewItem
  chinese: ChineseDisplay
  autoSpeak: boolean
  newWord: boolean
  onContinue: () => void
  onKnown: () => void
}) {
  const snap = item.snapshot as WordSnapshot
  const card = pickWordCard(item)

  // The card is keyed by its item, so this says the word once, as it comes up.
  useEffect(() => {
    if (autoSpeak) speak(snap.lemma)
  }, [autoSpeak, snap.lemma])

  useKeys(e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const key = e.key.toLowerCase()
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onContinue()
    } else if (key === 'k') {
      e.preventDefault()
      onKnown()
    } else if (key === 'p') {
      e.preventDefault()
      speak(snap.lemma)
    }
  })

  return (
    <Screen
      center
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onKnown} style={SECONDARY}>I know this</button>
          <button onClick={onContinue} style={{ ...PRIMARY, flex: 1 }}>Got it, test me</button>
        </div>
      }
    >
      <Tag accent>{newWord ? 'New word' : 'New meaning'}</Tag>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 42, fontWeight: 500, color: 'var(--text-primary)',
          letterSpacing: '-1px', lineHeight: 1.15,
        }}>
          {snap.lemma}
        </span>
        <SpeakButton text={snap.lemma} size={20} />
      </div>
      <Phonetics snap={snap} />

      {card.sense && (
        <div style={{
          marginTop: 20, border: '0.5px solid var(--border-secondary)',
          borderRadius: 14, padding: '14px 16px 10px',
        }}>
          {/* The sentence shown is the one the card will ask with */}
          <SenseBlock
            def={{ ...card.sense, examples: card.example ? [card.example] : [] }}
            lemma={snap.lemma}
            chinese={chinese}
            size="intro"
          />
        </div>
      )}
      <OtherSenses senses={card.senses.slice(1)} lemma={snap.lemma} chinese={chinese} />
    </Screen>
  )
}

/* ── A word card: the meaning and the sentence, the word left out, typed back in ── */

type HintStep = 'chinese' | 'letters'

function WordCard({ item, chinese, autoSpeak, onReveal, onRate }: {
  item: ReviewItem
  chinese: ChineseDisplay
  autoSpeak: boolean
  onReveal: () => Intervals | null
  onRate: (rating: Rating) => void
}) {
  const snap = item.snapshot as WordSnapshot
  const card = pickWordCard(item)
  const sense = card.sense as Definition // a typed card always has one
  const expected = cardAnswer(card, snap.lemma)
  // Chinese first, when there is some and the learner reads it at all; then the first
  // letter and the length.
  const hintSteps: HintStep[] = sense.cn && chinese !== 'never' ? ['chinese', 'letters'] : ['letters']
  const register = sense.register && sense.register !== 'neutral' ? sense.register : null

  const [input, setInput] = useState('')
  const [hints, setHints] = useState(0)
  const [result, setResult] = useState<{
    outcome: Outcome
    suggested: Rating
    intervals: Intervals | null
  } | null>(null)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const shown = hintSteps.slice(0, hints)
  const nextHint: HintStep | undefined = hintSteps[hints]

  // Tapping the hint button takes focus from the answer box; give it straight back so the
  // learner can keep typing.
  function hint() {
    setHints(h => Math.min(hintSteps.length, h + 1))
    inputRef.current?.focus()
  }

  function submit(gaveUp: boolean) {
    if (result) return
    if (!gaveUp && !input.trim()) {
      setShake(true)
      setTimeout(() => setShake(false), 300)
      inputRef.current?.focus()
      return
    }
    const outcome: Outcome = gaveUp ? 'gave_up' : judgeAnswer(input, expected, snap.lemma)
    setResult({ outcome, suggested: suggestRating(outcome, hints), intervals: onReveal() })
    inputRef.current?.blur()
    // Said from the tap or key itself: iOS lets speech start only from a user's action.
    if (autoSpeak) speak(expected)
  }

  useKeys(e => {
    const key = e.key.toLowerCase()
    if (!result) {
      if (e.ctrlKey && key === 'h') {
        e.preventDefault()
        hint()
      } else if (e.ctrlKey && key === 'g') {
        e.preventDefault()
        submit(true)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submit(false)
      }
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Enter') {
      e.preventDefault()
      onRate(result.suggested)
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault()
      onRate(RATINGS[Number(e.key) - 1].key)
    } else if (key === 'p') {
      e.preventDefault()
      speak(expected)
    }
  })

  return (
    <Screen footer={result && <RatingBar intervals={result.intervals} suggested={result.suggested} onRate={onRate} />}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 14, fontStyle: 'italic', color: 'var(--amber-700)',
          background: 'var(--amber-50)', borderRadius: 4, padding: '1px 7px',
        }}>
          {sense.pos}
        </span>
        {register && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{register}</span>}
        {card.mode === 'fresh' && <Tag>new sentence</Tag>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{cardPrompt(card, snap.lemma)}</span>
      </div>

      <div style={{ fontSize: 21, lineHeight: 1.4, color: 'var(--text-primary)', marginTop: 12 }}>
        {sense.en}
      </div>
      {shown.includes('chinese') && !result && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
          fontSize: 17, color: 'var(--text-secondary)',
        }}>
          <Lightbulb size={15} color="var(--amber-600)" style={{ flexShrink: 0 }} />
          {sense.cn}
        </div>
      )}

      {card.example && (
        <div style={{
          marginTop: 20, border: '0.5px solid var(--border-secondary)',
          borderRadius: 14, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 23, lineHeight: 1.6, fontStyle: 'italic', color: 'var(--text-primary)' }}>
            {result
              ? <MarkedSentence example={card.example} lemma={snap.lemma} />
              : <ClozeSentence example={card.example} lemma={snap.lemma} />}
          </div>
          {/* The learner's own sentences have no translation */}
          {result && card.example.cn && (
            <Chinese mode={chinese} style={{ marginTop: 8 }}>{card.example.cn}</Chinese>
          )}
        </div>
      )}

      {!result ? (
        <>
          <input
            ref={inputRef}
            className="review-answer"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit(false)
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={card.example ? 'Type the missing word' : 'Type the word'}
            aria-label="Your answer"
            style={{
              marginTop: 18, width: '100%', boxSizing: 'border-box', height: 54,
              borderRadius: 12, padding: '0 16px', outline: 'none',
              fontSize: 21, textAlign: 'center', fontFamily: 'inherit',
              color: 'var(--text-primary)', background: 'var(--bg-primary)',
              animation: shake ? 'shake 0.3s' : undefined,
            }}
          />
          {shown.includes('letters') && (
            <div style={{
              marginTop: 12, textAlign: 'center', whiteSpace: 'pre-wrap',
              fontFamily: MONO, fontSize: 21, color: 'var(--text-secondary)',
            }}>
              {letterHint(expected)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {nextHint && (
              <button
                onClick={hint}
                aria-label={nextHint === 'chinese' ? 'Hint: show the Chinese' : 'Hint: show the first letter'}
                style={QUIET}
              >
                <Lightbulb size={16} />
                {nextHint === 'chinese' ? '中文' : 'First letter'}
              </button>
            )}
            <button onClick={() => submit(true)} style={QUIET}>Don't know</button>
            <button onClick={() => submit(false)} style={{ ...PRIMARY, height: 42, flex: 1 }}>Check</button>
          </div>
        </>
      ) : (
        <div style={{ animation: 'revealFade 0.15s ease both' }}>
          <Verdict outcome={result.outcome} input={input} expected={expected} inSentence={!!card.example} />
          <div style={{
            marginTop: 12, border: '0.5px solid var(--border-secondary)',
            borderRadius: 14, padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', columnGap: 10, rowGap: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 36, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {snap.lemma}
              </span>
              <SpeakButton text={snap.lemma} size={18} />
              <Phonetics snap={snap} />
            </div>
            {sense.cn && <Chinese mode={chinese} style={{ marginTop: 6 }}>{sense.cn}</Chinese>}
          </div>
          <OtherSenses senses={card.senses.slice(1)} lemma={snap.lemma} chinese={chinese} />
        </div>
      )}
    </Screen>
  )
}

function Verdict({ outcome, input, expected, inSentence }: {
  outcome: Outcome
  input: string
  expected: string
  inSentence: boolean
}) {
  const box: CSSProperties = { borderRadius: 12, padding: '12px 16px', marginTop: 18 }
  if (outcome === 'correct' || outcome === 'gave_up') {
    const right = outcome === 'correct'
    return (
      <div style={{ ...box, ...(right ? TONES.right : TONES.miss), display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {right ? <CircleCheck size={20} /> : <CircleX size={20} />}
        <span style={{ fontSize: 17 }}>{right ? 'Correct' : 'The answer is'}</span>
        <span style={{ fontSize: 21, fontWeight: 600 }}>{expected}</span>
      </div>
    )
  }

  const close = outcome === 'typo' || outcome === 'wrong_form'
  const title = outcome === 'typo' ? 'Almost — check the spelling'
    : outcome === 'wrong_form' ? 'Right word, wrong form'
    : 'Not quite'
  const diff = diffChars(input.trim(), expected)
  const letters: CSSProperties = { fontFamily: MONO, fontSize: 21, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
  return (
    <div style={{ ...box, ...(close ? TONES.close : TONES.miss) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 500 }}>
        {close ? <TriangleAlert size={20} /> : <CircleX size={20} />}
        {title}
      </div>
      {outcome === 'wrong_form' && (
        <div style={{ fontSize: 16, marginTop: 2, opacity: 0.85 }}>
          {inSentence ? 'The sentence needs this form.' : 'The card asks for this form.'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', rowGap: 4, marginTop: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, opacity: 0.8 }}>Yours</span>
        <span style={letters}>
          {diff.given.map((c, i) => (
            <span
              key={i}
              style={c.ok ? undefined : { textDecoration: 'underline', textDecorationThickness: 2, textUnderlineOffset: 4 }}
            >
              {c.ch}
            </span>
          ))}
        </span>
        <span style={{ fontSize: 14, opacity: 0.8 }}>Answer</span>
        <span style={{ ...letters, fontWeight: 600 }}>
          {diff.expected.map((c, i) => (
            <span key={i} style={c.ok ? undefined : { background: 'rgba(255,255,255,0.8)', borderRadius: 3 }}>
              {c.ch}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

function RatingBar({ intervals, suggested, onRate }: {
  intervals: Intervals | null
  suggested: Rating | null
  onRate: (rating: Rating) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, paddingTop: suggested ? 8 : 0 }}>
      {RATINGS.map(({ key, label, bg, color }) => {
        const isSuggested = key === suggested
        return (
          <button
            key={key}
            onClick={() => onRate(key)}
            style={{
              position: 'relative',
              background: bg, color,
              border: 'none', borderRadius: 10,
              padding: '10px 4px',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              boxShadow: isSuggested ? '0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-primary)' : 'none',
            }}
          >
            {isSuggested && (
              <span style={{
                position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                borderRadius: 9, padding: '0 7px', fontSize: 13, lineHeight: '18px', whiteSpace: 'nowrap',
              }}>
                Suggested
              </span>
            )}
            <span style={{ fontSize: 16, fontWeight: 500 }}>{label}</span>
            <span style={{ fontSize: 13, opacity: 0.75 }}>{intervals && formatInterval(intervals[key])}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Sentence cards, and word cards with no meaning to ask from: think, reveal, rate ── */

const VERSIONS = ['casual', 'formal', 'idiomatic'] as const

function SelfCard({ item, autoSpeak, onReveal, onRate }: {
  item: ReviewItem
  autoSpeak: boolean
  onReveal: () => Intervals | null
  onRate: (rating: Rating) => void
}) {
  const [shown, setShown] = useState(false)
  const [intervals, setIntervals] = useState<Intervals | null>(null)
  const sentence = item.type === 'sentence' ? item.snapshot as SentenceSnapshot : null
  const word = item.type === 'word' ? item.snapshot as WordSnapshot : null

  function show() {
    setIntervals(onReveal())
    setShown(true)
    if (word && autoSpeak) speak(word.lemma)
  }

  useKeys(e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (!shown) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        show()
      }
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault()
      onRate(RATINGS[Number(e.key) - 1].key)
    }
  })

  return (
    <Screen
      center
      footer={shown
        ? <RatingBar intervals={intervals} suggested={null} onRate={onRate} />
        : <button onClick={show} style={{ ...SECONDARY, width: '100%' }}>Show answer</button>}
    >
      <div style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        {sentence ? 'translate this sentence' : 'recall the meaning'}
      </div>
      {sentence && (
        <div style={{ fontSize: 23, lineHeight: 1.6, color: 'var(--text-primary)', textAlign: 'center', marginTop: 12 }}>
          {sentence.source_text}
        </div>
      )}
      {word && (
        <div style={{
          fontSize: 42, fontWeight: 500, color: 'var(--text-primary)',
          letterSpacing: '-1px', textAlign: 'center', marginTop: 8,
        }}>
          {word.lemma}
        </div>
      )}

      {shown && (
        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: '0.5px solid var(--border-tertiary)',
          animation: 'revealFade 0.15s ease both',
        }}>
          {sentence && VERSIONS.filter(v => sentence[`${v}_en`]).map(v => (
            <div key={v} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 14, color: '#854F0B',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5,
              }}>
                {v}
              </div>
              <div style={{ fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {sentence[`${v}_en`]}
              </div>
            </div>
          ))}
          {word && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <Phonetics snap={word} />
              <SpeakButton text={word.lemma} size={18} />
            </div>
          )}
        </div>
      )}
    </Screen>
  )
}

/* ── The end of a session ── */

function DoneCard({ summary, onExit }: { summary: SessionSummary; onExit: () => void }) {
  const navigate = useNavigate()
  const any = summary.reviewed > 0
  return (
    <Screen center footer={<button onClick={onExit} style={{ ...PRIMARY, width: '100%' }}>Back to review</button>}>
      <div style={{ textAlign: 'center' }}>
        <PartyPopper size={44} color="var(--amber-600)" style={{ display: 'block', margin: '0 auto' }} />
        <div style={{ fontSize: 29, fontWeight: 500, color: 'var(--text-primary)', marginTop: 14 }}>
          {any ? 'Session complete' : 'Nothing to review right now'}
        </div>
      </div>
      {any && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 }}>
          <StatTile label="Reviewed" value={summary.reviewed} />
          <StatTile label="Recalled" value={`${Math.round((summary.recalled / summary.reviewed) * 100)}%`} />
          <StatTile label="New" value={summary.learned} />
          <StatTile label="Time" value={formatDuration(summary.durationMs)} />
        </div>
      )}
      {summary.trouble.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
            These slipped this time — worth another look:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {summary.trouble.map(lemma => (
              <button
                key={lemma}
                onClick={() => navigate('/lookup/' + lemma)}
                style={{
                  border: '0.5px solid var(--border-secondary)', borderRadius: 8,
                  background: 'none', padding: '6px 12px',
                  fontSize: 17, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {lemma}
              </button>
            ))}
          </div>
        </div>
      )}
    </Screen>
  )
}

/* ── Small pieces ── */

function Tag({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span style={{
      alignSelf: 'flex-start',
      background: accent ? 'var(--amber-50)' : 'var(--bg-secondary)',
      color: accent ? 'var(--amber-700)' : 'var(--text-secondary)',
      borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 500,
    }}>
      {children}
    </span>
  )
}

function SpeakButton({ text, size = 16 }: { text: string; size?: number }) {
  return (
    <button
      onClick={() => speak(text)}
      aria-label={`Say ${text}`}
      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}
    >
      <Volume2 size={size} color="var(--amber-600)" />
    </button>
  )
}

function Phonetics({ snap }: { snap: WordSnapshot }) {
  if (!snap.phonetic_uk && !snap.phonetic_us) return null
  return (
    <span style={{ display: 'inline-flex', gap: 12, fontSize: 16, color: 'var(--text-secondary)' }}>
      {snap.phonetic_uk && <span>UK {snap.phonetic_uk}</span>}
      {snap.phonetic_us && <span>US {snap.phonetic_us}</span>}
    </span>
  )
}

// English first: a translation waits behind the same "中文" chip SenseBlock uses, unless the
// learner has chosen to always see it, or never to.
function Chinese({ mode, children, style }: { mode: ChineseDisplay; children: ReactNode; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  if (mode === 'never') return null
  return (
    <div style={style}>
      {mode === 'tap' && <ChineseToggle open={open} onToggle={() => setOpen(o => !o)} />}
      {(mode === 'always' || open) && (
        <div style={{
          fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.5,
          marginTop: mode === 'tap' ? 6 : 0,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// Cards from before the per-sense split hold every sense at once. The first is the one
// asked; the rest are still part of the card, so they are one tap away.
function OtherSenses({ senses, lemma, chinese }: { senses: Definition[]; lemma: string; chinese: ChineseDisplay }) {
  if (senses.length === 0) return null
  return (
    <details style={{
      marginTop: 12, border: '0.5px solid var(--border-secondary)',
      borderRadius: 14, padding: '10px 16px',
    }}>
      <summary style={{ fontSize: 16, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        Other meanings on this card ({senses.length})
      </summary>
      {senses.map((def, i) => (
        <div key={i} style={{ marginTop: 12 }}>
          <SenseBlock def={def} lemma={lemma} chinese={chinese} size="compact" />
        </div>
      ))}
    </details>
  )
}

// The answer side's copy of the sentence: the blank filled back in and marked, so the
// first thing the learner sees is whether the word they typed was the one.
function MarkedSentence({ example, lemma }: { example: Example; lemma: string }) {
  return (
    <>
      {markTarget(example.en, example.target, lemma).map((part, i) =>
        part.target ? (
          <span
            key={i}
            style={{
              fontWeight: 600, color: 'var(--text-primary)',
              background: 'var(--amber-50)', borderRadius: 4, padding: '0 2px',
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
            aria-label="blank"
            style={{
              display: 'inline-block',
              width: Math.min(190, Math.max(56, part.text.length * 13)),
              margin: '0 2px',
              borderBottom: '2px solid var(--text-primary)',
              transform: 'translateY(3px)',
            }}
          />
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        )
      )}
    </>
  )
}
