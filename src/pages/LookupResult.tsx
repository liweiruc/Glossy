import { useState, useEffect, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, MoreHorizontal, Volume2, Plus, Check } from 'lucide-react'
import { db } from '../db'
import type { WordCache, WordSnapshot, Definition } from '../db'
import { lookupWord } from '../api/lookup'
import { getErrorMessage } from '../api/llm'
import { useToast } from '../components/Toast'
import ErrorBanner from '../components/ErrorBanner'
import ClickableText from '../components/ClickableText'
import WordPopup from '../components/WordPopup'

export default function LookupResult() {
  const { lemma } = useParams<{ lemma: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const queriedForm = (location.state as { queriedForm?: string } | null)?.queriedForm

  const [wordData, setWordData] = useState<WordCache | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [popupWord, setPopupWord] = useState<string | null>(null)

  const onWordClick = useCallback((w: string) => setPopupWord(w), [])

  useEffect(() => {
    if (!lemma) return

    // Check review status independently (fast, always from cache)
    db.review_items
      .filter(item => item.type === 'word' && (item.snapshot as WordSnapshot).lemma === lemma)
      .first()
      .then(existing => setIsAdded(!!existing))

    const controller = new AbortController()
    let cancelled = false
    async function load() {
      setLoadingData(true)
      setErrorMsg(null)
      try {
        let data: WordCache | undefined
        if (queriedForm) {
          // From Home search: lookupWord handles cache check + LLM + history recording
          data = await lookupWord(queriedForm, undefined, controller.signal)
        } else {
          // From History / direct URL: load from cache only, no history recording
          data = await db.word_cache.get(lemma!) ?? undefined
        }
        if (!cancelled) {
          if (data) {
            setWordData(data)
          } else {
            setErrorMsg('Word data not found. Please go back and search again.')
          }
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setErrorMsg(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [lemma, retryKey])

  async function handleAddToReview() {
    if (!wordData || isAdded) return
    const now = Date.now()
    await db.review_items.add({
      id: crypto.randomUUID(),
      type: 'word',
      snapshot: {
        lemma: wordData.lemma,
        phonetic_uk: wordData.phonetic_uk,
        phonetic_us: wordData.phonetic_us,
        definitions: wordData.definitions,
      } as WordSnapshot,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      due_at: now,
      added_at: now,
      last_reviewed_at: null,
    })
    setIsAdded(true)
    showToast('已加入复习本')
  }

  const showHint = queriedForm && lemma && queriedForm.toLowerCase() !== lemma.toLowerCase()
  const definitions = wordData?.definitions ?? []
  const visibleDefs = expanded ? definitions : definitions.slice(0, 3)
  const hiddenCount = definitions.length - 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
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
        <span style={{ flex: 1, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
          Lookup
        </span>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <MoreHorizontal size={20} color="var(--text-tertiary)" />
        </button>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <ErrorBanner
          message={errorMsg}
          onClose={() => setErrorMsg(null)}
          onRetry={queriedForm ? () => setRetryKey(k => k + 1) : undefined}
        />
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', paddingBottom: 80 }}>
        {loadingData && !wordData && !errorMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 80,
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              正在查询 {lemma}...
            </span>
          </div>
        )}

        {wordData && (
          <>
            {/* WordHeader */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 30, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {wordData.lemma}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <PhoneticItem label="UK" phonetic={wordData.phonetic_uk} word={wordData.lemma} lang="en-GB" />
                <PhoneticItem label="US" phonetic={wordData.phonetic_us} word={wordData.lemma} lang="en-US" />
              </div>
            </div>

            {/* LemmaHint */}
            {showHint && (
              <div style={{
                display: 'inline-block',
                background: 'var(--bg-secondary)', borderRadius: 6,
                padding: '6px 10px', marginBottom: 14,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  '{queriedForm}' is a form of '{lemma}'
                </span>
              </div>
            )}

            {/* DefinitionList */}
            <div>
              {visibleDefs.map((def, i) => (
                <div key={i}>
                  <DefinitionBlock def={def} onWordClick={onWordClick} />
                  {i < visibleDefs.length - 1 && (
                    <div style={{ height: '0.5px', background: 'var(--border-tertiary)', margin: '10px 0' }} />
                  )}
                </div>
              ))}
            </div>

            {/* ExpandButton */}
            {!expanded && hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(true)}
                style={{
                  display: 'block', width: '100%',
                  marginTop: 12, padding: '8px 0',
                  background: 'none', border: 'none',
                  fontSize: 12, color: 'var(--amber-600)',
                  cursor: 'pointer', textAlign: 'center',
                  fontFamily: 'inherit',
                }}
              >
                Show {hiddenCount} more {hiddenCount === 1 ? 'meaning' : 'meanings'}
              </button>
            )}
          </>
        )}
      </div>

      {/* CtaBar */}
      {wordData && (
        <div style={{
          borderTop: '0.5px solid var(--border-tertiary)',
          padding: '10px 18px 14px',
          flexShrink: 0,
          background: 'var(--bg-primary)',
        }}>
          <button
            onClick={handleAddToReview}
            disabled={isAdded}
            style={{
              width: '100%',
              background: isAdded ? 'var(--bg-secondary)' : 'var(--amber-600)',
              color: isAdded ? 'var(--text-secondary)' : '#fff',
              border: 'none', borderRadius: 10,
              padding: '12px 0',
              fontSize: 14, fontWeight: 500,
              cursor: isAdded ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {isAdded ? <Check size={14} /> : <Plus size={14} />}
            {isAdded ? 'Added to review' : 'Add to review'}
          </button>
        </div>
      )}

      {popupWord && (
        <WordPopup word={popupWord} onClose={() => setPopupWord(null)} />
      )}
    </div>
  )
}

function PhoneticItem({ label, phonetic, word, lang }: {
  label: string; phonetic: string; word: string; lang: string
}) {
  function speak() {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(word)
    utt.lang = lang
    utt.rate = 0.9
    window.speechSynthesis.speak(utt)
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
      {label} {phonetic}
      <button
        onClick={speak}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
      >
        <Volume2 size={14} color="var(--amber-600)" />
      </button>
    </span>
  )
}

function DefinitionBlock({ def, onWordClick }: { def: Definition; onWordClick: (w: string) => void }) {
  return (
    <div style={{ paddingBottom: 4 }}>
      <span style={{
        display: 'inline-block',
        fontSize: 11, fontStyle: 'italic',
        color: 'var(--amber-700)',
        background: 'var(--amber-50)',
        borderRadius: 4, padding: '1px 7px',
      }}>
        {def.pos}
      </span>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45, marginTop: 4 }}>
        <ClickableText text={def.en} onWordClick={onWordClick} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 6 }}>
        <ClickableText text={def.cn} onWordClick={onWordClick} />
      </div>
      {def.examples.map((ex, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: 6 }}>
          <div style={{ width: 2, background: 'var(--border-tertiary)', borderRadius: 1, flexShrink: 0, marginRight: 8 }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic' }}>
              <ClickableText text={ex.en} onWordClick={onWordClick} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <ClickableText text={ex.cn} onWordClick={onWordClick} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
